// ============================================================
// Contact notes → Zoho CRM and HubSpot (server only).
//
// Migration 122 queues a row per (note, connected CRM) when a note is
// written, and flips it to 'delete' when the note is deleted. This
// works the queue from the minute cron:
//
//   create  wait until the contact is in the CRM (their push may still
//           be queued), then add the note there — a Zoho Note on the
//           Lead or Contact, a HubSpot Note on the contact's timeline —
//           headed with who wrote it.
//   delete  remove the copy Instant made. Notes written in the CRM
//           itself are never touched.
//
// A contact that never reaches the CRM (spam, blocked, nothing to match
// on) leaves its notes 'skipped' after about an hour; a Resync gives
// them another go.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { zohoApiFetch } from '@/lib/zoho/api';
import { hubspotApiFetch } from '@/lib/hubspot/api';

type Db = SupabaseClient;
export type NoteCrm = 'zoho' | 'hubspot';

const CRM_NAME: Record<NoteCrm, string> = { zoho: 'Zoho', hubspot: 'HubSpot' };

/** Tries while waiting for the contact to reach the CRM, 5 min apart. */
const WAIT_FOR_CONTACT_TRIES = 12;
const WAIT_MS = 5 * 60_000;
/** Minutes to wait after the Nth failure; then 'failed'. */
const BACKOFF_MIN = [1, 5, 30, 120, 360];

/** How a note is headed in the CRM. */
export function noteHeading(author: string): string {
  return `Note by ${author} · Instant`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A note as HubSpot's rich-text body: the heading in bold, then the
 *  text, one paragraph per line. */
export function hubspotNoteBody(author: string, text: string): string {
  const lines = text.split('\n').map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`);
  return `<p><strong>${escapeHtml(noteHeading(author))}</strong></p>${lines.join('')}`;
}

interface SyncRow {
  id: string;
  account_id: string;
  note_id: string;
  contact_id: string | null;
  crm: NoteCrm;
  action: 'create' | 'delete';
  remote_id: string | null;
  attempts: number;
  next_retry_at: string;
}

interface NoteRow {
  id: string;
  contact_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
}

async function authorName(db: Db, userId: string): Promise<string> {
  const { data } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.full_name as string | null)?.trim() || (data?.email as string | null)?.split('@')[0] || 'Teammate';
}

/** Where the contact is in the CRM, or null when they are not (yet). */
async function contactInCrm(
  db: Db,
  crm: NoteCrm,
  accountId: string,
  contactId: string,
): Promise<{ id: string; module?: 'Leads' | 'Contacts' } | null> {
  if (crm === 'zoho') {
    const { data } = await db
      .from('zoho_record_links')
      .select('zoho_module, zoho_id')
      .eq('account_id', accountId)
      .eq('entity', 'contact')
      .eq('local_id', contactId)
      .maybeSingle();
    if (!data || (data.zoho_module !== 'Leads' && data.zoho_module !== 'Contacts')) return null;
    return { id: data.zoho_id as string, module: data.zoho_module as 'Leads' | 'Contacts' };
  }
  const { data } = await db
    .from('hubspot_record_links')
    .select('hubspot_id')
    .eq('account_id', accountId)
    .eq('entity', 'contact')
    .eq('local_id', contactId)
    .maybeSingle();
  return data ? { id: data.hubspot_id as string } : null;
}

class NoteSyncError extends Error {
  constructor(
    message: string,
    /** The connection is gone: stop rather than retry. */
    readonly disconnected = false,
  ) {
    super(message);
  }
}

/** Add the note in the CRM; returns its id there. */
async function createRemote(
  db: Db,
  crm: NoteCrm,
  accountId: string,
  note: NoteRow,
  where: { id: string; module?: 'Leads' | 'Contacts' },
  author: string,
): Promise<string> {
  if (crm === 'zoho') {
    const res = await zohoApiFetch<{ data?: { status?: string; message?: string; details?: { id?: string } }[] }>(
      db,
      accountId,
      `/crm/v5/${where.module}/${encodeURIComponent(where.id)}/Notes`,
      {
        method: 'POST',
        body: JSON.stringify({ data: [{ Note_Title: noteHeading(author), Note_Content: note.note_text }] }),
      },
    );
    const row = res.data?.data?.[0];
    if (row?.status === 'success' && row.details?.id) return String(row.details.id);
    throw new NoteSyncError(res.error ?? row?.message ?? 'Zoho refused the note.', !!res.disconnected);
  }

  const res = await hubspotApiFetch<{ id?: string }>(db, accountId, '/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: { hs_note_body: hubspotNoteBody(author, note.note_text), hs_timestamp: note.created_at },
      associations: [
        {
          to: { id: where.id },
          // Note to contact (HUBSPOT_DEFINED).
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
        },
      ],
    }),
  });
  if (res.data?.id) return String(res.data.id);
  throw new NoteSyncError(res.error ?? 'HubSpot refused the note.', !!res.disconnected);
}

/** Remove the copy Instant made. Already gone counts as done. */
async function deleteRemote(db: Db, crm: NoteCrm, accountId: string, remoteId: string): Promise<void> {
  if (crm === 'zoho') {
    const res = await zohoApiFetch<{ data?: { status?: string; code?: string; message?: string }[] }>(
      db,
      accountId,
      `/crm/v5/Notes/${encodeURIComponent(remoteId)}`,
      { method: 'DELETE' },
    );
    const row = res.data?.data?.[0];
    if (!res.error && (!row || row.status === 'success')) return;
    if (/invalid|not.*(found|exist)/i.test(res.error ?? row?.message ?? row?.code ?? '')) return;
    throw new NoteSyncError(res.error ?? row?.message ?? 'Zoho refused to delete the note.', !!res.disconnected);
  }
  const res = await hubspotApiFetch(db, accountId, `/crm/v3/objects/notes/${encodeURIComponent(remoteId)}`, {
    method: 'DELETE',
  });
  if (!res.error || res.status === 404) return;
  throw new NoteSyncError(res.error, !!res.disconnected);
}

export interface NoteSyncSummary {
  processed: number;
  done: number;
  failed: number;
}

export async function syncCrmNotes(
  db: Db,
  crm: NoteCrm,
  { budgetMs = 6_000, limit = 30 }: { budgetMs?: number; limit?: number } = {},
): Promise<NoteSyncSummary> {
  const started = Date.now();
  const summary: NoteSyncSummary = { processed: 0, done: 0, failed: 0 };

  const { data: due } = await db
    .from('crm_note_syncs')
    .select('id, account_id, note_id, contact_id, crm, action, remote_id, attempts, next_retry_at')
    .eq('crm', crm)
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  for (const row of (due ?? []) as SyncRow[]) {
    if (Date.now() - started > budgetMs) break;

    // Claim it, so an overlapping run skips it.
    const { data: claimed } = await db
      .from('crm_note_syncs')
      .update({ next_retry_at: new Date(Date.now() + WAIT_MS).toISOString() })
      .eq('id', row.id)
      .eq('next_retry_at', row.next_retry_at)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    summary.processed += 1;

    const finish = (patch: Record<string, unknown>) =>
      db
        .from('crm_note_syncs')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', row.id);

    try {
      if (row.action === 'delete') {
        if (row.remote_id) await deleteRemote(db, crm, row.account_id, row.remote_id);
        await finish({ status: 'done', last_error: null });
        summary.done += 1;
        continue;
      }

      const { data: note } = await db
        .from('contact_notes')
        .select('id, contact_id, user_id, note_text, created_at')
        .eq('id', row.note_id)
        .maybeSingle();
      // Deleted before it was ever copied: nothing to do.
      if (!note) {
        await finish({ status: 'done', last_error: null });
        summary.done += 1;
        continue;
      }

      const where = await contactInCrm(db, crm, row.account_id, (note as NoteRow).contact_id);
      if (!where) {
        // Their push may still be on its way. Wait, then give up.
        const attempts = row.attempts + 1;
        await finish(
          attempts >= WAIT_FOR_CONTACT_TRIES
            ? { status: 'skipped', attempts, last_error: `Contact is not in ${CRM_NAME[crm]}.` }
            : { attempts, next_retry_at: new Date(Date.now() + WAIT_MS).toISOString() },
        );
        continue;
      }

      const author = await authorName(db, (note as NoteRow).user_id);
      const remoteId = await createRemote(db, crm, row.account_id, note as NoteRow, where, author);
      await finish({ status: 'done', remote_id: remoteId, last_error: null });
      summary.done += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Note sync failed.';
      if (err instanceof NoteSyncError && err.disconnected) {
        await finish({ status: 'skipped', last_error: message });
        continue;
      }
      const attempts = row.attempts + 1;
      if (attempts > BACKOFF_MIN.length) {
        await finish({ status: 'failed', attempts, last_error: message });
        summary.failed += 1;
      } else {
        await finish({
          attempts,
          last_error: message,
          next_retry_at: new Date(Date.now() + BACKOFF_MIN[attempts - 1] * 60_000).toISOString(),
        });
      }
    }
  }
  return summary;
}
