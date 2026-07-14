'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, AlertTriangle, BadgeCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SubscriptionState } from '@/lib/billing/subscription';

/** Known paid tiers → display label. Anything else on an active account
 *  (e.g. 'grandfathered') falls back to a generic "Active". */
const TIER_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

/**
 * Compact plan/trial pill for the header, beside the notification bell.
 * Clickable → Settings → Profile, where the Plan section lives.
 * Self-fetches from the tolerant
 * /api/account/subscription endpoint (fails open pre-migration → renders
 * "Active"), so it can never break the header.
 */
export function PlanBadge() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setSub(data?.subscription ?? null);
      })
      .catch(() => {
        /* leave null — badge just doesn't render */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sub) return null;

  let label: string;
  let tone: string;
  let Icon = BadgeCheck;

  if (sub.status === 'trialing') {
    label =
      sub.trialDaysLeft > 0 ? `Trial · ${sub.trialDaysLeft}d left` : 'Trial ends today';
    tone =
      'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300';
    Icon = Sparkles;
  } else if (sub.status === 'expired') {
    label = 'Trial ended';
    tone = 'bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300';
    Icon = AlertTriangle;
  } else {
    label = TIER_LABELS[sub.plan] ?? 'Active';
    tone = 'bg-primary-soft text-primary hover:bg-primary/15';
    Icon = BadgeCheck;
  }

  return (
    <Link
      href="/settings/profile"
      title="View plan"
      aria-label={`Plan: ${label}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        tone,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </Link>
  );
}
