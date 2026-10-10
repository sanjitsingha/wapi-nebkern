import type { SupabaseClient } from '@supabase/supabase-js';

import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import {
  GoogleSheetsError,
  appendRows,
  googleSheetsClient,
  refreshGoogleToken,
} from './client';
import {
  assignmentRow,
  campaignRow,
  contactRow,
  dealRow,
  messageRow,
  sheetTypeForWebhookEvent,
  type SheetEventType,
} from './rows';

// ============================================================
// Getting rows into connected Google Sheets.
//
//   enqueueSheetEvent        called from emitWebhookEvent: one insert
//                            per sheet subscribed to the event
//   drainSheetQueue          the webhooks cron, every minute: formats
//                            queued events and appends them, per sheet
//   exportFinishedCampaigns  same cron: per-recipient results to the
//                            "campaigns" sheets, a day after sending
//
// Each sheet receives one kind of entry (its event_type). Everything here
// is best-effort toward the rest of the app: nothing throws into the
// code path that caused an event, and a Google failure is recorded on
// the sheet (shown in Settings) and retried.
// ============================================================

export interface GoogleAccountRow {
  id: string;
  account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export const GOOGLE_ACCOUNT_COLUMNS =
  'id, account_id, access_token, refresh_token, expires_at, is_active';

interface SheetRow {
  id: string;
  account_id: string;
  event_type: SheetEventType;
  spreadsheet_id: string;
  is_active: boolean;
  created_at: string;
  google_account: GoogleAccountRow | null;
}

const SHEET_COLUMNS = `id, account_id, event_type, spreadsheet_id, is_active, created_at, google_account:google_accounts(${GOOGLE_ACCOUNT_COLUMNS})`;

/** Refresh this long before expiry rather than on the 401. */
const REFRESH_MARGIN_MS = 2 * 60_000;
/** Claimed rows are invisible to an overlapping run for this long. */
const LOCK_MS = 5 * 60_000;
const MAX_ATTEMPTS = 8;
const DRAIN_BATCH = 300;
/** Reads and replies keep arriving for about a day after a send. */
const CAMPAIGN_SETTLE_MS = 24 * 60 * 60_000;
const CAMPAIGNS_PER_RUN = 3;
const RECIPIENT_PAGE = 1000;
const MAX_CAMPAIGN_ROWS = 100_000;
const NO_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Queue an app event for every sheet subscribed to it. Never throws: it
 * runs inside the request that produced the event.
 */
export async function enqueueSheetEvent(
  db: SupabaseClient,
  accountId: string,
  webhookEvent: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const type = sheetTypeForWebhookEvent(webhookEvent);
  if (!type) return;
  try {
    const { data: sheets } = await db
      .from('google_sheets')
      .select('id, google_accounts!inner(is_active)')
      .eq('account_id', accountId)
      .eq('event_type', type)
      .eq('is_active', true)
      .eq('google_accounts.is_active', true);
    if (!sheets || sheets.length === 0) return;
    const at = new Date().toISOString();
    await db.from('google_sheets_rows').insert(
      sheets.map((s) => ({
        account_id: accountId,
        sheet_id: s.id as string,
        payload: { ...payload, at },
      })),
    );
  } catch (err) {
    console.error('[google-sheets] enqueue failed:', err);
  }
}

/**
 * A working access token for a Google account, refreshing and saving a
 * new one when the stored one is about to expire.
 */
export async function getAccessToken(
  db: SupabaseClient,
  account: GoogleAccountRow,
): Promise<string> {
  if (!account.refresh_token) {
    throw new GoogleSheetsError('This Google account is not authorised.', 'revoked');
  }
  const expiresAt = account.expires_at ? Date.parse(account.expires_at) : 0;
  if (account.access_token && expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return decrypt(account.access_token);
  }

  const client = googleSheetsClient();
  if (!client) {
    throw new GoogleSheetsError(
      'Google Sheets is not configured on this server (GOOGLE_CLIENT_SECRET).',
      'oauth_error',
    );
  }
  const tokens = await refreshGoogleToken({
    refreshToken: decrypt(account.refresh_token),
    ...client,
  });
  await db
    .from('google_accounts')
    .update({
      access_token: encrypt(tokens.accessToken),
      // Google rarely rotates it, but keep the new one when it does.
      ...(tokens.refreshToken ? { refresh_token: encrypt(tokens.refreshToken) } : {}),
      expires_at: new Date(tokens.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);
  return tokens.accessToken;
}

/**
 * Record a failure on the sheet. A revoked grant is the Google account's
 * problem, not the sheet's: the account is marked inactive, which stops
 * every sheet that writes through it until it is reconnected.
 */
export async function noteSheetFailure(
  db: SupabaseClient,
  sheet: { id: string; google_account: GoogleAccountRow | null },
  err: unknown,
) {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  const now = new Date().toISOString();
  await db
    .from('google_sheets')
    .update({ last_error: message, last_error_at: now })
    .eq('id', sheet.id);
  if (err instanceof GoogleSheetsError && err.code === 'revoked' && sheet.google_account) {
    await db
      .from('google_accounts')
      .update({ is_active: false, last_error: message, last_error_at: now })
      .eq('id', sheet.google_account.id);
  }
}

export async function noteSheetSuccess(db: SupabaseClient, sheetId: string) {
  await db
    .from('google_sheets')
    .update({ last_written_at: new Date().toISOString(), last_error: null, last_error_at: null })
    .eq('id', sheetId);
}

interface QueuedRow {
  id: string;
  sheet_id: string;
  payload: Record<string, unknown>;
  attempts: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const ids = (rows: QueuedRow[], key: string) => {
  const set = new Set(rows.map((r) => str(r.payload[key])).filter((v): v is string => !!v));
  return set.size ? [...set] : [NO_ID];
};

async function formatContacts(db: SupabaseClient, rows: QueuedRow[]): Promise<string[][]> {
  const { data: contacts } = await db
    .from('contacts')
    .select('id, name, phone, email, created_at, contact_tags(tags(name))')
    .in('id', ids(rows, 'contact_id'));
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

function formatMessages(rows: QueuedRow[]): string[][] {
  // Everything needed travels in the event itself — no lookups for the
  // highest-volume kind of entry.
  return rows.map((r) =>
    messageRow({
      receivedAt: str(r.payload.at),
      contactName: str(r.payload.contact_name),
      phone: str(r.payload.from),
      type: str(r.payload.content_type),
      text: str(r.payload.content_text),
      conversationId: str(r.payload.conversation_id),
      messageId: str(r.payload.message_id),
    }),
  );
}

async function formatAssignments(db: SupabaseClient, rows: QueuedRow[]): Promise<string[][]> {
  const [{ data: contacts }, { data: agents }] = await Promise.all([
    db.from('contacts').select('id, name, phone').in('id', ids(rows, 'contact_id')),
    db.from('profiles').select('user_id, full_name, email').in('user_id', ids(rows, 'agent_id')),
  ]);
  return rows.map((r) => {
    const contact = (contacts ?? []).find((c) => c.id === str(r.payload.contact_id));
    const agent = (agents ?? []).find((a) => a.user_id === str(r.payload.agent_id));
    return assignmentRow({
      assignedAt: str(r.payload.at),
      contactName: (contact?.name as string | null) ?? null,
      phone: (contact?.phone as string | null) ?? null,
      agentName: (agent?.full_name as string | null) ?? null,
      agentEmail: (agent?.email as string | null) ?? null,
      conversationId: str(r.payload.conversation_id),
    });
  });
}

async function formatDeals(db: SupabaseClient, rows: QueuedRow[]): Promise<string[][]> {
  const stageIds = [...new Set([...ids(rows, 'from_stage_id'), ...ids(rows, 'to_stage_id')])];
  const [{ data: stages }, { data: pipelines }, { data: contacts }] = await Promise.all([
    db.from('pipeline_stages').select('id, name').in('id', stageIds),
    db.from('pipelines').select('id, name').in('id', ids(rows, 'pipeline_id')),
    db.from('contacts').select('id, name, phone').in('id', ids(rows, 'contact_id')),
  ]);
  const name = (list: { id: string; name: string }[] | null, id: string | null) =>
    id ? ((list ?? []).find((x) => x.id === id)?.name ?? null) : null;

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

function formatFor(type: SheetEventType, db: SupabaseClient, rows: QueuedRow[]) {
  switch (type) {
    case 'contacts':
      return formatContacts(db, rows);
    case 'messages':
      return Promise.resolve(formatMessages(rows));
    case 'assignments':
      return formatAssignments(db, rows);
    case 'deals':
      return formatDeals(db, rows);
    default:
      // Campaign results are never queued; see exportFinishedCampaigns.
      return Promise.resolve([] as string[][]);
  }
}

/**
 * Write every due queued row, sheet by sheet. Rows are claimed first
 * (pushed past the lock window) so an overlapping cron run cannot write
 * them twice.
 */
export async function drainSheetQueue(
  db: SupabaseClient,
): Promise<{ written: number; failed: number }> {
  const { data: due, error } = await db
    .from('google_sheets_rows')
    .select('id, sheet_id, payload, attempts')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(DRAIN_BATCH);
  // Most likely: migration 107 not applied yet. Nothing to do.
  if (error || !due || due.length === 0) return { written: 0, failed: 0 };

  const rows = due as QueuedRow[];
  await db
    .from('google_sheets_rows')
    .update({ next_retry_at: new Date(Date.now() + LOCK_MS).toISOString() })
    .in('id', rows.map((r) => r.id));

  let written = 0;
  let failed = 0;
  const bySheet = new Map<string, QueuedRow[]>();
  for (const r of rows) bySheet.set(r.sheet_id, [...(bySheet.get(r.sheet_id) ?? []), r]);

  for (const [sheetId, sheetRows] of bySheet) {
    const { data } = await db.from('google_sheets').select(SHEET_COLUMNS).eq('id', sheetId).maybeSingle();
    const sheet = data as unknown as SheetRow | null;
    if (!sheet || !sheet.is_active || !sheet.google_account?.is_active) {
      // Paused, deleted or its account disconnected since queueing:
      // drop the rows rather than retry into nothing.
      await db
        .from('google_sheets_rows')
        .update({ status: 'failed', last_error: 'The sheet is paused or no longer connected.' })
        .in('id', sheetRows.map((r) => r.id));
      failed += sheetRows.length;
      continue;
    }

    try {
      const token = await getAccessToken(db, sheet.google_account);
      const values = await formatFor(sheet.event_type, db, sheetRows);
      await appendRows(token, sheet.spreadsheet_id, values);
      await db
        .from('google_sheets_rows')
        .update({ status: 'done', last_error: null })
        .in('id', sheetRows.map((r) => r.id));
      await noteSheetSuccess(db, sheetId);
      written += sheetRows.length;
    } catch (err) {
      await noteSheetFailure(db, sheet, err);
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      const permanent =
        err instanceof GoogleSheetsError && (err.code === 'revoked' || err.code === 'not_found');
      for (const r of sheetRows) {
        const attempts = r.attempts + 1;
        const giveUp = permanent || attempts >= MAX_ATTEMPTS;
        await db
          .from('google_sheets_rows')
          .update({
            attempts,
            status: giveUp ? 'failed' : 'pending',
            last_error: message,
            // 2, 4, 8 … minutes, capped at 6 hours.
            next_retry_at: new Date(Date.now() + Math.min(2 ** attempts, 360) * 60_000).toISOString(),
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
 * Write each settled campaign's per-recipient results to every
 * "campaigns" sheet: campaigns that finished sending at least a day ago,
 * after the sheet was added, and not yet written to that sheet.
 *
 * A failure partway through a large campaign retries the whole campaign
 * next run, so a few recipients can then appear twice. Rare, and better
 * than a campaign silently half-written.
 */
export async function exportFinishedCampaigns(
  db: SupabaseClient,
): Promise<{ campaigns: number; rows: number }> {
  const { data, error } = await db
    .from('google_sheets')
    .select(SHEET_COLUMNS)
    .eq('event_type', 'campaigns')
    .eq('is_active', true);
  if (error || !data || data.length === 0) return { campaigns: 0, rows: 0 };

  const settledBefore = new Date(Date.now() - CAMPAIGN_SETTLE_MS).toISOString();
  let campaigns = 0;
  let rowsWritten = 0;

  for (const sheet of data as unknown as SheetRow[]) {
    if (campaigns >= CAMPAIGNS_PER_RUN) break;
    if (!sheet.google_account?.is_active) continue;

    const { data: finished } = await db
      .from('broadcasts')
      .select('id, name, template_name')
      .eq('account_id', sheet.account_id)
      .not('sending_finished_at', 'is', null)
      .lte('sending_finished_at', settledBefore)
      .gte('sending_finished_at', sheet.created_at)
      .order('sending_finished_at', { ascending: true })
      .limit(10);
    if (!finished || finished.length === 0) continue;

    const { data: done } = await db
      .from('google_sheets_campaign_exports')
      .select('broadcast_id')
      .eq('sheet_id', sheet.id)
      .in('broadcast_id', finished.map((b) => b.id));
    const doneIds = new Set((done ?? []).map((d) => d.broadcast_id as string));

    for (const b of finished.filter((x) => !doneIds.has(x.id as string))) {
      if (campaigns >= CAMPAIGNS_PER_RUN) break;
      try {
        const token = await getAccessToken(db, sheet.google_account);
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
            sheet.spreadsheet_id,
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
          sheet_id: sheet.id,
          broadcast_id: b.id,
          account_id: sheet.account_id,
          row_count: count,
        });
        await noteSheetSuccess(db, sheet.id);
        campaigns += 1;
        rowsWritten += count;
      } catch (err) {
        await noteSheetFailure(db, sheet, err);
        break; // Try this sheet again next run.
      }
    }
  }

  return { campaigns, rows: rowsWritten };
}
