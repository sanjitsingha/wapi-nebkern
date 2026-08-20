import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/account/admin-client';
import { recordCronHeartbeat } from '@/lib/system/cron-heartbeat';

/**
 * Purge accounts whose 30-day deletion window has closed.
 *
 * Finds rows where `deletion_purge_at` has passed and removes them for
 * real: the account row (everything account-scoped cascades from it),
 * then the auth users behind its profiles, so the addresses are free to
 * sign up again.
 *
 * Auth: shares `AUTOMATION_CRON_SECRET` with the other crons so
 * operators provision a single secret. Daily is enough — the window is
 * measured in days, so the cost of running an hour late is an hour, and
 * nothing here is time-critical.
 *
 * A capped batch keeps any single run bounded. Deleting an account
 * cascades across every table in the schema, and doing an unbounded
 * number of those in one request is how a sweep times out halfway.
 */
const MAX_ACCOUNTS_PER_RUN = 10;

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

  const { data: due, error } = await admin
    .from('accounts')
    .select('id, name')
    .not('deletion_requested_at', 'is', null)
    .lte('deletion_purge_at', new Date().toISOString())
    .order('deletion_purge_at', { ascending: true })
    .limit(MAX_ACCOUNTS_PER_RUN);

  if (error) {
    console.error('[accounts-cron] due scan failed:', error.message);
    await recordCronHeartbeat(admin, 'account_purge', {
      status: 'error',
      durationMs: Date.now() - started,
      error: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!due || due.length === 0) {
    await recordCronHeartbeat(admin, 'account_purge', {
      status: 'ok',
      durationMs: Date.now() - started,
      detail: { purged: 0 },
    });
    return NextResponse.json({ purged: 0 });
  }

  const purged: string[] = [];

  for (const row of due) {
    const accountId = row.id as string;
    try {
      // Collect the members BEFORE dropping the account: profiles
      // cascade with it, and after that there is no way to find the
      // auth users that belonged to it.
      const { data: members } = await admin
        .from('profiles')
        .select('user_id')
        .eq('account_id', accountId);

      // The account row first. `accounts.owner_user_id` is ON DELETE
      // RESTRICT, so the auth users cannot go first — the database
      // would refuse while the account still points at the owner.
      const { error: delErr } = await admin
        .from('accounts')
        .delete()
        .eq('id', accountId);
      if (delErr) throw new Error(delErr.message);

      for (const m of members ?? []) {
        const userId = m.user_id as string | null;
        if (!userId) continue;
        const { error: authErr } = await admin.auth.admin.deleteUser(userId);
        if (authErr) {
          // The account data is already gone, which is the part that
          // matters for the promise made to the user. A stranded auth
          // row is a loose end worth logging, not a reason to fail the
          // sweep and retry a delete that has already happened.
          console.error(
            `[accounts-cron] auth user ${userId} not removed:`,
            authErr.message
          );
        }
      }

      purged.push(accountId);
    } catch (err) {
      console.error(
        `[accounts-cron] purge failed for ${accountId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  await recordCronHeartbeat(admin, 'account_purge', {
    status: 'ok',
    durationMs: Date.now() - started,
    detail: { purged: purged.length },
  });
  return NextResponse.json({ purged: purged.length, accounts: purged });
}
