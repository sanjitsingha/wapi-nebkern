// ============================================================
// Instant → Zoho: the worker that pushes contacts and deals (server only).
//
// Database triggers (migration 111) put every contact or deal change
// in zoho_sync_queue; drainZohoQueue empties it, once a minute, from
// the webhook dispatch cron. Nothing here runs on a user's request, so
// a slow or failing Zoho never touches a save.
//
// ── The rules ──
//
//   ONE ZOHO RECORD PER PERSON. Before creating anything we search
//   Zoho by phone (then email). A match is linked, not duplicated.
//
//   LEAD OR CONTACT. Someone who arrived by messaging you
//   (created_via = 'conversation') is a prospect → Lead. Someone you
//   added or imported is known to you → Contact. An existing Zoho
//   record keeps whatever module it is in.
//
//   A DEAL QUALIFIES A LEAD. A deal for a person who is a Lead uses
//   Zoho's own conversion — Lead becomes Contact + Deal, history kept —
//   rather than a second record beside the Lead.
//
//   NEVER OVERWRITE WITH LESS. Only fields Instant actually has are
//   sent, and a name that is just the phone number (what a WhatsApp
//   contact gets before they share one) never replaces a real name.
//
//   NEVER DELETE. Removing something in Instant drops the link only.
//
//   NO ECHOES. Each link stores a fingerprint of what was last synced;
//   an unchanged record is not pushed, and the webhook ignores Zoho
//   events for records we touched moments ago (link.pushed_at).
// ============================================================

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { zohoApiFetch, type ZohoCallResult } from './api';

type Db = SupabaseClient;
type ZohoModule = 'Leads' | 'Contacts' | 'Deals';

/** A Zoho record id as the API returns it, in any of its shapes. */
function idOf(v: unknown): string | null {
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && 'id' in v) return idOf((v as { id: unknown }).id);
  return null;
}

/** Last ten digits — how two spellings of one Indian mobile compare.
 *  Zoho stores whatever was typed: "+91 98…", "098…", "98…". */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-10) : null;
}

export function fingerprint(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);
}

// ── Contacts ────────────────────────────────────────────────

export interface ContactRow {
  id: string;
  account_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  instagram_id: string | null;
  messenger_id: string | null;
  created_via: string | null;
}

const CONTACT_SELECT =
  'id, account_id, name, phone, email, company, instagram_id, messenger_id, created_via';

/** A "name" that is really an identifier: the phone, an IGSID, a PSID.
 *  WhatsApp contacts carry their number as a name until they share one. */
function isPlaceholderName(c: ContactRow): boolean {
  const n = (c.name ?? '').trim();
  if (!n) return true;
  if (/^[+\d\s()-]+$/.test(n)) return true;
  return n === c.instagram_id || n === c.messenger_id;
}

/** Zoho needs Last_Name on both Leads and Contacts. */
export function splitName(c: ContactRow): { First_Name?: string; Last_Name: string } | null {
  if (isPlaceholderName(c)) return null;
  const parts = (c.name as string).trim().split(/\s+/);
  if (parts.length === 1) return { Last_Name: parts[0] };
  return { First_Name: parts.slice(0, -1).join(' '), Last_Name: parts[parts.length - 1] };
}

/** The fields Instant owns for a person, normalised for hashing. */
function contactFacts(c: ContactRow) {
  return {
    name: isPlaceholderName(c) ? null : (c.name ?? '').trim(),
    phone: c.phone ?? null,
    email: c.email?.trim() || null,
    company: c.company?.trim() || null,
  };
}

export function contactHash(c: ContactRow): string {
  return fingerprint(contactFacts(c));
}

/** Fields to write. `creating` fills Zoho's required fields with
 *  something sensible when Instant has nothing better. */
export function contactPayload(
  c: ContactRow,
  module: 'Leads' | 'Contacts',
  creating: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const name = splitName(c);
  if (name) Object.assign(out, name);
  else if (creating) out.Last_Name = c.phone || c.email || 'WhatsApp contact';

  if (c.phone) out.Mobile = c.phone;
  if (c.email?.trim()) out.Email = c.email.trim();

  if (module === 'Leads') {
    // Company is required on a Lead in a default Zoho org.
    if (c.company?.trim()) out.Company = c.company.trim();
    else if (creating) out.Company = name ? [name.First_Name, name.Last_Name].filter(Boolean).join(' ') : 'WhatsApp';
    if (creating) out.Lead_Source = 'WhatsApp';
  }
  return out;
}

interface LinkRow {
  id: string;
  zoho_module: ZohoModule;
  zoho_id: string;
  synced_hash: string | null;
}

async function getLink(db: Db, accountId: string, entity: 'contact' | 'deal', localId: string) {
  const { data } = await db
    .from('zoho_record_links')
    .select('id, zoho_module, zoho_id, synced_hash')
    .eq('account_id', accountId)
    .eq('entity', entity)
    .eq('local_id', localId)
    .maybeSingle();
  return (data as LinkRow | null) ?? null;
}

export async function saveLink(
  db: Db,
  accountId: string,
  entity: 'contact' | 'deal',
  localId: string,
  module: ZohoModule,
  zohoId: string,
  hash: string | null,
  pushed: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  // A Zoho record can be linked to one Instant record only. If another
  // already holds it (two Instant contacts with one number in Zoho),
  // the newer link wins rather than the upsert failing forever.
  await db
    .from('zoho_record_links')
    .delete()
    .eq('account_id', accountId)
    .eq('zoho_module', module)
    .eq('zoho_id', zohoId)
    .neq('local_id', localId);
  await db.from('zoho_record_links').upsert(
    {
      account_id: accountId,
      entity,
      local_id: localId,
      zoho_module: module,
      zoho_id: zohoId,
      synced_hash: hash,
      ...(pushed ? { pushed_at: now } : {}),
      updated_at: now,
    },
    { onConflict: 'account_id,entity,local_id' },
  );
}

interface ZohoWriteResponse {
  data?: {
    code?: string;
    status?: string;
    message?: string;
    details?: Record<string, unknown>;
  }[];
}

class PushError extends Error {
  constructor(
    message: string,
    /** Zoho's error code and the field it named, when it gave them. */
    readonly code?: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

/** Create or update one record; returns its id. Retries once without
 *  a field Zoho rejected as invalid (a picklist value the org lacks,
 *  like our Lead_Source), and treats DUPLICATE_DATA as "this exists"
 *  — Zoho's duplicate check found the record our search missed. */
async function writeRecord(
  db: Db,
  accountId: string,
  module: ZohoModule,
  fields: Record<string, unknown>,
  id?: string,
): Promise<string> {
  let body = { ...fields };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res: ZohoCallResult<ZohoWriteResponse> = await zohoApiFetch(
      db,
      accountId,
      id ? `/crm/v5/${module}/${encodeURIComponent(id)}` : `/crm/v5/${module}`,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify({ data: [body] }) },
    );
    const row = res.data?.data?.[0];
    if (row?.status === 'success') {
      const newId = idOf(row.details?.id) ?? id;
      if (!newId) throw new PushError(`Zoho saved the ${module} record but returned no id.`);
      return newId;
    }
    if (row?.code === 'DUPLICATE_DATA') {
      const dup = idOf(row.details?.duplicate_record) ?? idOf(row.details?.id);
      if (dup) return dup;
    }
    const field = typeof row?.details?.api_name === 'string' ? row.details.api_name : null;
    if (row?.code === 'INVALID_DATA' && field && field in body && field !== 'Last_Name') {
      const { [field]: _dropped, ...rest } = body;
      void _dropped;
      body = rest;
      continue;
    }
    if (row?.code === 'MANDATORY_NOT_FOUND' && field) {
      throw new PushError(
        `Zoho requires "${field}" on ${module}, and Instant has no value for it. Make the field optional in Zoho, or fill it in.`,
      );
    }
    throw new PushError(
      res.error ?? row?.message ?? `Zoho refused the ${module} record.`,
      row?.code,
      field ?? undefined,
    );
  }
  throw new PushError(`Zoho refused the ${module} record.`);
}

interface SearchHit {
  id: string;
  module: 'Leads' | 'Contacts';
}

/** Find this person in Zoho, Contacts first (the more qualified
 *  record), then Leads. Phone matches are confirmed on our side —
 *  Zoho's phone search is looser than "same number". */
async function findInZoho(db: Db, c: ContactRow): Promise<SearchHit | null> {
  const key = phoneKey(c.phone);
  for (const zm of ['Contacts', 'Leads'] as const) {
    if (key) {
      const res = await zohoApiFetch<{ data?: Record<string, unknown>[] }>(
        db,
        c.account_id,
        `/crm/v5/${zm}/search?phone=${encodeURIComponent(key)}`,
      );
      // Any failed search stops here. Carrying on would create a
      // record for someone who may well exist — the duplicate this
      // whole function is for avoiding. The queue retries.
      if (res.error) throw new PushError(res.error);
      const hit = (res.data?.data ?? []).find((r) =>
        ['Mobile', 'Phone', 'Other_Phone', 'Home_Phone', 'Asst_Phone'].some(
          (f) => phoneKey(r[f] as string | null) === key,
        ),
      );
      const id = hit && idOf(hit.id);
      if (id) return { id, module: zm };
    }
    const email = c.email?.trim();
    if (email) {
      const res = await zohoApiFetch<{ data?: Record<string, unknown>[] }>(
        db,
        c.account_id,
        `/crm/v5/${zm}/search?email=${encodeURIComponent(email)}`,
      );
      if (res.error) throw new PushError(res.error);
      const id = idOf(res.data?.data?.[0]?.id);
      if (id) return { id, module: zm };
    }
  }
  return null;
}

export interface PushOutcome {
  /** Set when the push did something worth noting without failing —
   *  shown in Settings next to the record. */
  note?: string;
  skipped?: boolean;
}

/** Create, link or update one contact. Returns its link (or null when
 *  there is nothing to identify the person by). */
async function pushContact(db: Db, contactId: string): Promise<{ link: LinkRow | null; outcome: PushOutcome }> {
  const { data } = await db.from('contacts').select(CONTACT_SELECT).eq('id', contactId).maybeSingle();
  const c = data as ContactRow | null;
  if (!c) return { link: null, outcome: { skipped: true } };
  if (!c.phone && !c.email?.trim()) {
    // An Instagram or Messenger contact with nothing to match on.
    // Skipped quietly: it is not a problem, and listing every one would
    // bury the real failures in Settings.
    return { link: null, outcome: { skipped: true } };
  }

  const hash = contactHash(c);
  const existing = await getLink(db, c.account_id, 'contact', c.id);

  if (existing && existing.zoho_module !== 'Deals') {
    if (existing.synced_hash === hash) return { link: existing, outcome: {} };
    try {
      await writeRecord(
        db,
        c.account_id,
        existing.zoho_module,
        contactPayload(c, existing.zoho_module, false),
        existing.zoho_id,
      );
    } catch (err) {
      // Deleted in Zoho since we linked it: forget the link and fall
      // through to find-or-create, rather than failing forever.
      if (err instanceof PushError && err.code === 'INVALID_DATA' && err.field === 'id') {
        await db.from('zoho_record_links').delete().eq('id', existing.id);
        return pushContact(db, contactId);
      }
      throw err;
    }
    await saveLink(db, c.account_id, 'contact', c.id, existing.zoho_module, existing.zoho_id, hash, true);
    return { link: { ...existing, synced_hash: hash }, outcome: {} };
  }

  const found = await findInZoho(db, c);
  if (found) {
    // Someone already keeps this person in Zoho. Link without writing:
    // their record may be more complete than ours, and Zoho's PUT has
    // no "only if blank". Edits made in Instant from now on flow over.
    await saveLink(db, c.account_id, 'contact', c.id, found.module, found.id, hash, false);
    return {
      link: { id: '', zoho_module: found.module, zoho_id: found.id, synced_hash: hash },
      outcome: { note: `Linked to an existing Zoho ${found.module === 'Leads' ? 'Lead' : 'Contact'}.` },
    };
  }

  const target: 'Leads' | 'Contacts' = c.created_via === 'conversation' ? 'Leads' : 'Contacts';
  const id = await writeRecord(db, c.account_id, target, contactPayload(c, target, true));
  await saveLink(db, c.account_id, 'contact', c.id, target, id, hash, true);
  return {
    link: { id: '', zoho_module: target, zoho_id: id, synced_hash: hash },
    outcome: {},
  };
}

// ── Deals ───────────────────────────────────────────────────

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

/** The Stage picklist of the org's Deals module, cached a day on the
 *  connection. Deal stages are org-specific and Zoho rejects a value
 *  it does not have. */
async function zohoDealStages(db: Db, accountId: string): Promise<string[]> {
  const { data: conn } = await db
    .from('zoho_connections')
    .select('deal_stages, deal_stages_at')
    .eq('account_id', accountId)
    .maybeSingle();
  const cached = Array.isArray(conn?.deal_stages) ? (conn.deal_stages as string[]) : null;
  const fresh =
    conn?.deal_stages_at && Date.now() - Date.parse(conn.deal_stages_at as string) < 24 * 3600 * 1000;
  if (cached && cached.length && fresh) return cached;

  const res = await zohoApiFetch<{
    fields?: { api_name?: string; pick_list_values?: { display_value?: string; actual_value?: string }[] }[];
  }>(db, accountId, '/crm/v5/settings/fields?module=Deals');
  const stage = res.data?.fields?.find((f) => f.api_name === 'Stage');
  const values = (stage?.pick_list_values ?? [])
    .map((v) => v.actual_value ?? v.display_value)
    .filter((v): v is string => !!v && v !== '-None-');
  if (values.length) {
    await db
      .from('zoho_connections')
      .update({ deal_stages: values, deal_stages_at: new Date().toISOString() })
      .eq('account_id', accountId);
    return values;
  }
  return cached ?? [];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Pick the Zoho stage for an Instant deal. Won/lost win over the
 *  stage name; then an exact name match; then a contained one. */
export function mapStage(
  stages: string[],
  stageName: string | null,
  status: DealRow['status'],
): { stage: string | null; note?: string } {
  if (!stages.length) return { stage: stageName };
  if (status === 'won' || status === 'lost') {
    const want = status === 'won' ? 'closedwon' : 'closedlost';
    const hit = stages.find((s) => norm(s) === want) ?? stages.find((s) => norm(s).includes(status));
    if (hit) return { stage: hit };
  }
  if (stageName) {
    const n = norm(stageName);
    const exact = stages.find((s) => norm(s) === n);
    if (exact) return { stage: exact };
    const loose = stages.find((s) => n && (norm(s).includes(n) || n.includes(norm(s))));
    if (loose) return { stage: loose };
  }
  const fallback = stages.find((s) => !/closed/i.test(s)) ?? stages[0];
  return {
    stage: fallback,
    note: stageName
      ? `Stage "${stageName}" has no match in Zoho, so "${fallback}" was used. Rename one to match.`
      : undefined,
  };
}

function closingDate(d: DealRow): string {
  if (d.expected_close_date) return d.expected_close_date.slice(0, 10);
  // Required by Zoho. A month out is the usual default.
  return new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

interface ConvertResponse {
  data?: { status?: string; code?: string; message?: string; details?: Record<string, unknown> }[];
}

async function pushDeal(db: Db, dealId: string): Promise<PushOutcome> {
  const { data } = await db
    .from('deals')
    .select('id, account_id, title, value, status, contact_id, expected_close_date, stage:pipeline_stages(name)')
    .eq('id', dealId)
    .maybeSingle();
  const d = data as unknown as DealRow | null;
  if (!d) return { skipped: true };

  const stages = await zohoDealStages(db, d.account_id);
  const { stage, note } = mapStage(stages, d.stage?.name ?? null, d.status);

  // The person first: a deal is attached to them in Zoho.
  let personLink: LinkRow | null = null;
  if (d.contact_id) personLink = (await pushContact(db, d.contact_id)).link;

  const fields: Record<string, unknown> = {
    Deal_Name: d.title,
    Amount: Number(d.value ?? 0),
    Closing_Date: closingDate(d),
  };
  if (stage) fields.Stage = stage;
  if (personLink?.zoho_module === 'Contacts') fields.Contact_Name = { id: personLink.zoho_id };

  const hash = fingerprint({ ...fields, person: personLink?.zoho_id ?? null });
  const existing = await getLink(db, d.account_id, 'deal', d.id);

  if (existing) {
    if (existing.synced_hash === hash) return { note };
    await writeRecord(db, d.account_id, 'Deals', fields, existing.zoho_id);
    await saveLink(db, d.account_id, 'deal', d.id, 'Deals', existing.zoho_id, hash, true);
    return { note };
  }

  // A deal for a Lead: convert it. Zoho turns the Lead into a Contact
  // (and an Account when it has a company) and creates the Deal on it.
  if (personLink?.zoho_module === 'Leads' && d.contact_id) {
    const res = await zohoApiFetch<ConvertResponse>(
      db,
      d.account_id,
      `/crm/v5/Leads/${encodeURIComponent(personLink.zoho_id)}/actions/convert`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: [
            {
              overwrite: true,
              notify_lead_owner: false,
              notify_new_entity_owner: false,
              Deals: fields,
            },
          ],
        }),
      },
    );
    const row = res.data?.data?.[0];
    const contactZohoId = idOf(row?.details?.Contacts);
    const dealZohoId = idOf(row?.details?.Deals);
    if (!contactZohoId || !dealZohoId) {
      throw new PushError(res.error ?? row?.message ?? 'Zoho could not convert the Lead.');
    }
    // The person is a Contact now; re-point their link so later edits
    // go to the record that exists.
    const { data: contact } = await db.from('contacts').select(CONTACT_SELECT).eq('id', d.contact_id).maybeSingle();
    await saveLink(
      db,
      d.account_id,
      'contact',
      d.contact_id,
      'Contacts',
      contactZohoId,
      contact ? contactHash(contact as ContactRow) : null,
      true,
    );
    await saveLink(
      db,
      d.account_id,
      'deal',
      d.id,
      'Deals',
      dealZohoId,
      fingerprint({ ...fields, Contact_Name: { id: contactZohoId }, person: contactZohoId }),
      true,
    );
    return { note: note ?? 'Converted the Zoho Lead into a Contact with this deal.' };
  }

  const id = await writeRecord(db, d.account_id, 'Deals', fields);
  await saveLink(db, d.account_id, 'deal', d.id, 'Deals', id, hash, true);
  return { note };
}

// ── The queue ───────────────────────────────────────────────

/** Minutes to wait after the Nth failure. Six tries over ~9 hours,
 *  then 'failed' — visible in Settings with a Retry button. */
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

export async function drainZohoQueue(
  db: Db,
  { limit = 40, budgetMs = 40_000 }: { limit?: number; budgetMs?: number } = {},
): Promise<DrainSummary> {
  const started = Date.now();
  const summary: DrainSummary = { processed: 0, done: 0, failed: 0 };

  const { data: due } = await db
    .from('zoho_sync_queue')
    .select('id, account_id, entity, local_id, attempts, next_retry_at, updated_at')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    // Contacts before deals: a deal needs its person linked first, and
    // usually both were queued by the same save.
    .order('entity', { ascending: true })
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  const pushable = new Map<string, { contacts: boolean; deals: boolean } | null>();

  for (const row of (due ?? []) as QueueRow[]) {
    if (Date.now() - started > budgetMs) break;

    // Claim it: push the retry time out, conditional on nobody else
    // having done so. A second worker (or an overlapping run) skips it.
    const { data: claimed } = await db
      .from('zoho_sync_queue')
      .update({ next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq('id', row.id)
      .eq('next_retry_at', row.next_retry_at)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    summary.processed += 1;

    if (!pushable.has(row.account_id)) {
      const { data: conn } = await db
        .from('zoho_connections')
        .select('is_active, push_contacts, push_deals')
        .eq('account_id', row.account_id)
        .maybeSingle();
      pushable.set(
        row.account_id,
        conn?.is_active ? { contacts: !!conn.push_contacts, deals: !!conn.push_deals } : null,
      );
    }
    const flags = pushable.get(row.account_id);

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
            ? (await pushContact(db, row.local_id)).outcome
            : await pushDeal(db, row.local_id);
        status = outcome.skipped ? 'skipped' : 'done';
        lastError = outcome.note ?? null;
        summary.done += 1;
      } catch (err) {
        attempts += 1;
        lastError = err instanceof Error ? err.message : 'Zoho sync failed.';
        if (attempts >= MAX_ATTEMPTS) {
          status = 'failed';
          summary.failed += 1;
        } else {
          status = 'pending';
          nextRetry = new Date(Date.now() + BACKOFF_MIN[attempts - 1] * 60_000).toISOString();
        }
      }
    }

    // Finish only if no newer change arrived while we worked (the
    // trigger bumps updated_at on the pending row). If one did, leave
    // it pending — the next run pushes the latest state.
    const finish: Record<string, unknown> = { status, attempts, last_error: lastError };
    if (nextRetry) finish.next_retry_at = nextRetry;
    const { data: finished } = await db
      .from('zoho_sync_queue')
      .update(finish)
      .eq('id', row.id)
      .eq('updated_at', row.updated_at)
      .select('id')
      .maybeSingle();
    if (!finished && status !== 'pending') {
      await db
        .from('zoho_sync_queue')
        .update({ next_retry_at: new Date().toISOString(), attempts: 0 })
        .eq('id', row.id);
    }
  }

  // Keep the table small: finished work older than a week is history.
  await db
    .from('zoho_sync_queue')
    .delete()
    .in('status', ['done', 'skipped'])
    .lt('updated_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

  return summary;
}

/** The Zoho web address for a record, for "Open in Zoho" links. */
export function zohoRecordUrl(
  apiDomain: string | null,
  orgId: string | null,
  module: ZohoModule,
  zohoId: string,
): string | null {
  if (!apiDomain || !orgId) return null;
  let host: string;
  try {
    host = new URL(apiDomain).host; // www.zohoapis.in
  } catch {
    return null;
  }
  const crm = host.endsWith('zohoapis.ca')
    ? 'crm.zohocloud.ca'
    : host.replace(/^www\.zohoapis\./, 'crm.zoho.');
  return `https://${crm}/crm/org${orgId}/tab/${module}/${zohoId}`;
}
