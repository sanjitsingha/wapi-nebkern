import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { TRIAL_DAYS } from '@/lib/billing/subscription';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/account/onboarding/start-trial
 *
 * Completes the one-time plan-selection gate (migration 070) by choosing
 * the free trial. Stamps accounts.onboarded_at so the middleware stops
 * redirecting to /onboarding, and (re)starts a fresh TRIAL_DAYS window
 * from NOW — so the countdown begins when the user actually opts in, not
 * at the moment their auth row was created.
 *
 * Owner/admin only (RLS accounts_update requires admin+; requireRole
 * makes the 403 explicit). Idempotent: once onboarded it just reports the
 * existing state, and it never downgrades an already-active (paid or
 * activation-coded) account back to trialing.
 */
export async function POST() {
  try {
    const { supabase, accountId } = await requireRole('admin');

    const { data: account, error: readErr } = await supabase
      .from('accounts')
      .select('onboarded_at, subscription_status')
      .eq('id', accountId)
      .maybeSingle();
    if (readErr) {
      console.error('[onboarding/start-trial] account read failed:', readErr);
      return NextResponse.json(
        { error: 'Could not load your account. Please try again.' },
        { status: 500 },
      );
    }

    // Already past the gate — nothing to do. A paid account stays paid.
    if (account?.onboarded_at) {
      return NextResponse.json({ ok: true, alreadyOnboarded: true });
    }

    const now = new Date();
    const update: Record<string, unknown> = { onboarded_at: now.toISOString() };

    // Only (re)start a trial when the account isn't already active — never
    // clobber a paid/grandfathered plan that somehow reached this gate.
    if (account?.subscription_status !== 'active') {
      const end = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
      update.plan = 'trial';
      update.subscription_status = 'trialing';
      update.trial_started_at = now.toISOString();
      update.trial_ends_at = end.toISOString();
    }

    const { error: updateErr } = await supabase
      .from('accounts')
      .update(update)
      .eq('id', accountId);
    if (updateErr) {
      console.error('[onboarding/start-trial] account update failed:', updateErr);
      return NextResponse.json(
        { error: 'Could not start your trial. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
