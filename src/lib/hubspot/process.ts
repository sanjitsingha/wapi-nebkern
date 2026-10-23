// ============================================================
// HubSpot → Dripo: store webhook events, then work through them
// (server only).
//
// HubSpot gives a delivery five seconds, so the receiver only stores
// the events (storeHubSpotEvents) and answers; processHubSpotEvents
// runs right after the response, and the minute cron picks up anything
// that run did not finish.
//
// Each event: read the record from HubSpot (a webhook carries ids
// only), match or create the Dripo contact by phone, link the two,
// and run the `hubspot_event` automations — unless the event is
// Dripo's own push coming back, which is logged and runs nothing.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { runAutomationsForTrigger } from '@/lib/automations/engine';
import { contactHash, type ContactRow } from '@/lib/zoho/push';
import { hubspotApiFetch } from './api';
import { personFromProperties, upsertContactFromHubSpot } from './ingest';
import { hubspotLinkHolder, pickPipeline, saveHubSpotLink, type HubSpotPipeline } from './push';
import {
  changeOrigin,
  hubspotEventType,
  type ParsedHubSpotEvent,
  type RawHubSpotEvent,
} from './webhook';

type Db = SupabaseClient;

/** A HubSpot event for a record Dripo wrote within this window is our
 *  own change coming back, not something a person did in HubSpot. */
const ECHO_WINDOW_MS = 3 * 60_000;
/** Pending events older than this are the cron's to pick up. */
const STALE_AFTER_MS = 2 * 60_000;
const MAX_ATTEMPTS = 5;

export const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'phone',
  'mobilephone',
  'company',
  'jobtitle',
  'city',
  'lifecyclestage',
  'hs_lead_status',
] as const;

const DEAL_PROPERTIES = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate'] as const;

/** Store a delivery's events, one row per connected account. Returns
 *  the ids of rows actually inserted (a retried delivery inserts none). */
export async function storeHubSpotEvents(db: Db, events: ParsedHubSpotEvent[]): Promise<string[]> {
  const portals = [...new Set(events.map((e) => e.portalId))];
  if (portals.length === 0) return [];

  const { data: connections } = await db
    .from('hubspot_connections')
    .select('id, account_id, portal_id')
    .in('portal_id', portals)
    .eq('is_active', true);
  if (!connections?.length) return [];

  const rows = events.flatMap((e) =>
    connections
      .filter((c) => c.portal_id === e.portalId)
      .map((c) => ({
        account_id: c.account_id,
        connection_id: c.id,
        dedupe_key: e.dedupeKey,
        subscription_type: e.subscriptionType,
        object_type: e.objectType,
        object_id: e.objectId,
        property_name: e.propertyName,
        property_value: e.propertyValue,
        occurred_at: e.occurredAt,
        payload: e.raw,
      })),
  );
  if (rows.length === 0) return [];

  const { data: inserted, error } = await db
    .from('hubspot_events')
    .upsert(rows, { onConflict: 'account_id,dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (error) {
    console.error('[hubspot/events] store failed:', error.message);
    return [];
  }

  await db
    .from('hubspot_connections')
    .update({ last_event_at: new Date().toISOString() })
    .in(
      'id',
      connections.map((c) => c.id),
    );
  return (inserted ?? []).map((r) => r.id as string);
}

interface EventRow {
  id: string;
  account_id: string;
  object_type: 'contact' | 'deal';
  object_id: string;
  property_name: string | null;
  property_value: string | null;
  subscription_type: string | null;
  attempts: number;
  /** The event as HubSpot sent it — says who made the change. */
  payload: RawHubSpotEvent | null;
}

interface HsRecord {
  id: string;
  properties?: Record<string, string | null>;
  associations?: { contacts?: { results?: { id: string }[] } };
}

class RetryableError extends Error {}

/** The stage a deal moved to, and whether it is a closed one. */
async function dealStage(
  db: Db,
  accountId: string,
  pipelineId: string | null | undefined,
  stageId: string | null | undefined,
): Promise<{ label: string; pipeline: string; closed: boolean; won: boolean } | null> {
  if (!pipelineId || !stageId) return null;
  const { data: conn } = await db
    .from('hubspot_connections')
    .select('deal_pipeline')
    .eq('account_id', accountId)
    .maybeSingle();
  let pipeline = conn?.deal_pipeline as HubSpotPipeline | null;
  if (pipeline?.id !== pipelineId || !pipeline.stages.some((s) => s.id === stageId)) {
    const res = await hubspotApiFetch<{ id: string; label?: string; stages?: unknown[] }>(
      db,
      accountId,
      `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}`,
    );
    pipeline = res.data ? pickPipeline({ results: [res.data as never] }) : null;
  }
  const stage = pipeline?.stages.find((s) => s.id === stageId);
  return stage && pipeline
    ? { label: stage.label, pipeline: pipeline.label, closed: stage.closed, won: stage.won }
    : null;
}

/** Is the push worker busy with this contact, or a deal of theirs, right
 *  now? Then a HubSpot event about them is most likely our own write. */
async function ownPushInFlight(db: Db, accountId: string, contactId: string): Promise<boolean> {
  const { data: rows } = await db
    .from('hubspot_sync_queue')
    .select('entity, local_id')
    .eq('account_id', accountId)
    .eq('status', 'pending')
    .gt('next_retry_at', new Date().toISOString())
    .limit(100);
  if (!rows?.length) return false;
  if (rows.some((r) => r.entity === 'contact' && r.local_id === contactId)) return true;
  const dealIds = rows.filter((r) => r.entity === 'deal').map((r) => r.local_id as string);
  if (dealIds.length === 0) return false;
  const { count } = await db
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .in('id', dealIds)
    .eq('contact_id', contactId);
  return (count ?? 0) > 0;
}

/** Was this HubSpot record written by Dripo a moment ago? */
async function recentlyPushed(db: Db, accountId: string, hubspotId: string): Promise<boolean> {
  const { data: link } = await db
    .from('hubspot_record_links')
    .select('pushed_at')
    .eq('account_id', accountId)
    .eq('hubspot_id', hubspotId)
    .not('pushed_at', 'is', null)
    .order('pushed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!link?.pushed_at && Date.now() - Date.parse(link.pushed_at as string) < ECHO_WINDOW_MS;
}

function stringVars(props: Record<string, string | null> | undefined, keys: readonly string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = props?.[k];
    if (v !== null && v !== undefined && v !== '') out[k] = String(v);
  }
  return out;
}

type Outcome = {
  status: 'done' | 'skipped';
  eventType?: string | null;
  contactId?: string | null;
  skipReason?: string | null;
};

async function handleEvent(db: Db, row: EventRow): Promise<Outcome> {
  const { data: conn } = await db
    .from('hubspot_connections')
    .select('is_active')
    .eq('account_id', row.account_id)
    .maybeSingle();
  if (!conn?.is_active) return { status: 'skipped', skipReason: 'not_connected' };

  const change = (row.subscription_type ?? '').split('.').pop() ?? '';
  if (change === 'deletion' || change === 'privacyDeletion') {
    return { status: 'skipped', skipReason: 'deleted' };
  }

  // The deal, when it is a deal event: its fields, and the person it
  // belongs to.
  let deal: HsRecord | null = null;
  let stage: Awaited<ReturnType<typeof dealStage>> = null;
  let contactHsId: string | null = row.object_type === 'contact' ? row.object_id : null;
  if (row.object_type === 'deal') {
    const res = await hubspotApiFetch<HsRecord>(
      db,
      row.account_id,
      `/crm/v3/objects/deals/${encodeURIComponent(row.object_id)}?properties=${DEAL_PROPERTIES.join(',')}&associations=contacts`,
    );
    if (res.status === 404) return { status: 'skipped', skipReason: 'not_found' };
    if (!res.data) throw new RetryableError(res.error ?? 'Could not read the deal from HubSpot.');
    deal = res.data;
    contactHsId = deal.associations?.contacts?.results?.[0]?.id ?? null;
    stage = await dealStage(db, row.account_id, deal.properties?.pipeline, deal.properties?.dealstage);
  }

  const eventType = hubspotEventType(
    {
      objectType: row.object_type,
      change: change === 'creation' ? 'creation' : change === 'propertyChange' ? 'propertyChange' : 'other',
      propertyName: row.property_name,
    },
    stage,
  );
  if (!eventType) return { status: 'skipped', skipReason: 'unsupported' };
  if (!contactHsId) return { status: 'skipped', eventType, skipReason: 'no_contact' };

  const contactRes = await hubspotApiFetch<HsRecord>(
    db,
    row.account_id,
    `/crm/v3/objects/contacts/${encodeURIComponent(contactHsId)}?properties=${CONTACT_PROPERTIES.join(',')}`,
  );
  if (contactRes.status === 404) return { status: 'skipped', eventType, skipReason: 'not_found' };
  if (!contactRes.data) throw new RetryableError(contactRes.error ?? 'Could not read the contact from HubSpot.');
  const props = contactRes.data.properties ?? {};

  const { data: account } = await db
    .from('accounts')
    .select('owner_user_id')
    .eq('id', row.account_id)
    .maybeSingle();
  const ownerUserId = account?.owner_user_id as string | undefined;
  if (!ownerUserId) return { status: 'skipped', eventType, skipReason: 'no_owner' };

  // Our own write coming back? HubSpot says so itself: our app id as the
  // source, or its deal lifecycle sync reacting to a deal we pushed. The
  // link-based checks below catch anything it does not label.
  const origin = changeOrigin(row.payload);
  let echo =
    origin.byApp ||
    (!!origin.dealId && (await recentlyPushed(db, row.account_id, origin.dealId))) ||
    (await recentlyPushed(db, row.account_id, row.object_id));

  // The Dripo contact: whoever this HubSpot contact is already linked
  // to, and only otherwise a match (or a new contact) by phone. Matching
  // first would pick the other copy of someone Dripo holds twice.
  let contactId = await hubspotLinkHolder(db, row.account_id, 'contacts', contactHsId);
  if (!contactId) {
    const ingest = await upsertContactFromHubSpot(db, row.account_id, ownerUserId, personFromProperties(props));
    if (!ingest.contactId) {
      return { status: 'skipped', eventType, skipReason: ingest.skippedReason ?? 'no_phone' };
    }
    contactId = ingest.contactId;

    // Remember which HubSpot contact this person is, so Dripo →
    // HubSpot updates it instead of searching — when they have no link.
    const { data: existingLink } = await db
      .from('hubspot_record_links')
      .select('id')
      .eq('account_id', row.account_id)
      .eq('entity', 'contact')
      .eq('local_id', contactId)
      .maybeSingle();
    if (!existingLink) {
      const { data: contact } = await db
        .from('contacts')
        .select('id, account_id, name, phone, email, company, instagram_id, messenger_id, created_via')
        .eq('id', contactId)
        .maybeSingle();
      if (contact) {
        await saveHubSpotLink(
          db,
          row.account_id,
          'contact',
          contactId,
          'contacts',
          contactHsId,
          contactHash(contact as ContactRow),
          false,
        );
      }
    }
  }
  if (!echo) echo = await ownPushInFlight(db, row.account_id, contactId);

  if (echo) return { status: 'done', eventType, contactId, skipReason: 'own_change' };

  await runAutomationsForTrigger({
    accountId: row.account_id,
    triggerType: 'hubspot_event',
    contactId,
    context: {
      vars: {
        ...stringVars(props, CONTACT_PROPERTIES),
        ...(deal
          ? {
              ...stringVars(deal.properties, ['dealname', 'amount', 'closedate']),
              ...(stage ? { dealstage: stage.label, pipeline: stage.pipeline } : {}),
            }
          : {}),
        // Always present, so an automation can branch on them.
        hubspot_event: eventType,
        hubspot_object: row.object_type,
        hubspot_record_id: row.object_id,
        hubspot_contact_id: contactHsId,
      },
    },
  });
  return { status: 'done', eventType, contactId };
}

export interface ProcessSummary {
  processed: number;
  done: number;
  failed: number;
}

/**
 * Work through stored events: the given ids (right after a delivery),
 * or — with none — pending ones the first run did not finish.
 */
export async function processHubSpotEvents(
  db: Db,
  { ids, budgetMs = 15_000, limit = 50 }: { ids?: string[]; budgetMs?: number; limit?: number } = {},
): Promise<ProcessSummary> {
  const started = Date.now();
  const summary: ProcessSummary = { processed: 0, done: 0, failed: 0 };

  let query = db
    .from('hubspot_events')
    .select('id, account_id, object_type, object_id, property_name, property_value, subscription_type, attempts, payload')
    .eq('status', 'pending')
    .order('occurred_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  query = ids?.length
    ? query.in('id', ids)
    : query.lt('created_at', new Date(Date.now() - STALE_AFTER_MS).toISOString());
  const { data: rows } = await query;

  for (const row of (rows ?? []) as EventRow[]) {
    if (Date.now() - started > budgetMs) break;

    // Claim it: whoever bumps `attempts` first works on it.
    const { data: claimed } = await db
      .from('hubspot_events')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('status', 'pending')
      .eq('attempts', row.attempts)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    summary.processed += 1;

    try {
      const outcome = await handleEvent(db, row);
      await db
        .from('hubspot_events')
        .update({
          status: outcome.status,
          event_type: outcome.eventType ?? null,
          contact_id: outcome.contactId ?? null,
          matched: !!outcome.contactId,
          skip_reason: outcome.skipReason ?? null,
          last_error: null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      summary.done += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not process the HubSpot event.';
      const failed = row.attempts + 1 >= MAX_ATTEMPTS;
      await db
        .from('hubspot_events')
        .update({
          status: failed ? 'failed' : 'pending',
          last_error: message,
          ...(failed ? { processed_at: new Date().toISOString() } : {}),
        })
        .eq('id', row.id);
      if (failed) summary.failed += 1;
      if (!(err instanceof RetryableError)) console.error('[hubspot/events] event failed:', err);
    }
  }
  return summary;
}
