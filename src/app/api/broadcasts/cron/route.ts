import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/broadcasts/admin-client';
import { dispatchScheduledBroadcast } from '@/lib/broadcasts/dispatch';

/**
 * Dispatch due scheduled broadcasts.
 *
 * Finds broadcasts with `status = 'scheduled'` whose `scheduled_at` has
 * passed, claims each (flipping to `sending` so overlapping cron runs
 * don't double-send), and hands it to the dispatcher which walks the
 * pre-materialized recipient rows and sends via Meta.
 *
 * Auth: shares `AUTOMATION_CRON_SECRET` with the automations/flows crons
 * so operators provision a single secret. Hit on a schedule (Vercel Cron
 * / external pinger) — a 1-minute cadence gives near-immediate sends; a
 * few minutes is fine if minute-level precision isn't needed.
 *
 * A capped batch per invocation keeps any single run bounded; a broadcast
 * mid-send stays out of the next sweep because it's no longer `scheduled`.
 */
const MAX_BROADCASTS_PER_RUN = 5;

export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  // Constant-time compare (length pre-check required by timingSafeEqual).
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

  const { data: due, error } = await admin
    .from('broadcasts')
    .select(
      'id, account_id, template_name, template_language, template_variables',
    )
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(MAX_BROADCASTS_PER_RUN);

  if (error) {
    console.error('[broadcasts-cron] due scan failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ dispatched: 0 });
  }

  const results: Array<{ id: string; sent: number; failed: number }> = [];

  for (const row of due) {
    // Claim: only proceed if we win the scheduled→sending transition, so
    // a concurrent invocation can't pick up the same broadcast.
    const { data: claim } = await admin
      .from('broadcasts')
      .update({ status: 'sending' })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (!claim) continue;

    try {
      const result = await dispatchScheduledBroadcast(admin, {
        id: row.id as string,
        account_id: row.account_id as string,
        template_name: row.template_name as string,
        template_language: (row.template_language as string | null) ?? null,
        template_variables:
          (row.template_variables as Record<string, never> | null) ?? null,
      });
      results.push({ id: result.id, sent: result.sent, failed: result.failed });
    } catch (err) {
      // Never let one broadcast's failure abort the sweep. Mark it failed
      // so it isn't retried forever, and move on.
      console.error(
        `[broadcasts-cron] dispatch failed for ${row.id}:`,
        err instanceof Error ? err.message : err,
      );
      await admin.from('broadcasts').update({ status: 'failed' }).eq('id', row.id);
    }
  }

  return NextResponse.json({ dispatched: results.length, results });
}
