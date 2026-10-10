import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/webhooks/admin-client';
import { dispatchDueDeliveries } from '@/lib/webhooks/dispatch';
import { recordCronHeartbeat } from '@/lib/system/cron-heartbeat';
import { drainSheetQueue, exportFinishedCampaigns } from '@/lib/google-sheets/sync';

/**
 * Drain the outbound webhook delivery queue.
 *
 * Sends every pending, due delivery (signed POST) and reschedules
 * failures with backoff. Shares `AUTOMATION_CRON_SECRET` with the other
 * crons (broadcasts/automations) so operators provision one secret. Hit
 * on a schedule (Vercel Cron / external pinger); a 1-minute cadence gives
 * near-real-time delivery — fine for Zapier/Make/n8n triggers.
 */
const MAX_PER_RUN = 50;

export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  const supplied = request.headers.get('x-cron-secret') ?? '';
  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(expected);
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const started = Date.now();
  try {
    const result = await dispatchDueDeliveries(admin, MAX_PER_RUN);

    // Google Sheets rides on the same minute: queued contact and deal
    // rows, then any campaign whose results have settled. Its own
    // try — a Google outage must not mark webhook delivery as failed.
    let sheets: Record<string, unknown> = {};
    try {
      const queue = await drainSheetQueue(admin);
      const campaigns = await exportFinishedCampaigns(admin);
      sheets = { ...queue, campaigns: campaigns.campaigns, campaignRows: campaigns.rows };
    } catch (err) {
      console.error('[webhooks-cron] google sheets sync failed:', err);
      sheets = { error: err instanceof Error ? err.message : String(err) };
    }

    await recordCronHeartbeat(admin, 'webhooks_dispatch', {
      status: 'ok',
      durationMs: Date.now() - started,
      detail: { ...(result as Record<string, unknown>), sheets },
    });
    return NextResponse.json({ ...result, sheets });
  } catch (err) {
    console.error('[webhooks-cron] dispatch failed:', err);
    await recordCronHeartbeat(admin, 'webhooks_dispatch', {
      status: 'error',
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'dispatch failed' }, { status: 500 });
  }
}
