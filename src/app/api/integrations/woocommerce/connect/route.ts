// ============================================================
// /api/integrations/woocommerce/connect
//
//   POST   — connect a store: verify REST API creds, auto-register the
//            order webhooks, store the connection (secret encrypted).
//   GET    — current connection status for the account.
//   DELETE — disconnect: remove the Woo webhooks and the row.
//
// Admin+ only.
// ============================================================

import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import {
  verifyStore,
  createOrderWebhooks,
  deleteWebhooks,
} from '@/lib/woocommerce/client';

/** Public origin of this deployment — where WooCommerce must deliver to. */
function siteBaseUrl(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const fwHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  if (fwHost) return `${proto}://${fwHost}`;
  const host = request.headers.get('host')?.trim();
  return host ? `${proto}://${host}` : '';
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as {
      storeUrl?: unknown;
      consumerKey?: unknown;
      consumerSecret?: unknown;
    } | null;

    let storeUrl = typeof body?.storeUrl === 'string' ? body.storeUrl.trim() : '';
    const consumerKey =
      typeof body?.consumerKey === 'string' ? body.consumerKey.trim() : '';
    const consumerSecret =
      typeof body?.consumerSecret === 'string' ? body.consumerSecret.trim() : '';

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: 'Store URL, consumer key and secret are all required.' },
        { status: 400 },
      );
    }

    if (!/^https?:\/\//i.test(storeUrl)) storeUrl = 'https://' + storeUrl;
    let parsed: URL;
    try {
      parsed = new URL(storeUrl);
    } catch {
      return NextResponse.json({ error: 'Enter a valid store URL.' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'The store URL must use HTTPS.' },
        { status: 400 },
      );
    }
    storeUrl = parsed.origin;

    const creds = { storeUrl, consumerKey, consumerSecret };

    const verify = await verifyStore(creds);
    if (!verify.ok) {
      return NextResponse.json({ error: verify.error }, { status: 400 });
    }

    const base = siteBaseUrl(request);
    if (!base) {
      return NextResponse.json(
        { error: 'Server address is not configured (NEXT_PUBLIC_SITE_URL).' },
        { status: 500 },
      );
    }

    const db = supabaseAdmin();
    // Reuse the token/secret when reconnecting so the delivery URL is stable.
    const { data: existing } = await db
      .from('woocommerce_connections')
      .select('webhook_token, webhook_secret, wc_webhook_ids')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    const token =
      (existing?.webhook_token as string) ?? crypto.randomBytes(24).toString('hex');
    const webhookSecret =
      (existing?.webhook_secret as string) ?? crypto.randomBytes(32).toString('hex');
    const deliveryUrl = `${base}/api/integrations/woocommerce/webhook/${token}`;

    // Reconnecting: clear the webhooks we made before so we don't stack duplicates.
    if (Array.isArray(existing?.wc_webhook_ids) && existing.wc_webhook_ids.length) {
      await deleteWebhooks(creds, existing.wc_webhook_ids as number[]);
    }

    const { ids, error: whErr } = await createOrderWebhooks(
      creds,
      deliveryUrl,
      webhookSecret,
    );
    if (whErr === 'write_permission') {
      return NextResponse.json(
        {
          error:
            'That API key is read-only. Create a WooCommerce REST API key with Read/Write permission, then reconnect.',
        },
        { status: 400 },
      );
    }
    if (whErr) {
      return NextResponse.json({ error: whErr }, { status: 400 });
    }

    const { error } = await db.from('woocommerce_connections').upsert(
      {
        account_id: ctx.accountId,
        store_url: storeUrl,
        consumer_key: consumerKey,
        consumer_secret: encrypt(consumerSecret),
        webhook_secret: webhookSecret,
        webhook_token: token,
        wc_webhook_ids: ids,
        is_active: true,
        connected_by: ctx.userId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    );
    if (error) {
      console.error('[woocommerce/connect] save failed:', error);
      return NextResponse.json(
        { error: 'Connected to the store, but saving failed. Please retry.' },
        { status: 500 },
      );
    }

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_CONNECTED,
      targetType: 'integration',
      targetId: 'woocommerce',
      targetLabel: `WooCommerce (${parsed.host})`,
      metadata: { store: storeUrl },
      request,
    });

    return NextResponse.json({ connected: true, storeUrl });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const { data } = await ctx.supabase
      .from('woocommerce_connections')
      .select('store_url, is_active, connected_at, last_event_at')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    return NextResponse.json({
      connection: data
        ? {
            storeUrl: data.store_url,
            isActive: data.is_active,
            connectedAt: data.connected_at,
            lastEventAt: data.last_event_at,
          }
        : null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();

    const { data: conn } = await db
      .from('woocommerce_connections')
      .select('store_url, consumer_key, consumer_secret, wc_webhook_ids')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (conn) {
      // Best-effort teardown of the Woo-side webhooks with the stored creds.
      try {
        if (Array.isArray(conn.wc_webhook_ids) && conn.wc_webhook_ids.length) {
          await deleteWebhooks(
            {
              storeUrl: conn.store_url,
              consumerKey: conn.consumer_key,
              consumerSecret: decrypt(conn.consumer_secret),
            },
            conn.wc_webhook_ids as number[],
          );
        }
      } catch {
        /* the row goes regardless */
      }

      await db
        .from('woocommerce_connections')
        .delete()
        .eq('account_id', ctx.accountId);

      await logAudit({
        accountId: ctx.accountId,
        actorUserId: ctx.userId,
        action: AUDIT.CHANNEL_DISCONNECTED,
        targetType: 'integration',
        targetId: 'woocommerce',
        targetLabel: 'WooCommerce',
        request,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
