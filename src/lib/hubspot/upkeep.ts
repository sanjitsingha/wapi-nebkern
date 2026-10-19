// ============================================================
// HubSpot's share of the minute cron (/api/webhooks/dispatch), so the
// integration needs no cron of its own:
//
//   every minute   push queued records, finish events the webhook's
//                  own run did not, log quiet chats, and copy notes.
//   once an hour   give pushes that ran out of retries a fresh round a
//                  day later, and trim the event log to a month.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { syncCrmNotes } from '@/lib/crm/note-sync';
import { logHubSpotChats } from './chat-log';
import { processHubSpotEvents } from './process';
import { drainHubSpotQueue } from './push';

const DAY_MS = 24 * 3600 * 1000;
const EVENT_LOG_DAYS = 30;

/** Is anything connected at all? Skips every query below when not. */
async function anyConnection(db: SupabaseClient): Promise<boolean> {
  const { count } = await db
    .from('hubspot_connections')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  return (count ?? 0) > 0;
}

async function hourly(db: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const { data: stale } = await db
    .from('hubspot_sync_queue')
    .select('id')
    .eq('status', 'failed')
    .lt('updated_at', new Date(Date.now() - DAY_MS).toISOString())
    .limit(200);
  let requeued = 0;
  for (const row of stale ?? []) {
    const { error } = await db
      .from('hubspot_sync_queue')
      .update({ status: 'pending', attempts: 0, next_retry_at: now, updated_at: now })
      .eq('id', row.id);
    // A newer change for the record is already pending, and it pushes
    // the latest state anyway.
    if (error) await db.from('hubspot_sync_queue').delete().eq('id', row.id);
    else requeued += 1;
  }

  await db
    .from('hubspot_events')
    .delete()
    .lt('created_at', new Date(Date.now() - EVENT_LOG_DAYS * DAY_MS).toISOString());
  return requeued;
}

export async function runHubSpotCron(db: SupabaseClient): Promise<Record<string, unknown>> {
  if (!(await anyConnection(db))) return { connected: 0 };

  const out: Record<string, unknown> = {};
  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      out[name] = await run();
    } catch (err) {
      console.error(`[hubspot/cron] ${name} failed:`, err);
      out[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  };

  await step('push', () => drainHubSpotQueue(db, { budgetMs: 12_000 }));
  await step('events', () => processHubSpotEvents(db, { budgetMs: 6_000 }));
  await step('chats', () => logHubSpotChats(db, { budgetMs: 6_000 }));
  await step('notes', () => syncCrmNotes(db, 'hubspot', { budgetMs: 5_000 }));
  if (new Date().getUTCMinutes() === 30) await step('requeued', () => hourly(db));
  return out;
}
