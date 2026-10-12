// ============================================================
// /api/integrations/zoho/connect
//
//   GET    — connection status, including the webhook URL to paste
//            into a Zoho Workflow Rule and the automatic-sync state.
//   PATCH  — automatic sync: switch it on or off, or change which
//            events it watches. Re-syncs the Zoho channel at once.
//   DELETE — disconnect (removes the Zoho channel first).
//
// ── There is no POST any more ──
//
// There used to be one, and it was the first half of connecting: it
// saved the account's own Zoho client id and secret, which the admin
// had gone off to api-console.zoho.com to create, and only then could
// the OAuth round trip start.
//
// That is gone. The application belongs to this deployment now
// (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET), Zoho's multi-DC support means
// the data centre resolves itself, and connecting is a single trip to
// ../oauth/start — which also creates the row it needs. Nothing is left
// for the browser to save first.
//
// Accounts that connected under the old design keep their own
// credentials on the row and keep using them; see migration 108.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import {
  platformZohoCredentials,
  usesLegacyZohoApp,
} from '@/lib/zoho/client';
import { logAudit } from '@/lib/audit/log';
import {
  ZOHO_WATCH_EVENTS,
  sanitizeWatchEvents,
  syncZohoWatch,
  unsubscribeZohoWatch,
} from '@/lib/zoho/watch';
import { AUDIT } from '@/lib/audit/events';

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
        'org_name, org_id, api_domain, is_active, connected_at, last_event_at, webhook_token, client_id, refresh_token, auto_sync, watch_events, watch_channel_id, watch_expires_at, watch_error',
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    // Whether connecting is possible at all on this server. The dialog
    // shows a plain "not configured" state rather than a Connect button
    // that would walk the admin into a Zoho error page.
    //
    // A legacy row counts as configured on its own: it carries the
    // application it connected with, so it needs nothing from the
    // environment.
    //
    // Only one that actually connected, though. A half-made row left
    // over from the old design has credentials that were never used,
    // and counting it here reports the integration as configured on a
    // server that cannot connect anything — which puts an enabled
    // button in front of someone it is going to fail.
    const hasOwnApp = usesLegacyZohoApp(data);
    const configured = hasOwnApp || !!platformZohoCredentials();

    if (!data) return NextResponse.json({ connection: null, configured });

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
      configured,
      connection: {
        orgName: data.org_name,
        orgId: data.org_id,
        apiDomain: data.api_domain,
        isActive: data.is_active,
        // True only for a connection made under the old per-account
        // design. Surfaced so Settings can say so — those accounts are
        // still tied to a Zoho application someone there has to keep
        // alive, where everyone else is not.
        usesOwnApp: hasOwnApp,
        connectedAt: data.connected_at,
        lastEventAt: data.last_event_at,
        // The whole point of the settings card: this is what the admin
        // pastes into every Zoho Workflow Rule.
        webhookUrl: base
          ? `${base}/api/integrations/zoho/webhook/${data.webhook_token}`
          : null,
      },
      autoSync: {
        enabled: data.auto_sync !== false,
        events: sanitizeWatchEvents(data.watch_events ?? []),
        active: !!data.watch_channel_id,
        expiresAt: data.watch_expires_at,
        error: data.watch_error,
      },
      watchEvents: ZOHO_WATCH_EVENTS,
      recentEvents: events ?? [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();

    const body = (await request.json().catch(() => ({}))) as {
      enabled?: unknown;
      events?: unknown;
    };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.enabled === 'boolean') patch.auto_sync = body.enabled;
    if (body.events !== undefined) patch.watch_events = sanitizeWatchEvents(body.events);

    const { data: updated, error } = await db
      .from('zoho_connections')
      .update(patch)
      .eq('account_id', ctx.accountId)
      .select('id')
      .maybeSingle();
    if (error || !updated) {
      return NextResponse.json({ error: 'Zoho is not connected.' }, { status: 404 });
    }

    const result = await syncZohoWatch(db, ctx.accountId);
    return NextResponse.json({ ok: true, autoSync: result });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();

    // Remove the Zoho channel while we still hold the token to do it.
    // Best effort: one we cannot reach lapses within a week, and the
    // webhook it points at stops answering once the row is gone.
    const { data: existing } = await db
      .from('zoho_connections')
      .select('watch_channel_id')
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (existing?.watch_channel_id) {
      await unsubscribeZohoWatch(
        db,
        ctx.accountId,
        existing.watch_channel_id as string,
      ).catch(() => {});
    }

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
