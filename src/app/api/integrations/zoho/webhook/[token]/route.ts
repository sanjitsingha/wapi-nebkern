// ============================================================
// /api/integrations/zoho/webhook/[token]
//
// Where a Zoho Workflow Rule delivers an event. The [token] identifies
// the connection and IS the authentication — unlike Shopify and
// WooCommerce, a Zoho Workflow Rule cannot sign its payload, so there
// is no HMAC to verify. The token is 24 random bytes and only ever
// appears in the URL the admin pastes into Zoho.
//
// Every event is recorded whether or not it matched a contact. A rule
// that fires but sends no phone is otherwise invisible: the automation
// simply never runs and there is nothing to look at.
//
// Always answers 200 on a handled event. Zoho retries on a non-2xx, and
// a payload we cannot use will fail identically on every retry.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAdmin } from '@/lib/billing/admin-client';
import { runAutomationsForTrigger } from '@/lib/automations/engine';
import { normalizeZohoPayload } from '@/lib/zoho/payload';
import { upsertContactFromZoho } from '@/lib/zoho/ingest';
import { enrichZohoRecord, fetchableModule } from '@/lib/zoho/enrich';
import { contactHash, saveLink, type ContactRow } from '@/lib/zoho/push';
import {
  notificationRecord,
  parseZohoNotification,
} from '@/lib/zoho/watch';
import type { ZohoNormalized } from '@/lib/zoho/payload';

/** Refuse a payload bigger than this. A Zoho record is a few KB; a
 *  megabyte of JSON is a misconfiguration or an attack, and parsing it
 *  helps nobody. */
const MAX_BODY_BYTES = 256 * 1024;

/** Records handled from one notification. Zoho batches ids when many
 *  change at once (an import); each costs a read and an automation run,
 *  and Zoho times the delivery out if we take too long. */
const MAX_NOTIFICATION_IDS = 25;

/** A Zoho event for a record Instant wrote within this window is our
 *  own change coming back, not something a person did in Zoho. */
const ECHO_WINDOW_MS = 3 * 60_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return new NextResponse('Not found', { status: 404 });

  const db = supabaseAdmin();
  const { data: conn } = await db
    .from('zoho_connections')
    .select('id, account_id, is_active, watch_channel_id, watch_token')
    .eq('webhook_token', token)
    .maybeSingle();

  // Same 404 for an unknown token and a disabled connection — telling
  // the caller which is which would confirm that a token exists.
  if (!conn || !conn.is_active) {
    return new NextResponse('Not found', { status: 404 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: true, skipped: 'too_large' });
  }

  // A Zoho Workflow Rule webhook puts its Module/Custom Parameters in
  // the URL query string when "Body" is set to None (the default most
  // admins leave it on) — the params are appended to the Notify URL, not
  // sent as a body. Read those too so that common setup just works.
  let queryParams: Record<string, string> = {};
  try {
    queryParams = Object.fromEntries(new URL(request.url).searchParams);
  } catch {
    /* malformed URL — fall through with body only */
  }

  // Parse the body when there is one: JSON first, then form-encoded
  // (Zoho can POST either). Whatever it holds is merged over the query
  // params so a real body wins on a key both carried.
  let bodyPayload: Record<string, unknown> = {};
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === 'object') {
        bodyPayload = parsed as Record<string, unknown>;
      }
    } catch {
      bodyPayload = Object.fromEntries(new URLSearchParams(rawBody));
    }
  }

  const payload: Record<string, unknown> = { ...queryParams, ...bodyPayload };

  const accountId = conn.account_id as string;

  const { data: account } = await db
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle();
  const ownerUserId = account?.owner_user_id as string | undefined;
  if (!ownerUserId) return NextResponse.json({ ok: true });

  const ctx: EventContext = {
    db,
    accountId,
    connectionId: conn.id as string,
    ownerUserId,
    payload,
  };

  // ── Automatic sync: a Notification API delivery ──
  //
  // Carries ids only. Accepted from the CURRENT channel alone, with the
  // token we gave Zoho: a channel replaced during a failed renewal can
  // keep delivering until it lapses, and running those too would fire
  // every automation twice.
  const notification = parseZohoNotification(bodyPayload);
  if (notification) {
    if (
      !conn.watch_channel_id ||
      notification.channelId !== conn.watch_channel_id ||
      (conn.watch_token && notification.token !== conn.watch_token)
    ) {
      return NextResponse.json({ ok: true, skipped: 'stale_channel' });
    }

    for (const id of notification.ids.slice(0, MAX_NOTIFICATION_IDS)) {
      await handleRecord(ctx, notificationRecord(notification, id), {
        deleted: notification.operation === 'delete',
      });
    }
    await touchConnection(db, conn.id as string);
    return NextResponse.json({ ok: true });
  }

  // ── A Workflow Rule webhook ──
  await handleRecord(ctx, normalizeZohoPayload(payload));
  await touchConnection(db, conn.id as string);
  return NextResponse.json({ ok: true });
}

interface EventContext {
  db: SupabaseClient;
  accountId: string;
  connectionId: string;
  ownerUserId: string;
  /** The body as received, for the event log. */
  payload: Record<string, unknown>;
}

/**
 * Is the push worker working on this contact, or on a deal of theirs,
 * right now? It claims a queue row by moving next_retry_at into the
 * future and holds it until the push is finished and linked. A row
 * backing off after a failure looks the same — and wrote nothing to
 * Zoho — so the rare misreading costs one event its automations.
 */
async function ownPushInFlight(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
): Promise<boolean> {
  const { data: rows } = await db
    .from('zoho_sync_queue')
    .select('entity, local_id')
    .eq('account_id', accountId)
    .eq('status', 'pending')
    .gt('next_retry_at', new Date().toISOString())
    .limit(100);
  if (!rows?.length) return false;
  if (rows.some((r) => r.entity === 'contact' && r.local_id === contactId)) return true;

  // A deal push converts the person's Lead, creating a Zoho Contact
  // that is announced as "contact.created".
  const dealIds = rows.filter((r) => r.entity === 'deal').map((r) => r.local_id as string);
  if (dealIds.length === 0) return false;
  const { count } = await db
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .in('id', dealIds)
    .eq('contact_id', contactId);
  return (count ?? 0) > 0;
}

async function touchConnection(db: SupabaseClient, connectionId: string) {
  await db
    .from('zoho_connections')
    .update({ last_event_at: new Date().toISOString() })
    .eq('id', connectionId);
}

/**
 * One record's event: fill it in from Zoho, match or create the
 * contact, log it, and run the automations. Shared by Workflow Rule
 * webhooks (one record) and notifications (one per id).
 */
async function handleRecord(
  { db, accountId, connectionId, ownerUserId, payload }: EventContext,
  parsed: ZohoNormalized,
  opts: { deleted?: boolean } = {},
) {
  // A deleted record cannot be read back and has nobody to message.
  // Logged so the event list shows Zoho is reaching us.
  if (opts.deleted) {
    await db.from('zoho_events').insert({
      account_id: accountId,
      connection_id: connectionId,
      event_type: parsed.eventType,
      module: parsed.module,
      record_id: parsed.recordId,
      contact_id: null,
      matched: false,
      skip_reason: 'deleted',
      payload,
    });
    return;
  }

  // Read the record the event points at, so a Workflow Rule can carry
  // an id and a module and nothing else. Soft in every failure case —
  // see lib/zoho/enrich.ts — so an event that arrived complete, or a
  // module we hold no scope for, proceeds exactly as it used to.
  const enrichment = await enrichZohoRecord(db, accountId, parsed);
  const record = enrichment.record;

  // Was this Instant's own push echoing back? Then it is logged, but
  // runs no automations — creating a contact in Instant must not fire
  // a "new Zoho lead" welcome message at them.
  let echo = false;
  if (record.recordId) {
    const { data: link } = await db
      .from('zoho_record_links')
      .select('pushed_at')
      .eq('account_id', accountId)
      .eq('zoho_id', record.recordId)
      .not('pushed_at', 'is', null)
      .order('pushed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    echo =
      !!link?.pushed_at &&
      Date.now() - Date.parse(link.pushed_at as string) < ECHO_WINDOW_MS;
  }

  const ingest = await upsertContactFromZoho(
    db,
    accountId,
    ownerUserId,
    record,
  );

  // The link checked above is saved just AFTER Instant creates a record
  // in Zoho, and Zoho can announce the record before that — a "new lead"
  // that is really the one we just pushed. So it is also our own change
  // while the sync worker is still busy with this person or a deal of
  // theirs. Matters most during a backfill, when hundreds are pushed.
  if (!echo && ingest.contactId) {
    echo = await ownPushInFlight(db, accountId, ingest.contactId);
  }

  // Record the event either way. This is the debugging surface: without
  // it, "the automation didn't run" has no answer.
  await db.from('zoho_events').insert({
    account_id: accountId,
    connection_id: connectionId,
    event_type: record.eventType,
    module: record.module,
    record_id: record.recordId,
    contact_id: ingest.contactId,
    matched: !!ingest.contactId,
    skip_reason: ingest.skippedReason ?? (echo ? 'own_change' : null),
    // The payload AS RECEIVED, not the enriched one. This column is the
    // debugging surface for "why did my rule not work", and the answer
    // is almost always something the rule did or did not send — which
    // storing our own additions on top of would hide. What enrichment
    // contributed is recorded beside it instead.
    payload: payload as Record<string, unknown>,
    enriched: enrichment.enriched,
    enrich_skipped: enrichment.skipped ?? null,
  });

  // No contact means nothing to message. The event is stored, so the
  // admin can see the payload and fix the Workflow Rule's field list.
  if (!ingest.contactId) return;

  // Remember which Zoho record this person is, so Instant → Zoho sync
  // updates it instead of searching (or creating a second one). Only
  // when they have no link yet: a person can sit in Zoho twice, and
  // the record they are already synced with stays the one.
  const zohoModule = fetchableModule(record.module);
  if (record.recordId && (zohoModule === 'Leads' || zohoModule === 'Contacts')) {
    const { data: existingLink } = await db
      .from('zoho_record_links')
      .select('id')
      .eq('account_id', accountId)
      .eq('entity', 'contact')
      .eq('local_id', ingest.contactId)
      .maybeSingle();
    if (!existingLink) {
      const { data: contact } = await db
        .from('contacts')
        .select('id, account_id, name, phone, email, company, instagram_id, messenger_id, created_via')
        .eq('id', ingest.contactId)
        .maybeSingle();
      if (contact) {
        await saveLink(
          db,
          accountId,
          'contact',
          ingest.contactId,
          zohoModule,
          record.recordId,
          contactHash(contact as ContactRow),
          false,
        );
      }
    }
  }

  if (echo) return;

  await runAutomationsForTrigger({
    accountId,
    triggerType: 'zoho_event',
    contactId: ingest.contactId,
    context: {
      vars: {
        ...record.vars,
        // Guaranteed present whatever the Workflow Rule sent, so an
        // automation can branch on them without the builder having to
        // know one org's field names.
        zoho_module: record.module ?? '',
        zoho_record_id: record.recordId ?? '',
        zoho_event: record.eventType ?? '',
      },
    },
  });
}
