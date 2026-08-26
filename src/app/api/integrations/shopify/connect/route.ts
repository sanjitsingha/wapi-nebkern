// ============================================================
// /api/integrations/shopify/connect
//
//   POST   — connect a store: verify the Admin API token, auto-register
//            the order webhooks, store the connection (secrets encrypted).
//   GET    — current connection status for the account.
//   DELETE — disconnect: remove the webhooks and the row.
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
  normalizeShopDomain,
} from '@/lib/shopify/client';

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
      shopDomain?: unknown;
      accessToken?: unknown;
      apiSecret?: unknown;
    } | null;

    const rawDomain = typeof body?.shopDomain === 'string' ? body.shopDomain : '';
    const accessToken =
      typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
    const apiSecret =
      typeof body?.apiSecret === 'string' ? body.apiSecret.trim() : '';

    if (!rawDomain || !accessToken || !apiSecret) {
      return NextResponse.json(
        { error: 'Store domain, access token and API secret are all required.' },
        { status: 400 },
      );
    }

    const shopDomain = normalizeShopDomain(rawDomain);
    if (!shopDomain) {
      return NextResponse.json(
        { error: 'Enter your store’s .myshopify.com domain.' },
        { status: 400 },
      );
    }

    const creds = { shopDomain, accessToken };
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
    const { data: existing } = await db
      .from('shopify_connections')
      .select('webhook_token, wc_webhook_ids')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    const token =
      (existing?.webhook_token as string) ?? crypto.randomBytes(24).toString('hex');
    const deliveryUrl = `${base}/api/integrations/shopify/webhook/${token}`;

    // Reconnecting: clear the old webhooks first.
    if (Array.isArray(existing?.wc_webhook_ids) && existing.wc_webhook_ids.length) {
      await deleteWebhooks(creds, existing.wc_webhook_ids as number[]);
    }

    const { ids, error: whErr } = await createOrderWebhooks(creds, deliveryUrl);
    if (whErr === 'permission') {
      return NextResponse.json(
        {
          error:
            'The token is missing webhook access. Give the custom app the read_orders scope (and re-install), then reconnect.',
        },
        { status: 400 },
      );
    }
    if (whErr) {
      return NextResponse.json({ error: whErr }, { status: 400 });
    }

    const { error } = await db.from('shopify_connections').upsert(
      {
        account_id: ctx.accountId,
        shop_domain: shopDomain,
        access_token: encrypt(accessToken),
        api_secret: encrypt(apiSecret),
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
      console.error('[shopify/connect] save failed:', error);
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
      targetId: 'shopify',
      targetLabel: `Shopify (${shopDomain})`,
      metadata: { store: shopDomain },
      request,
    });

    return NextResponse.json({ connected: true, shopDomain });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const { data } = await ctx.supabase
      .from('shopify_connections')
      .select('shop_domain, is_active, connected_at, last_event_at')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    return NextResponse.json({
      connection: data
        ? {
            shopDomain: data.shop_domain,
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
      .from('shopify_connections')
      .select('shop_domain, access_token, wc_webhook_ids')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (conn) {
      try {
        if (Array.isArray(conn.wc_webhook_ids) && conn.wc_webhook_ids.length) {
          await deleteWebhooks(
            {
              shopDomain: conn.shop_domain,
              accessToken: decrypt(conn.access_token),
            },
            conn.wc_webhook_ids as number[],
          );
        }
      } catch {
        /* the row goes regardless */
      }

      await db.from('shopify_connections').delete().eq('account_id', ctx.accountId);

      await logAudit({
        accountId: ctx.accountId,
        actorUserId: ctx.userId,
        action: AUDIT.CHANNEL_DISCONNECTED,
        targetType: 'integration',
        targetId: 'shopify',
        targetLabel: 'Shopify',
        request,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
