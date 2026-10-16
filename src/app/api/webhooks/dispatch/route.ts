import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/webhooks/admin-client';
import { dispatchDueDeliveries } from '@/lib/webhooks/dispatch';
import { recordCronHeartbeat } from '@/lib/system/cron-heartbeat';
import { drainSheetQueue, exportFinishedCampaigns } from '@/lib/google-sheets/sync';
import { drainZohoQueue } from '@/lib/zoho/push';
import { logZohoChats } from '@/lib/zoho/chat-log';
import { sweepDueAiReplies } from '@/lib/ai/due-replies';

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

    // Instant → Zoho pushes, then chats written as Zoho notes; same
    // minute, same isolation. Time budgets keep the whole run inside the
    // scheduler's 55s timeout.
    // Maya's long response delays: replies whose wait has run out, handed
    // to the reply engine over loopback — the cron runs on this server.
    // The replies themselves run in their own invocations.
    let ai: Record<string, unknown> = {};
    try {
      ai = await sweepDueAiReplies(admin, `http://127.0.0.1:${process.env.PORT || 3000}`);
    } catch (err) {
      console.error('[webhooks-cron] due AI replies failed:', err);
      ai = { error: err instanceof Error ? err.message : String(err) };
    }

    let zoho: Record<string, unknown> = {};
    try {
      zoho = { ...(await drainZohoQueue(admin, { budgetMs: 25_000 })) };
    } catch (err) {
      console.error('[webhooks-cron] zoho push failed:', err);
      zoho = { error: err instanceof Error ? err.message : String(err) };
    }
    try {
      zoho.chats = await logZohoChats(admin, { budgetMs: 12_000 });
    } catch (err) {
      console.error('[webhooks-cron] zoho chat log failed:', err);
      zoho.chats = { error: err instanceof Error ? err.message : String(err) };
    }

    await recordCronHeartbeat(admin, 'webhooks_dispatch', {
      status: 'ok',
      durationMs: Date.now() - started,
      detail: { ...(result as Record<string, unknown>), sheets, ai, zoho },
    });
    return NextResponse.json({ ...result, sheets, ai, zoho });
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
