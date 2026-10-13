import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/billing/admin-client';
import { recordCronHeartbeat } from '@/lib/system/cron-heartbeat';
import { isWatchDue, syncZohoWatch, type WatchDueRow } from '@/lib/zoho/watch';

/**
 * Hourly Zoho upkeep. Everything here used to be a button or a switch
 * in Settings; sync is meant to need no attention, so it happens here.
 *
 *   1. CHANNELS. A Zoho notification channel lapses after a week at
 *      most, and a lapsed one fails silently: Zoho simply stops
 *      sending. Renew every channel within two days of expiry, widen
 *      any made when only some events were watched, and retry — once a
 *      day — connections without one.
 *
 *   2. FAILED PUSHES. A record that ran out of retries (six, over about
 *      nine hours) gets a fresh round a day later. Most causes — a Zoho
 *      outage, a rate limit, a field fixed in the meantime — clear on
 *      their own.
 *
 *   3. THE EVENT LOG. Every Zoho edit is now an event; keep a month.
 *
 * Auth: the shared AUTOMATION_CRON_SECRET, like every other cron.
 */
const MAX_PER_RUN = 25;
const DAY_MS = 24 * 3600 * 1000;
const EVENT_LOG_DAYS = 30;

export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  const supplied = Buffer.from(request.headers.get('x-cron-secret') ?? '');
  const expectedBuf = Buffer.from(expected);
  if (supplied.length !== expectedBuf.length || !timingSafeEqual(supplied, expectedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const started = Date.now();

  // ── 1. Channels ──
  // Connections are few, so the due check runs here rather than as a
  // query filter — "missing an event" is an array comparison PostgREST
  // cannot express cleanly.
  const { data: connections, error } = await db
    .from('zoho_connections')
    .select('account_id, watch_channel_id, watch_expires_at, watch_checked_at, watch_events')
    .eq('is_active', true)
    .not('refresh_token', 'is', null);

  if (error) {
    await recordCronHeartbeat(db, 'zoho_watch', {
      status: 'error',
      durationMs: Date.now() - started,
      error: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = ((connections ?? []) as (WatchDueRow & { account_id: string })[])
    .filter((row) => isWatchDue(row))
    .slice(0, MAX_PER_RUN);

  let renewed = 0;
  let failed = 0;
  for (const row of due) {
    const result = await syncZohoWatch(db, row.account_id).catch(() => ({
      state: 'error' as const,
    }));
    if (result.state === 'active') renewed += 1;
    else if (result.state === 'error') failed += 1;
  }

  // ── 2. Failed pushes ──
  const now = new Date().toISOString();
  const { data: stale } = await db
    .from('zoho_sync_queue')
    .select('id')
    .eq('status', 'failed')
    .lt('updated_at', new Date(Date.now() - DAY_MS).toISOString())
    .limit(200);
  let requeued = 0;
  for (const row of stale ?? []) {
    const { error: requeueError } = await db
      .from('zoho_sync_queue')
      .update({ status: 'pending', attempts: 0, next_retry_at: now, updated_at: now })
      .eq('id', row.id);
    if (requeueError) {
      // A newer change for the same record is already pending (one
      // pending row per record), and it pushes the latest state anyway.
      await db.from('zoho_sync_queue').delete().eq('id', row.id);
    } else {
      requeued += 1;
    }
  }

  // ── 3. Event log ──
  await db
    .from('zoho_events')
    .delete()
    .lt('created_at', new Date(Date.now() - EVENT_LOG_DAYS * DAY_MS).toISOString());

  const detail = { processed: due.length, renewed, failed, requeued };
  await recordCronHeartbeat(db, 'zoho_watch', {
    status: 'ok',
    durationMs: Date.now() - started,
    detail,
  });
  return NextResponse.json(detail);
}
