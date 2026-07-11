'use client';

import { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import type { SubscriptionState } from '@/lib/billing/subscription';

/**
 * Thin status bar under the header.
 *   - trialing → amber "N days left in your free trial"
 *   - expired  → red "trial has ended — sending is paused"
 *   - active   → nothing
 *
 * Fetches its own state from /api/account/subscription rather than reading
 * useAuth, so the trial is fully decoupled from the critical profile-load
 * path: if migration 051 isn't applied the endpoint fails open to
 * "active" and this simply renders nothing — it can never break auth.
 */
export function TrialBanner() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.subscription) setSub(data.subscription);
      })
      .catch(() => {
        /* network hiccup — just don't show the banner */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sub) return null;

  if (sub.status === 'trialing') {
    const d = sub.trialDaysLeft;
    return (
      <div className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-center text-xs font-medium text-amber-700 dark:text-amber-300">
        <Sparkles className="size-3.5 shrink-0" />
        <span>
          {d > 0
            ? `${d} day${d === 1 ? '' : 's'} left in your free trial`
            : 'Your free trial ends today'}
        </span>
      </div>
    );
  }

  if (sub.status === 'expired') {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-1.5 text-center text-xs font-medium text-red-700 dark:text-red-300">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>
          Your free trial has ended — sending messages and broadcasts is
          paused.
        </span>
      </div>
    );
  }

  return null;
}
