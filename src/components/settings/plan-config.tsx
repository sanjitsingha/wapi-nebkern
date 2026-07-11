'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Loader2,
  Sparkles,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PLAN_TIERS } from '@/lib/billing/plans';
import { TRIAL_DAYS, type SubscriptionState } from '@/lib/billing/subscription';
import { SettingsPanelHead } from './settings-panel-head';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Prominent card describing the account's current subscription state. */
function CurrentStatus({ sub }: { sub: SubscriptionState }) {
  if (sub.status === 'trialing') {
    const elapsed = Math.min(
      100,
      Math.max(0, ((TRIAL_DAYS - sub.trialDaysLeft) / TRIAL_DAYS) * 100),
    );
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Free trial
                </p>
                <p className="text-xs text-muted-foreground">
                  Full access to every feature
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              {sub.trialDaysLeft > 0
                ? `${sub.trialDaysLeft} day${sub.trialDaysLeft === 1 ? '' : 's'} left`
                : 'Ends today'}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
              style={{ width: `${elapsed}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your trial ends on {formatDate(sub.trialEndsAt)}. Pick a plan before
            then to keep sending without interruption.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (sub.status === 'expired') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Your free trial has ended</AlertTitle>
        <AlertDescription>
          Sending messages and broadcasts is paused. Choose a plan below to
          resume. (Checkout is coming soon.)
        </AlertDescription>
      </Alert>
    );
  }

  // active (paid or grandfathered) — or any other non-trial state.
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BadgeCheck className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {sub.plan === 'grandfathered' ? 'Full access' : 'Active plan'}
          </p>
          <p className="text-xs text-muted-foreground">
            Your account is active with full access.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlanConfig() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setSub(data?.subscription ?? null);
      })
      .catch(() => {
        /* leave sub null — the plans grid still renders */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-5">
      <SettingsPanelHead
        title="Plan"
        description="Your subscription status and the plans available. Every account starts with a 14-day free trial."
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your plan…
        </div>
      ) : (
        <>
          {sub && <CurrentStatus sub={sub} />}

          <div>
            <p className="mb-3 text-sm font-medium text-foreground">
              Available plans
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLAN_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={cn(
                    'flex flex-col rounded-xl border bg-card p-4',
                    tier.featured
                      ? 'border-primary ring-1 ring-primary/30'
                      : 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {tier.name}
                    </p>
                    {tier.featured && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tier.tagline}
                  </p>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {tier.priceLabel}
                  </p>
                  <ul className="mt-3 flex-1 space-y-2">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={tier.featured ? 'default' : 'outline'}
                    disabled
                    className="mt-4 w-full"
                    title="Checkout is coming soon"
                  >
                    Upgrade
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Checkout isn&apos;t available yet — pricing and self-serve upgrade
              are coming soon. Reach out to us to switch plans in the meantime.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
