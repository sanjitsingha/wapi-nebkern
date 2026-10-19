// ============================================================
// /api/integrations/hubspot/connect
//
//   GET    — everything the connected page shows: the portal, its
//            settings, the granted permissions and the sync state.
//   PATCH  — the page's settings ("Create contacts in HubSpot", the
//            lifecycle stage for new chats, "Log chats in HubSpot"),
//            or { action: 'resync' }.
//   DELETE — disconnect.
//
// Connecting itself is ../oauth/start, which creates the row.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import {
  HUBSPOT_SCOPES,
  hubspotPermissionLabels,
  platformHubSpotCredentials,
} from '@/lib/hubspot/client';
import { hubspotHomeUrl, isLifecycleStage } from '@/lib/hubspot/push';

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const configured = !!platformHubSpotCredentials();

    const { data } = await ctx.supabase
      .from('hubspot_connections')
      .select(
        'portal_id, hub_domain, ui_domain, is_active, connected_at, last_event_at, scopes, push_contacts, chat_lifecycle_stage, log_chats',
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!data) return NextResponse.json({ connection: null, configured });

    return NextResponse.json({
      configured,
      connection: {
        portalId: data.portal_id,
        hubDomain: data.hub_domain,
        isActive: data.is_active,
        connectedAt: data.connected_at,
        lastEventAt: data.last_event_at,
        crmUrl: hubspotHomeUrl(data.ui_domain as string | null, data.portal_id as string | null),
      },
      settings: {
        createContacts: data.push_contacts !== false,
        lifecycle: isLifecycleStage(data.chat_lifecycle_stage) ? data.chat_lifecycle_stage : 'lead',
        logChats: data.log_chats !== false,
      },
      permissions: hubspotPermissionLabels(),
      sync: await syncStatus(ctx.accountId, (data.scopes as string[] | null) ?? null),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Only what is happening or what needs the admin:
 *   pending / synced   records on their way to HubSpot, and how many
 *                      are already there, for the progress bar.
 *   needsReconnect     HubSpot lacks a permission this version asks
 *                      for; only reconnecting grants it.
 */
async function syncStatus(accountId: string, scopes: string[] | null) {
  const db = supabaseAdmin();
  const [pending, synced, permission, notePermission] = await Promise.all([
    db
      .from('hubspot_sync_queue')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'pending'),
    db
      .from('hubspot_record_links')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId),
    db
      .from('hubspot_sync_queue')
      .select('id')
      .eq('account_id', accountId)
      .in('status', ['pending', 'failed'])
      .or('last_error.ilike.%reconnect%,last_error.ilike.%permission%')
      .limit(1),
    db
      .from('crm_note_syncs')
      .select('id')
      .eq('account_id', accountId)
      .eq('crm', 'hubspot')
      .in('status', ['pending', 'failed'])
      .or('last_error.ilike.%reconnect%,last_error.ilike.%permission%')
      .limit(1),
  ]);
  // A connection made before a scope was added is missing it.
  const missingScope =
    !!scopes?.length && HUBSPOT_SCOPES.some((s) => s !== 'oauth' && !scopes.includes(s));

  return {
    pending: pending.count ?? 0,
    synced: synced.count ?? 0,
    needsReconnect:
      missingScope || (permission.data?.length ?? 0) > 0 || (notePermission.data?.length ?? 0) > 0,
  };
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      createContacts?: unknown;
      lifecycle?: unknown;
      logChats?: unknown;
    };

    const { data: conn } = await db
      .from('hubspot_connections')
      .select('id, push_contacts')
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!conn) return NextResponse.json({ error: 'HubSpot is not connected.' }, { status: 404 });

    // Resync: re-read the deal pipeline and send anything not in step.
    if (body.action === 'resync') {
      await db.from('hubspot_connections').update({ deal_pipeline_at: null }).eq('id', conn.id);
      await db.rpc('hubspot_backfill', { p_account: ctx.accountId, p_deals: true });
      await db.rpc('crm_notes_backfill', { p_account: ctx.accountId, p_crm: 'hubspot' });
      return NextResponse.json({ ok: true });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.createContacts === 'boolean') patch.push_contacts = body.createContacts;
    if (isLifecycleStage(body.lifecycle)) patch.chat_lifecycle_stage = body.lifecycle;
    if (typeof body.logChats === 'boolean') patch.log_chats = body.logChats;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    }

    const { error } = await db
      .from('hubspot_connections')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', conn.id);
    if (error) return NextResponse.json({ error: 'Could not save the setting.' }, { status: 500 });

    // Switched back on: contacts changed while it was off were never
    // queued (the trigger checks the switch), so catch them up now.
    if (patch.push_contacts === true && conn.push_contacts === false) {
      await db.rpc('hubspot_backfill', { p_account: ctx.accountId, p_deals: false });
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

    // Webhooks for the portal keep arriving until the app is removed in
    // HubSpot, and are ignored from here on: no active connection.
    const { error } = await db.from('hubspot_connections').delete().eq('account_id', ctx.accountId);
    if (error) {
      console.error('[hubspot/connect] delete failed:', error);
      return NextResponse.json({ error: 'Could not disconnect.' }, { status: 500 });
    }

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_DISCONNECTED,
      targetType: 'integration',
      targetId: 'hubspot',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
