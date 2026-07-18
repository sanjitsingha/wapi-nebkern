import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/webhooks/admin-client';
import { dispatchDueDeliveries } from '@/lib/webhooks/dispatch';

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

  try {
    const result = await dispatchDueDeliveries(supabaseAdmin(), MAX_PER_RUN);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[webhooks-cron] dispatch failed:', err);
    return NextResponse.json({ error: 'dispatch failed' }, { status: 500 });
  }
}
