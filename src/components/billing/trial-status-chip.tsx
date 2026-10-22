'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Timer, AlertTriangle } from 'lucide-react';
import type { SubscriptionState } from '@/lib/billing/subscription';

/**
 * Plan status, as a chip in the header beside the notifications bell.
 *   - trialing                     → amber "N days left"
 *   - paid, ending within 7 days   → amber "Plan ends in N days"
 *   - ended (trial or paid period) → red "Trial ended" / "Plan ended"
 *   - otherwise                    → nothing
 *
 * This was a full-width bar under the header. It moved up here because
 * a permanent band across the window is a lot of screen to spend on a
 * number that changes once a day — and it pushed every page in the app
 * down by its own height for the entire trial.
 *
 * Fetches its own state from /api/account/subscription rather than
 * reading useAuth, so the trial stays decoupled from the critical
 * profile-load path: if migration 051 isn't applied the endpoint fails
 * open to "active" and this simply renders nothing — it can never break
 * auth.
 *
 * It is a link now that it is small. A bar could afford to just state a
 * fact; a chip this size is read as something to press, and the thing
 * anyone pressing it wants is the billing page.
 *
 * NO `dark:` VARIANTS. This app is light-only — lib/themes.ts declares
 * `type Mode = "light"` and nothing ever puts a `dark` class on the
 * document — but Tailwind v4 resolves `dark:` from the visitor's OS
 * setting, not from the app. A dark-mode colour here would fire on a
 * page that stayed light. See whatsapp-connect-banner.tsx.
 */
/** How far ahead a paid plan's end shows in the header. */
const RENEW_NOTICE_DAYS = 7;

export function TrialStatusChip() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.subscription) setSub(data.subscription);
      })
      .catch(() => {
        /* network hiccup — just don't show the chip */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sub) return null;

  // The header is tight on a phone, so each state carries a short form
  // as well. The chip is never hidden outright: "your trial has ended"
  // is exactly the thing a mobile user needs to see.
  const shell =
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors';

  if (sub.status === 'trialing') {
    const d = sub.trialDaysLeft;
    return (
      <Link
        // Profile → Plan, NOT /settings/billing. That page is Meta's
        // conversation charges; the trial and the upgrade live here.
        href="/settings/profile?tab=plan"
        title={
          d > 0
            ? `${d} day${d === 1 ? '' : 's'} left in your free trial`
            : 'Your free trial ends today'
        }
        className={`${shell} border-amber-500/40 bg-amber-500/15 text-amber-950 hover:bg-amber-500/25`}
      >
        <Timer className="size-3.5 shrink-0" />
        {d > 0 ? (
          <>
            <span className="hidden sm:inline">
              {d} day{d === 1 ? '' : 's'} left
            </span>
            <span className="sm:hidden">{d}d</span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline">Ends today</span>
            <span className="sm:hidden">Today</span>
          </>
        )}
      </Link>
    );
  }

  // A paid plan close to its end: a week's notice to renew, since a
  // period that runs out pauses the whole app.
  if (sub.hasAccess && sub.periodEndsAt && sub.periodDaysLeft > 0 && sub.periodDaysLeft <= RENEW_NOTICE_DAYS) {
    const d = sub.periodDaysLeft;
    return (
      <Link
        href="/settings/profile?tab=plan"
        title={`Your plan ends in ${d} day${d === 1 ? '' : 's'} — renew to keep going without a break.`}
        className={`${shell} border-amber-500/40 bg-amber-500/15 text-amber-950 hover:bg-amber-500/25`}
      >
        <Timer className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {d === 1 ? 'Plan ends tomorrow' : `Plan ends in ${d} days`}
        </span>
        <span className="sm:hidden">{d}d</span>
      </Link>
    );
  }

  if (!sub.hasAccess) {
    const trial = sub.plan === 'trial';
    return (
      <Link
        href="/settings/profile?tab=plan"
        title={
          trial
            ? 'Your free trial has ended — sending messages and broadcasts is paused.'
            : 'Your plan has ended — sending messages and broadcasts is paused.'
        }
        className={`${shell} border-red-500/40 bg-red-500/15 text-red-950 hover:bg-red-500/25`}
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">{trial ? 'Trial ended' : 'Plan ended'}</span>
        <span className="sm:hidden">Ended</span>
      </Link>
    );
  }

  return null;
}
