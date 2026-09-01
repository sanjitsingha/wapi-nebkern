// ============================================================
// /api/integrations/zoho/connect
//
//   POST   — save this account's own Zoho client id + secret, and mint
//            the webhook token. Creates the half-made connection row
//            that the OAuth round trip then completes.
//   GET    — connection status, including the webhook URL to paste
//            into a Zoho Workflow Rule.
//   DELETE — disconnect.
//
// Credentials are PER ACCOUNT, the way woocommerce_connections stores
// consumer_key / consumer_secret — not one platform-wide app in the
// server environment. Every organisation using this tool registers its
// own Zoho application, which is also the only way this works across
// Zoho's data centres: a client registered on .com is unknown to .in.
//
// The OAuth handshake itself lives in ../oauth/.
// ============================================================

import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { encrypt } from '@/lib/whatsapp/encryption';
import { accountsUrlForLocation } from '@/lib/zoho/client';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const body = (await request.json().catch(() => null)) as {
      clientId?: unknown;
      clientSecret?: unknown;
      region?: unknown;
    } | null;

    const clientId =
      typeof body?.clientId === 'string' ? body.clientId.trim() : '';
    const clientSecret =
      typeof body?.clientSecret === 'string' ? body.clientSecret.trim() : '';
    const region = typeof body?.region === 'string' ? body.region : 'us';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Client ID and client secret are both required.' },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();
    const { data: existing } = await db
      .from('zoho_connections')
      .select('webhook_token')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    // Keep the receiver URL across a re-entry of credentials, so the
    // Workflow Rules already configured in Zoho keep working.
    const webhookToken =
      (existing?.webhook_token as string) ??
      crypto.randomBytes(24).toString('hex');

    const { error } = await db.from('zoho_connections').upsert(
      {
        account_id: ctx.accountId,
        client_id: clientId,
        client_secret: encrypt(clientSecret),
        accounts_url: accountsUrlForLocation(region),
        webhook_token: webhookToken,
        // Not live until OAuth completes — the webhook receiver checks
        // this, so a half-made connection cannot accept events.
        is_active: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    );

    if (error) {
      console.error('[zoho/connect] save failed:', error);
      return NextResponse.json(
        { error: 'Could not save the credentials.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

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

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const { data } = await ctx.supabase
      .from('zoho_connections')
      .select(
        'org_name, org_id, api_domain, is_active, connected_at, last_event_at, webhook_token, client_id',
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!data) return NextResponse.json({ connection: null });

    const base = siteBaseUrl(request);

    // Recent events, so the settings card can show whether Zoho is
    // actually reaching us — and, when a rule is misconfigured, WHY the
    // automation did not run.
    const { data: events } = await ctx.supabase
      .from('zoho_events')
      .select('id, event_type, module, matched, skip_reason, created_at')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      connection: {
        orgName: data.org_name,
        orgId: data.org_id,
        apiDomain: data.api_domain,
        isActive: data.is_active,
        // Credentials saved but OAuth not finished. The UI shows "Sign
        // in to Zoho" rather than a Connect form the admin has already
        // filled in once.
        hasCredentials: !!data.client_id,
        // Never returned, even to an admin: it is write-only from the
        // browser's point of view, the way every other stored secret in
        // this codebase behaves.
        connectedAt: data.connected_at,
        lastEventAt: data.last_event_at,
        // The whole point of the settings card: this is what the admin
        // pastes into every Zoho Workflow Rule.
        webhookUrl: base
          ? `${base}/api/integrations/zoho/webhook/${data.webhook_token}`
          : null,
      },
      recentEvents: events ?? [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();

    const { error } = await db
      .from('zoho_connections')
      .delete()
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[zoho/connect] delete failed:', error);
      return NextResponse.json(
        { error: 'Could not disconnect.' },
        { status: 500 },
      );
    }

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_DISCONNECTED,
      targetType: 'integration',
      targetId: 'zoho',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
