// ============================================================
// Instant → HubSpot: the worker that pushes contacts and deals
// (server only).
//
// Database triggers (migration 120) queue every contact or deal change
// in hubspot_sync_queue; drainHubSpotQueue empties it once a minute
// from the webhook dispatch cron. Nothing here runs on a user's
// request, so a slow or failing HubSpot never touches a save.
//
// The rules are Zoho's (lib/zoho/push.ts):
//
//   ONE HUBSPOT CONTACT PER PERSON. Search by email and phone before
//   creating; a match is linked, not duplicated. HubSpot's own email
//   uniqueness backs this up — a 409 names the existing contact.
//
//   LIFECYCLE STAGE ON CREATE ONLY. Someone who arrived by messaging
//   gets the stage chosen in Settings (Lead by default); nobody's stage
//   is ever changed afterwards — HubSpot stages only move forward, and
//   that is the sales team's call.
//
//   NEVER OVERWRITE WITH LESS. Only fields Instant has are sent, and a
//   name that is just the phone number never replaces a real one.
//
//   NEVER DELETE. Removing something in Instant drops the link only.
//
//   NO ECHOES. Links store a fingerprint of what was last synced, and
//   the webhook ignores events for records we wrote moments ago.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  contactHash,
  fingerprint,
  phoneKey,
  splitName,
  type ContactRow,
} from '@/lib/zoho/push';
import { hubspotApiFetch } from './api';
import { isLifecycleStage, type LifecycleStage } from './lifecycle';

type Db = SupabaseClient;
type HubSpotObject = 'contacts' | 'deals';

/** HubSpot's default association type ids (HUBSPOT_DEFINED). */
export const ASSOC = {
  dealToContact: 3,
  communicationToContact: 81,
  noteToContact: 202,
} as const;

export { isLifecycleStage, type LifecycleStage } from './lifecycle';

const CONTACT_SELECT =
  'id, account_id, name, phone, email, company, instagram_id, messenger_id, created_via, is_spam, is_blocked';

/** Digits → "+digits", the form HubSpot shows and dials. */
function e164(phone: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}

/** The HubSpot properties for an Instant contact. */
export function contactProperties(
  c: ContactRow,
  opts: { creating: boolean; lifecycle?: LifecycleStage | null },
): Record<string, string> {
  const out: Record<string, string> = {};
  const name = splitName(c);
  if (name) {
    if (name.First_Name) out.firstname = name.First_Name;
    out.lastname = name.Last_Name;
  }
  const phone = e164(c.phone);
  if (phone) {
    // WhatsApp numbers are mobiles. `phone` is HubSpot's primary number,
    // so it is filled on create — and left alone afterwards, in case the
    // record keeps a landline there.
    out.mobilephone = phone;
    if (opts.creating) out.phone = phone;
  }
  if (c.email?.trim()) out.email = c.email.trim();
  if (c.company?.trim()) out.company = c.company.trim();
  if (opts.creating && opts.lifecycle) out.lifecyclestage = opts.lifecycle;
  return out;
}

/** "Contact already exists. Existing ID: 12345" → "12345". */
export function existingIdFromConflict(message: string | undefined): string | null {
  return message?.match(/Existing ID:\s*(\d+)/i)?.[1] ?? null;
}

/** The properties a VALIDATION_ERROR names as invalid. */
export function invalidPropertyNames(message: string | undefined): string[] {
  if (!message) return [];
  const names = [...message.matchAll(/"name"\s*:\s*"([a-z0-9_]+)"/gi)].map((m) => m[1]);
  return [...new Set(names)];
}

class PushError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

interface HsObject {
  id: string;
  properties?: Record<string, string | null>;
}

/** Create or update one record; returns its id. Retries without
 *  properties HubSpot rejects as invalid (a bad email, a lifecycle
 *  stage it will not move back to), and treats "already exists" as a
 *  match. */
async function writeObject(
  db: Db,
  accountId: string,
  object: HubSpotObject,
  properties: Record<string, string>,
  opts: { id?: string; associations?: unknown[] } = {},
): Promise<string> {
  let props = { ...properties };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await hubspotApiFetch<HsObject>(
      db,
      accountId,
      opts.id
        ? `/crm/v3/objects/${object}/${encodeURIComponent(opts.id)}`
        : `/crm/v3/objects/${object}`,
      {
        method: opts.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          properties: props,
          ...(!opts.id && opts.associations?.length ? { associations: opts.associations } : {}),
        }),
      },
    );
    if (res.data?.id) return String(res.data.id);

    if (res.status === 409) {
      const existing = existingIdFromConflict(res.error);
      if (existing) return existing;
    }
    if (res.status === 400) {
      const bad = invalidPropertyNames(res.error).filter((n) => n in props);
      if (bad.length > 0) {
        props = Object.fromEntries(Object.entries(props).filter(([k]) => !bad.includes(k)));
        continue;
      }
    }
    throw new PushError(res.error ?? `HubSpot refused the ${object.slice(0, -1)}.`, res.status);
  }
  throw new PushError(`HubSpot refused the ${object.slice(0, -1)}.`);
}

interface SearchResponse {
  results?: HsObject[];
}

/** Find this person in HubSpot. Phone matches are confirmed on our
 *  side; HubSpot's phone search is looser than "same number". */
async function findContact(db: Db, c: ContactRow): Promise<string | null> {
  const key = phoneKey(c.phone);
  const email = c.email?.trim().toLowerCase() || null;
  const phone = e164(c.phone);

  const groups = (calculated: boolean) => {
    const g: { filters: { propertyName: string; operator: string; value: string }[] }[] = [];
    if (email) g.push({ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] });
    if (key && calculated) {
      // HubSpot's normalised phone properties hold the number without
      // its country code.
      for (const p of ['hs_searchable_calculated_mobile_number', 'hs_searchable_calculated_phone_number']) {
        g.push({ filters: [{ propertyName: p, operator: 'EQ', value: key }] });
      }
    }
    if (phone) {
      for (const p of ['mobilephone', 'phone']) {
        g.push({ filters: [{ propertyName: p, operator: 'EQ', value: phone }] });
      }
    }
    return g.slice(0, 5);
  };

  const search = (calculated: boolean) =>
    hubspotApiFetch<SearchResponse>(db, c.account_id, '/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: groups(calculated),
        properties: ['email', 'phone', 'mobilephone'],
        limit: 10,
      }),
    });

  if (groups(true).length === 0) return null;
  let res = await search(true);
  // A portal that rejects the calculated phone properties: search the
  // plain ones instead rather than failing every push.
  if (res.status === 400) res = await search(false);
  // Any other failure stops here: carrying on would create a contact
  // who may well exist. The queue retries.
  if (res.error) throw new PushError(res.error, res.status);

  const hits = res.data?.results ?? [];
  const match = hits.find((h) => {
    const p = h.properties ?? {};
    if (email && (p.email ?? '').toLowerCase() === email) return true;
    return !!key && [p.phone, p.mobilephone].some((v) => phoneKey(v) === key);
  });
  return match ? String(match.id) : null;
}

interface LinkRow {
  id: string;
  hubspot_object: HubSpotObject;
  hubspot_id: string;
  synced_hash: string | null;
}

async function getLink(db: Db, accountId: string, entity: 'contact' | 'deal', localId: string) {
  const { data } = await db
    .from('hubspot_record_links')
    .select('id, hubspot_object, hubspot_id, synced_hash')
    .eq('account_id', accountId)
    .eq('entity', entity)
    .eq('local_id', localId)
    .maybeSingle();
  return (data as LinkRow | null) ?? null;
}

export async function saveHubSpotLink(
  db: Db,
  accountId: string,
  entity: 'contact' | 'deal',
  localId: string,
  object: HubSpotObject,
  hubspotId: string,
  hash: string | null,
  pushed: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  // A HubSpot record links to one Instant record; the newer link wins.
  await db
    .from('hubspot_record_links')
    .delete()
    .eq('account_id', accountId)
    .eq('hubspot_object', object)
    .eq('hubspot_id', hubspotId)
    .neq('local_id', localId);
  await db.from('hubspot_record_links').upsert(
    {
      account_id: accountId,
      entity,
      local_id: localId,
      hubspot_object: object,
      hubspot_id: hubspotId,
      synced_hash: hash,
      ...(pushed ? { pushed_at: now } : {}),
      updated_at: now,
    },
    { onConflict: 'account_id,entity,local_id' },
  );
}

export interface PushOutcome {
  /** Kept on the queue row for diagnosis. */
  note?: string;
  skipped?: boolean;
}

export interface PushContactOptions {
  /** "Create contacts in HubSpot". Off: only find and link people who
   *  are already there, so a deal can still be attached to them. */
  create: boolean;
  /** Lifecycle stage for someone who arrived by messaging. */
  lifecycle: LifecycleStage;
}

async function pushContact(
  db: Db,
  contactId: string,
  opts: PushContactOptions,
): Promise<{ link: LinkRow | null; outcome: PushOutcome }> {
  const { data } = await db.from('contacts').select(CONTACT_SELECT).eq('id', contactId).maybeSingle();
  const c = data as ContactRow | null;
  if (!c) return { link: null, outcome: { skipped: true } };
  // Spam and blocked contacts are not prospects; sync is automatic, so
  // this is what keeps them out of the CRM.
  if (c.is_spam || c.is_blocked) return { link: null, outcome: { skipped: true } };
  // Nothing to match an Instagram or Messenger contact on.
  if (!c.phone && !c.email?.trim()) return { link: null, outcome: { skipped: true } };

  const hash = contactHash(c);
  const existing = await getLink(db, c.account_id, 'contact', c.id);

  if (existing) {
    if (existing.synced_hash === hash || !opts.create) return { link: existing, outcome: {} };
    try {
      await writeObject(db, c.account_id, 'contacts', contactProperties(c, { creating: false }), {
        id: existing.hubspot_id,
      });
    } catch (err) {
      // Deleted in HubSpot since we linked it: forget the link and find
      // or create again, rather than failing forever.
      if (err instanceof PushError && err.status === 404) {
        await db.from('hubspot_record_links').delete().eq('id', existing.id);
        return pushContact(db, contactId, opts);
      }
      throw err;
    }
    await saveHubSpotLink(db, c.account_id, 'contact', c.id, 'contacts', existing.hubspot_id, hash, true);
    return { link: { ...existing, synced_hash: hash }, outcome: {} };
  }

  const found = await findContact(db, c);
  if (found) {
    // Link without writing: their record may be more complete than
    // ours. Edits made in Instant from now on flow over.
    await saveHubSpotLink(db, c.account_id, 'contact', c.id, 'contacts', found, hash, false);
    return {
      link: { id: '', hubspot_object: 'contacts', hubspot_id: found, synced_hash: hash },
      outcome: { note: 'Linked to an existing HubSpot contact.' },
    };
  }

  if (!opts.create) return { link: null, outcome: { skipped: true } };

  const id = await writeObject(
    db,
    c.account_id,
    'contacts',
    contactProperties(c, {
      creating: true,
      lifecycle: c.created_via === 'conversation' ? opts.lifecycle : null,
    }),
  );
  await saveHubSpotLink(db, c.account_id, 'contact', c.id, 'contacts', id, hash, true);
  return {
    link: { id: '', hubspot_object: 'contacts', hubspot_id: id, synced_hash: hash },
    outcome: {},
  };
}

// ── Deals ───────────────────────────────────────────────────

export interface HubSpotStage {
  id: string;
  label: string;
  closed: boolean;
  /** Closed and counted as won (probability 1). */
  won: boolean;
}

export interface HubSpotPipeline {
  id: string;
  label: string;
  stages: HubSpotStage[];
}

interface PipelinesResponse {
  results?: {
    id: string;
    label?: string;
    displayOrder?: number;
    archived?: boolean;
    stages?: {
      id: string;
      label?: string;
      displayOrder?: number;
      archived?: boolean;
      metadata?: { isClosed?: string | boolean; probability?: string | number };
    }[];
  }[];
}

/** The pipeline deals go into: HubSpot's default one, else the first. */
export function pickPipeline(json: PipelinesResponse | undefined): HubSpotPipeline | null {
  const pipelines = (json?.results ?? []).filter((p) => !p.archived);
  if (pipelines.length === 0) return null;
  const chosen =
    pipelines.find((p) => p.id === 'default') ??
    [...pipelines].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))[0];
  const stages = (chosen.stages ?? [])
    .filter((s) => !s.archived)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((s) => {
      const closed = String(s.metadata?.isClosed) === 'true';
      const probability = Number(s.metadata?.probability ?? NaN);
      return { id: s.id, label: s.label ?? s.id, closed, won: closed && probability >= 1 };
    });
  return { id: chosen.id, label: chosen.label ?? chosen.id, stages };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The HubSpot stage for an Instant deal: won/lost by the stage's own
 *  metadata, then a stage of the same name, then a similar one, then
 *  the first open stage. */
export function mapHubSpotStage(
  stages: HubSpotStage[],
  stageName: string | null,
  status: 'open' | 'won' | 'lost' | null,
): { stage: HubSpotStage | null; note?: string } {
  if (stages.length === 0) return { stage: null };
  if (status === 'won') {
    const won = stages.find((s) => s.won);
    if (won) return { stage: won };
  }
  if (status === 'lost') {
    const lost = stages.find((s) => s.closed && !s.won);
    if (lost) return { stage: lost };
  }
  const open = stages.filter((s) => !s.closed);
  if (stageName) {
    const n = norm(stageName);
    const exact = stages.find((s) => norm(s.label) === n);
    if (exact) return { stage: exact };
    const loose = open.find((s) => n && (norm(s.label).includes(n) || n.includes(norm(s.label))));
    if (loose) return { stage: loose };
  }
  const fallback = open[0] ?? stages[0];
  return {
    stage: fallback,
    note: stageName
      ? `Stage "${stageName}" has no match in HubSpot, so "${fallback.label}" was used. Rename one to match.`
      : undefined,
  };
}

/** The deal pipeline, cached a day on the connection. */
async function dealPipeline(db: Db, accountId: string): Promise<HubSpotPipeline | null> {
  const { data: conn } = await db
    .from('hubspot_connections')
    .select('deal_pipeline, deal_pipeline_at')
    .eq('account_id', accountId)
    .maybeSingle();
  const cached = (conn?.deal_pipeline as HubSpotPipeline | null) ?? null;
  const fresh =
    conn?.deal_pipeline_at &&
    Date.now() - Date.parse(conn.deal_pipeline_at as string) < 24 * 3600 * 1000;
  if (cached?.stages?.length && fresh) return cached;

  const res = await hubspotApiFetch<PipelinesResponse>(db, accountId, '/crm/v3/pipelines/deals');
  const pipeline = pickPipeline(res.data);
  if (pipeline) {
    await db
      .from('hubspot_connections')
      .update({ deal_pipeline: pipeline, deal_pipeline_at: new Date().toISOString() })
      .eq('account_id', accountId);
    return pipeline;
  }
  return cached;
}

interface DealRow {
  id: string;
  account_id: string;
  title: string;
  value: number | null;
  status: 'open' | 'won' | 'lost' | null;
  contact_id: string | null;
  expected_close_date: string | null;
  stage: { name: string | null } | null;
}

async function pushDeal(db: Db, dealId: string, people: PushContactOptions): Promise<PushOutcome> {
  const { data } = await db
    .from('deals')
    .select('id, account_id, title, value, status, contact_id, expected_close_date, stage:pipeline_stages(name)')
    .eq('id', dealId)
    .maybeSingle();
  const d = data as unknown as DealRow | null;
  if (!d) return { skipped: true };

  const pipeline = await dealPipeline(db, d.account_id);
  const { stage, note } = mapHubSpotStage(pipeline?.stages ?? [], d.stage?.name ?? null, d.status);

  // The person first: the deal is associated with them.
  let personId: string | null = null;
  if (d.contact_id) personId = (await pushContact(db, d.contact_id, people)).link?.hubspot_id ?? null;

  const properties: Record<string, string> = {
    dealname: d.title,
    amount: String(Number(d.value ?? 0)),
  };
  if (d.expected_close_date) properties.closedate = d.expected_close_date.slice(0, 10);
  if (pipeline && stage) {
    properties.pipeline = pipeline.id;
    properties.dealstage = stage.id;
  }

  const hash = fingerprint({ ...properties, person: personId });
  const existing = await getLink(db, d.account_id, 'deal', d.id);

  if (existing) {
    if (existing.synced_hash === hash) return { note };
    await writeObject(db, d.account_id, 'deals', properties, { id: existing.hubspot_id });
    if (personId) await associateDeal(db, d.account_id, existing.hubspot_id, personId);
    await saveHubSpotLink(db, d.account_id, 'deal', d.id, 'deals', existing.hubspot_id, hash, true);
    return { note };
  }

  const id = await writeObject(db, d.account_id, 'deals', properties, {
    associations: personId
      ? [
          {
            to: { id: personId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOC.dealToContact }],
          },
        ]
      : [],
  });
  await saveHubSpotLink(db, d.account_id, 'deal', d.id, 'deals', id, hash, true);
  return { note };
}

/** Attach a deal to its person — a no-op when they already are. */
async function associateDeal(db: Db, accountId: string, dealId: string, contactId: string) {
  const res = await hubspotApiFetch(
    db,
    accountId,
    `/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/default/contacts/${encodeURIComponent(contactId)}`,
    { method: 'PUT' },
  );
  if (res.error) console.error('[hubspot/push] deal association failed:', res.error);
}

// ── The queue ───────────────────────────────────────────────

/** Minutes to wait after the Nth failure; then 'failed', and the cron
 *  gives it a fresh round a day later. */
const BACKOFF_MIN = [1, 5, 30, 120, 360];
const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;

interface QueueRow {
  id: string;
  account_id: string;
  entity: 'contact' | 'deal';
  local_id: string;
  attempts: number;
  next_retry_at: string;
  updated_at: string;
}

export interface DrainSummary {
  processed: number;
  done: number;
  failed: number;
}

export async function drainHubSpotQueue(
  db: Db,
  { limit = 40, budgetMs = 20_000 }: { limit?: number; budgetMs?: number } = {},
): Promise<DrainSummary> {
  const started = Date.now();
  const summary: DrainSummary = { processed: 0, done: 0, failed: 0 };

  const { data: due } = await db
    .from('hubspot_sync_queue')
    .select('id, account_id, entity, local_id, attempts, next_retry_at, updated_at')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    // Contacts before deals: a deal needs its person linked first.
    .order('entity', { ascending: true })
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  const flagsByAccount = new Map<
    string,
    { contacts: boolean; deals: boolean; lifecycle: LifecycleStage } | null
  >();

  for (const row of (due ?? []) as QueueRow[]) {
    if (Date.now() - started > budgetMs) break;

    // Claim it, so an overlapping run skips it.
    const { data: claimed } = await db
      .from('hubspot_sync_queue')
      .update({ next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq('id', row.id)
      .eq('next_retry_at', row.next_retry_at)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    summary.processed += 1;

    if (!flagsByAccount.has(row.account_id)) {
      const { data: conn } = await db
        .from('hubspot_connections')
        .select('is_active, push_contacts, push_deals, chat_lifecycle_stage')
        .eq('account_id', row.account_id)
        .maybeSingle();
      flagsByAccount.set(
        row.account_id,
        conn?.is_active
          ? {
              contacts: !!conn.push_contacts,
              deals: !!conn.push_deals,
              lifecycle: isLifecycleStage(conn.chat_lifecycle_stage) ? conn.chat_lifecycle_stage : 'lead',
            }
          : null,
      );
    }
    const flags = flagsByAccount.get(row.account_id);

    let status: 'done' | 'skipped' | 'pending' | 'failed' = 'done';
    let lastError: string | null = null;
    let nextRetry: string | null = null;
    let attempts = row.attempts;

    if (!flags || !(row.entity === 'contact' ? flags.contacts : flags.deals)) {
      status = 'skipped';
    } else {
      try {
        const outcome =
          row.entity === 'contact'
            ? (await pushContact(db, row.local_id, { create: true, lifecycle: flags.lifecycle })).outcome
            : await pushDeal(db, row.local_id, { create: flags.contacts, lifecycle: flags.lifecycle });
        status = outcome.skipped ? 'skipped' : 'done';
        lastError = outcome.note ?? null;
        summary.done += 1;
      } catch (err) {
        attempts += 1;
        lastError = err instanceof Error ? err.message : 'HubSpot sync failed.';
        if (attempts >= MAX_ATTEMPTS) {
          status = 'failed';
          summary.failed += 1;
        } else {
          status = 'pending';
          nextRetry = new Date(Date.now() + BACKOFF_MIN[attempts - 1] * 60_000).toISOString();
        }
      }
    }

    // Finish only if no newer change arrived meanwhile; if one did, it
    // stays pending and the next run pushes the latest state.
    const finish: Record<string, unknown> = { status, attempts, last_error: lastError };
    if (nextRetry) finish.next_retry_at = nextRetry;
    const { data: finished } = await db
      .from('hubspot_sync_queue')
      .update(finish)
      .eq('id', row.id)
      .eq('updated_at', row.updated_at)
      .select('id')
      .maybeSingle();
    if (!finished && status !== 'pending') {
      await db
        .from('hubspot_sync_queue')
        .update({ next_retry_at: new Date().toISOString(), attempts: 0 })
        .eq('id', row.id);
    }
  }

  // Finished work older than a week is history.
  await db
    .from('hubspot_sync_queue')
    .delete()
    .in('status', ['done', 'skipped'])
    .lt('updated_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

  return summary;
}

// ── Links into HubSpot ──────────────────────────────────────

/** The portal's contacts list, for "Open HubSpot". */
export function hubspotHomeUrl(uiDomain: string | null, portalId: string | null): string | null {
  if (!portalId) return null;
  return `https://${uiDomain || 'app.hubspot.com'}/contacts/${portalId}/objects/0-1/views/all/list`;
}

/** A record's page in HubSpot. */
export function hubspotRecordUrl(
  uiDomain: string | null,
  portalId: string | null,
  object: HubSpotObject,
  id: string,
): string | null {
  if (!portalId) return null;
  const type = object === 'contacts' ? '0-1' : '0-3';
  return `https://${uiDomain || 'app.hubspot.com'}/contacts/${portalId}/record/${type}/${id}`;
}
