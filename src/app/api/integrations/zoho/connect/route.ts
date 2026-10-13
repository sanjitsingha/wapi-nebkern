// ============================================================
// /api/integrations/zoho/connect
//
//   GET    — everything the connected page shows: the account, its
//            settings, the granted permissions, and the sync state
//            (in progress, or needing a reconnect).
//   PATCH  — the page's settings ("Create contacts and leads", Lead or
//            Contact for new chats, "Log WhatsApp chats"), or
//            { action: 'resync' }.
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
  zohoPermissionLabels,
} from '@/lib/zoho/client';
import { zohoCrmUrl } from '@/lib/zoho/push';
import { logAudit } from '@/lib/audit/log';
import { syncZohoWatch, unsubscribeZohoWatch } from '@/lib/zoho/watch';
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
        'org_name, org_id, api_domain, is_active, connected_at, last_event_at, webhook_token, client_id, refresh_token, watch_channel_id, watch_error, push_contacts, chat_contact_module, log_chats',
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
        // For a Workflow Rule — shown only to a Zoho that cannot send
        // events on its own (see sync.unavailable).
        webhookUrl: base
          ? `${base}/api/integrations/zoho/webhook/${data.webhook_token}`
          : null,
        crmUrl: zohoCrmUrl(data.api_domain as string | null, data.org_id as string | null),
      },
      settings: {
        createContacts: data.push_contacts !== false,
        chatModule: data.chat_contact_module === 'Contacts' ? 'Contacts' : 'Leads',
        logChats: data.log_chats !== false,
      },
      permissions: zohoPermissionLabels(),
      sync: await syncStatus(ctx.accountId, data),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * What Settings shows about sync — only what is happening or what
 * needs the admin. Routine outcomes are not reported.
 *
 *   pending / synced   records on their way to Zoho, and how many are
 *                      already there, for the progress bar.
 *   needsReconnect     Zoho lacks a permission this version asks for;
 *                      only reconnecting can grant it.
 *   unavailable        why Zoho will not send events automatically
 *                      (e.g. an edition without notifications), so the
 *                      Workflow Rule fallback can be offered instead.
 */
async function syncStatus(
  accountId: string,
  conn: { watch_channel_id?: string | null; watch_error?: string | null },
) {
  const db = supabaseAdmin();
  const [pending, synced, permission] = await Promise.all([
    db
      .from('zoho_sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'pending'),
    db
      .from('zoho_record_links')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId),
    db
      .from('zoho_sync_queue')
      .select('id')
      .eq('account_id', accountId)
      .in('status', ['pending', 'failed'])
      .or('last_error.ilike.%reconnect%,last_error.ilike.%scope%')
      .limit(1),
  ]);

  const watchError = conn.watch_error ?? null;
  const reconnect =
    /reconnect|scope|permission/i.test(watchError ?? '') || (permission.data?.length ?? 0) > 0;

  return {
    active: !!conn.watch_channel_id,
    pending: pending.count ?? 0,
    synced: synced.count ?? 0,
    needsReconnect: reconnect,
    unavailable: watchError && !reconnect ? watchError : null,
  };
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      createContacts?: unknown;
      chatModule?: unknown;
      logChats?: unknown;
    };

    const { data: conn } = await db
      .from('zoho_connections')
      .select('id, push_contacts')
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!conn) return NextResponse.json({ error: 'Zoho is not connected.' }, { status: 404 });

    // Resync: re-read Zoho's settings (deal stages), re-check the
    // notification channel, and send anything not yet in step. Linked,
    // unchanged records cost the worker a lookup and nothing in Zoho.
    if (body.action === 'resync') {
      await db.from('zoho_connections').update({ deal_stages_at: null }).eq('id', conn.id);
      await syncZohoWatch(db, ctx.accountId).catch(() => null);
      await db.rpc('zoho_backfill', { p_account: ctx.accountId, p_deals: true });
      return NextResponse.json({ ok: true });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.createContacts === 'boolean') patch.push_contacts = body.createContacts;
    if (body.chatModule === 'Leads' || body.chatModule === 'Contacts') {
      patch.chat_contact_module = body.chatModule;
    }
    if (typeof body.logChats === 'boolean') patch.log_chats = body.logChats;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    }

    const { error } = await db
      .from('zoho_connections')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', conn.id);
    if (error) {
      return NextResponse.json({ error: 'Could not save the setting.' }, { status: 500 });
    }

    // Switched back on: contacts changed while it was off were never
    // queued (the trigger checks the switch), so catch them up now.
    if (patch.push_contacts === true && conn.push_contacts === false) {
      await db.rpc('zoho_backfill', { p_account: ctx.accountId, p_deals: false });
    }
    return NextResponse.json({ ok: true });
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
