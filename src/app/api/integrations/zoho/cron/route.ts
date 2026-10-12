import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/billing/admin-client';
import { recordCronHeartbeat } from '@/lib/system/cron-heartbeat';
import { dueWatchFilter, syncZohoWatch } from '@/lib/zoho/watch';

/**
 * Keep automatic Zoho sync alive.
 *
 * A Zoho notification channel lapses after a week at most, and a lapsed
 * one fails silently: Zoho simply stops sending. So hourly, this renews
 * every channel within two days of expiry, and retries — once a day —
 * connections that have no channel yet (connected before the
 * notifications scope existed, or refused by Zoho last time).
 *
 * Auth: the shared AUTOMATION_CRON_SECRET, like every other cron.
 */
const MAX_PER_RUN = 25;

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

  const { data: due, error } = await db
    .from('zoho_connections')
    .select('account_id')
    .eq('is_active', true)
    .eq('auto_sync', true)
    .not('refresh_token', 'is', null)
    .or(dueWatchFilter())
    .limit(MAX_PER_RUN);

  if (error) {
    await recordCronHeartbeat(db, 'zoho_watch', {
      status: 'error',
      durationMs: Date.now() - started,
      error: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let renewed = 0;
  let failed = 0;
  for (const row of due ?? []) {
    const result = await syncZohoWatch(db, row.account_id as string).catch(() => ({
      state: 'error' as const,
    }));
    if (result.state === 'active') renewed += 1;
    else if (result.state === 'error') failed += 1;
  }

  await recordCronHeartbeat(db, 'zoho_watch', {
    status: 'ok',
    durationMs: Date.now() - started,
    detail: { processed: due?.length ?? 0, renewed, failed },
  });
  return NextResponse.json({ processed: due?.length ?? 0, renewed, failed });
}
