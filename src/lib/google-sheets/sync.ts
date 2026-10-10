import type { SupabaseClient } from '@supabase/supabase-js';

import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import {
  GoogleSheetsError,
  appendRows,
  googleSheetsClient,
  refreshGoogleToken,
} from './client';
import { campaignRow, contactRow, dealRow, type SheetTab } from './rows';

// ============================================================
// Getting rows into a connected Google Sheet.
//
//   enqueueSheetEvent    called from emitWebhookEvent: one cheap insert
//   drainSheetQueue      called by the webhooks cron every minute:
//                        formats queued events and appends them
//   exportFinishedCampaigns  same cron: a campaign's per-recipient
//                        results, once a day has passed since it sent
//
// Everything here is best-effort toward the rest of the app: nothing
// throws into the code path that caused an event, and a Google failure
// is recorded on the connection (shown in Settings) and retried.
// ============================================================

export interface SheetsConnection {
  account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  spreadsheet_id: string | null;
  sync_contacts: boolean;
  sync_deals: boolean;
  sync_campaigns: boolean;
  is_active: boolean;
  connected_at: string;
}

const CONNECTION_COLUMNS =
  'account_id, access_token, refresh_token, expires_at, spreadsheet_id, sync_contacts, sync_deals, sync_campaigns, is_active, connected_at';

/** Refresh this long before expiry rather than on the 401. */
const REFRESH_MARGIN_MS = 2 * 60_000;
/** Claimed rows are invisible to an overlapping run for this long. */
const LOCK_MS = 5 * 60_000;
const MAX_ATTEMPTS = 8;
const DRAIN_BATCH = 200;
/** Reads and replies keep arriving for about a day after a send. */
const CAMPAIGN_SETTLE_MS = 24 * 60 * 60_000;
const CAMPAIGNS_PER_RUN = 3;
const RECIPIENT_PAGE = 1000;
const MAX_CAMPAIGN_ROWS = 100_000;

/** Which tab an event goes to, and whether this connection wants it. */
function tabFor(eventType: string, c: SheetsConnection): SheetTab | null {
  if (eventType === 'contact.created') return c.sync_contacts ? 'Contacts' : null;
  if (eventType === 'deal.stage_changed') return c.sync_deals ? 'Deals' : null;
  return null;
}

/**
 * Queue an event for the account's sheet, if it has one that wants it.
 * Never throws: it runs inside the request that produced the event.
 */
export async function enqueueSheetEvent(
  db: SupabaseClient,
  accountId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (eventType !== 'contact.created' && eventType !== 'deal.stage_changed') return;
  try {
    const { data: conn } = await db
      .from('google_sheets_connections')
      .select(CONNECTION_COLUMNS)
      .eq('account_id', accountId)
      .eq('is_active', true)
      .not('spreadsheet_id', 'is', null)
      .maybeSingle();
    if (!conn) return;
    const tab = tabFor(eventType, conn as SheetsConnection);
    if (!tab) return;
    await db.from('google_sheets_rows').insert({
      account_id: accountId,
      tab,
      payload: { ...payload, at: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[google-sheets] enqueue failed:', err);
  }
}

/**
 * A working access token for a connection, refreshing and saving a new
 * one when the stored one is about to expire.
 */
export async function getAccessToken(
  db: SupabaseClient,
  conn: SheetsConnection,
): Promise<string> {
  if (!conn.refresh_token) {
    throw new GoogleSheetsError('Google Sheets is not authorised.', 'revoked');
  }
  const expiresAt = conn.expires_at ? Date.parse(conn.expires_at) : 0;
  if (conn.access_token && expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return decrypt(conn.access_token);
  }

  const client = googleSheetsClient();
  if (!client) {
    throw new GoogleSheetsError(
      'Google Sheets is not configured on this server (GOOGLE_CLIENT_SECRET).',
      'oauth_error',
    );
  }
  const tokens = await refreshGoogleToken({
    refreshToken: decrypt(conn.refresh_token),
    ...client,
  });
  await db
    .from('google_sheets_connections')
    .update({
      access_token: encrypt(tokens.accessToken),
      // Google rarely rotates it, but keep the new one when it does.
      ...(tokens.refreshToken ? { refresh_token: encrypt(tokens.refreshToken) } : {}),
      expires_at: new Date(tokens.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', conn.account_id);
  return tokens.accessToken;
}

/** Record a failure on the connection; a revoked grant also stops it. */
async function noteFailure(db: SupabaseClient, accountId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const revoked = err instanceof GoogleSheetsError && err.code === 'revoked';
  await db
    .from('google_sheets_connections')
    .update({
      last_error: message.slice(0, 500),
      last_error_at: new Date().toISOString(),
      ...(revoked ? { is_active: false } : {}),
    })
    .eq('account_id', accountId);
}

async function noteSuccess(db: SupabaseClient, accountId: string) {
  await db
    .from('google_sheets_connections')
    .update({
      last_written_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    })
    .eq('account_id', accountId);
}

interface QueuedRow {
  id: string;
  account_id: string;
  tab: SheetTab;
  payload: Record<string, unknown>;
  attempts: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Contacts tab rows, with email and tags looked up in one go. */
async function formatContacts(db: SupabaseClient, rows: QueuedRow[]): Promise<string[][]> {
  const ids = rows.map((r) => str(r.payload.contact_id)).filter((v): v is string => !!v);
  const { data: contacts } = await db
    .from('contacts')
    .select('id, name, phone, email, created_at, contact_tags(tags(name))')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const byId = new Map((contacts ?? []).map((c) => [c.id as string, c]));

  return rows.map((r) => {
    const id = str(r.payload.contact_id) ?? '';
    const c = byId.get(id) as
      | {
          name: string | null;
          phone: string | null;
          email: string | null;
          created_at: string | null;
          contact_tags?: { tags: { name: string } | { name: string }[] | null }[];
        }
      | undefined;
    const tags = (c?.contact_tags ?? []).flatMap((ct) =>
      Array.isArray(ct.tags) ? ct.tags.map((t) => t.name) : ct.tags ? [ct.tags.name] : [],
    );
    return contactRow({
      createdAt: c?.created_at ?? str(r.payload.at),
      contactId: id,
      // The event's own copy when the contact has since been deleted.
      name: c?.name ?? str(r.payload.name),
      phone: c?.phone ?? str(r.payload.phone),
      email: c?.email ?? null,
      tags,
    });
  });
}

/** Deals tab rows, with stage, pipeline and contact names looked up. */
async function formatDeals(db: SupabaseClient, rows: QueuedRow[]): Promise<string[][]> {
  const stageIds = new Set<string>();
  const pipelineIds = new Set<string>();
  const contactIds = new Set<string>();
  for (const r of rows) {
    for (const k of ['from_stage_id', 'to_stage_id']) {
      const v = str(r.payload[k]);
      if (v) stageIds.add(v);
    }
    const p = str(r.payload.pipeline_id);
    if (p) pipelineIds.add(p);
    const c = str(r.payload.contact_id);
    if (c) contactIds.add(c);
  }
  const none = ['00000000-0000-0000-0000-000000000000'];
  const [{ data: stages }, { data: pipelines }, { data: contacts }] = await Promise.all([
    db.from('pipeline_stages').select('id, name').in('id', stageIds.size ? [...stageIds] : none),
    db.from('pipelines').select('id, name').in('id', pipelineIds.size ? [...pipelineIds] : none),
    db.from('contacts').select('id, name, phone').in('id', contactIds.size ? [...contactIds] : none),
  ]);
  const name = (list: { id: string; name: string }[] | null, id: string | null) =>
    id ? (list ?? []).find((x) => x.id === id)?.name ?? null : null;

  return rows.map((r) => {
    const contact = (contacts ?? []).find((c) => c.id === str(r.payload.contact_id));
    const value = r.payload.value;
    return dealRow({
      changedAt: str(r.payload.at) ?? new Date().toISOString(),
      dealId: str(r.payload.deal_id) ?? '',
      title: str(r.payload.title),
      value: typeof value === 'number' || typeof value === 'string' ? value : null,
      currency: str(r.payload.currency),
      pipeline: name(pipelines, str(r.payload.pipeline_id)),
      fromStage: name(stages, str(r.payload.from_stage_id)),
      toStage: name(stages, str(r.payload.to_stage_id)),
      contactName: (contact?.name as string | null) ?? null,
      contactPhone: (contact?.phone as string | null) ?? null,
    });
  });
}

/**
 * Write every due queued row. Rows are claimed first (pushed past the
 * lock window) so an overlapping cron run cannot write them twice.
 */
export async function drainSheetQueue(
  db: SupabaseClient,
): Promise<{ written: number; failed: number }> {
  const { data: due, error } = await db
    .from('google_sheets_rows')
    .select('id, account_id, tab, payload, attempts')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(DRAIN_BATCH);
  // Most likely: migration 106 not applied yet. Nothing to do.
  if (error || !due || due.length === 0) return { written: 0, failed: 0 };

  const rows = due as QueuedRow[];
  await db
    .from('google_sheets_rows')
    .update({ next_retry_at: new Date(Date.now() + LOCK_MS).toISOString() })
    .in('id', rows.map((r) => r.id));

  let written = 0;
  let failed = 0;
  const byAccount = new Map<string, QueuedRow[]>();
  for (const r of rows) byAccount.set(r.account_id, [...(byAccount.get(r.account_id) ?? []), r]);

  for (const [accountId, accountRows] of byAccount) {
    const { data: conn } = await db
      .from('google_sheets_connections')
      .select(CONNECTION_COLUMNS)
      .eq('account_id', accountId)
      .maybeSingle();
    const c = conn as SheetsConnection | null;
    if (!c || !c.is_active || !c.spreadsheet_id) {
      // Disconnected since these were queued: drop them, don't retry.
      await db
        .from('google_sheets_rows')
        .update({ status: 'failed', last_error: 'Google Sheets is no longer connected.' })
        .in('id', accountRows.map((r) => r.id));
      failed += accountRows.length;
      continue;
    }

    try {
      const token = await getAccessToken(db, c);
      for (const tab of ['Contacts', 'Deals'] as const) {
        const tabRows = accountRows.filter((r) => r.tab === tab);
        if (tabRows.length === 0) continue;
        const values =
          tab === 'Contacts' ? await formatContacts(db, tabRows) : await formatDeals(db, tabRows);
        await appendRows(token, c.spreadsheet_id, tab, values);
        await db
          .from('google_sheets_rows')
          .update({ status: 'done', last_error: null })
          .in('id', tabRows.map((r) => r.id));
        written += tabRows.length;
      }
      await noteSuccess(db, accountId);
    } catch (err) {
      await noteFailure(db, accountId, err);
      const message = err instanceof Error ? err.message : String(err);
      const permanent =
        err instanceof GoogleSheetsError && (err.code === 'revoked' || err.code === 'not_found');
      for (const r of accountRows) {
        const attempts = r.attempts + 1;
        const giveUp = permanent || attempts >= MAX_ATTEMPTS;
        await db
          .from('google_sheets_rows')
          .update({
            attempts,
            status: giveUp ? 'failed' : 'pending',
            last_error: message.slice(0, 500),
            // 2, 4, 8 … minutes, capped at 6 hours.
            next_retry_at: new Date(
              Date.now() + Math.min(2 ** attempts, 360) * 60_000,
            ).toISOString(),
          })
          .eq('id', r.id)
          .eq('status', 'pending');
        if (giveUp) failed += 1;
      }
    }
  }

  // Keep the queue small: written rows are only useful briefly.
  await db
    .from('google_sheets_rows')
    .delete()
    .eq('status', 'done')
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString());

  return { written, failed };
}

interface RecipientRow {
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  error_message: string | null;
  contact: { name: string | null; phone: string | null } | null;
}

/**
 * Write each settled campaign's per-recipient results to the Campaigns
 * tab: campaigns that finished sending at least a day ago, after the
 * sheet was connected, and not written before.
 */
export async function exportFinishedCampaigns(
  db: SupabaseClient,
): Promise<{ campaigns: number; rows: number }> {
  const { data: conns, error } = await db
    .from('google_sheets_connections')
    .select(CONNECTION_COLUMNS)
    .eq('is_active', true)
    .eq('sync_campaigns', true)
    .not('spreadsheet_id', 'is', null);
  if (error || !conns || conns.length === 0) return { campaigns: 0, rows: 0 };

  const settledBefore = new Date(Date.now() - CAMPAIGN_SETTLE_MS).toISOString();
  let campaigns = 0;
  let rowsWritten = 0;

  for (const c of conns as SheetsConnection[]) {
    if (campaigns >= CAMPAIGNS_PER_RUN) break;

    const { data: finished } = await db
      .from('broadcasts')
      .select('id, name, template_name')
      .eq('account_id', c.account_id)
      .not('sending_finished_at', 'is', null)
      .lte('sending_finished_at', settledBefore)
      .gte('sending_finished_at', c.connected_at)
      .order('sending_finished_at', { ascending: true })
      .limit(10);
    if (!finished || finished.length === 0) continue;

    const { data: done } = await db
      .from('google_sheets_campaign_exports')
      .select('broadcast_id')
      .in('broadcast_id', finished.map((b) => b.id));
    const doneIds = new Set((done ?? []).map((d) => d.broadcast_id as string));
    const pending = finished.filter((b) => !doneIds.has(b.id as string));

    for (const b of pending) {
      if (campaigns >= CAMPAIGNS_PER_RUN) break;
      try {
        const token = await getAccessToken(db, c);
        let count = 0;
        for (let from = 0; from < MAX_CAMPAIGN_ROWS; from += RECIPIENT_PAGE) {
          const { data: page, error: pageError } = await db
            .from('broadcast_recipients')
            .select('status, sent_at, delivered_at, read_at, replied_at, error_message, contact:contacts(name, phone)')
            .eq('broadcast_id', b.id)
            .order('created_at', { ascending: true })
            .range(from, from + RECIPIENT_PAGE - 1);
          if (pageError) throw pageError;
          const recipients = (page ?? []) as unknown as RecipientRow[];
          await appendRows(
            token,
            c.spreadsheet_id!,
            'Campaigns',
            recipients.map((r) =>
              campaignRow({
                campaign: b.name as string,
                template: b.template_name as string,
                sentAt: r.sent_at,
                contactName: r.contact?.name ?? null,
                phone: r.contact?.phone ?? null,
                status: r.status ?? '',
                deliveredAt: r.delivered_at,
                readAt: r.read_at,
                repliedAt: r.replied_at,
                error: r.error_message,
              }),
            ),
          );
          count += recipients.length;
          if (recipients.length < RECIPIENT_PAGE) break;
        }
        await db.from('google_sheets_campaign_exports').insert({
          broadcast_id: b.id,
          account_id: c.account_id,
          row_count: count,
        });
        await noteSuccess(db, c.account_id);
        campaigns += 1;
        rowsWritten += count;
      } catch (err) {
        await noteFailure(db, c.account_id, err);
        break; // Try this account again next run.
      }
    }
  }

  return { campaigns, rows: rowsWritten };
}
