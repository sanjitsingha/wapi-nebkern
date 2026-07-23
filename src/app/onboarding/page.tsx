'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/billing/plans';
import { TRIAL_DAYS } from '@/lib/billing/subscription';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { payForPlan } from '@/components/billing/razorpay-checkout';

// ============================================================
// One-time plan-selection gate shown right after registration, before
// the app. The middleware (accounts.onboarded_at, migration 070) routes
// every not-yet-onboarded owner here and won't let them into the app
// until they either start the free trial or pay for a plan — both of
// which stamp onboarded_at server-side and clear the gate.
// ============================================================

interface PlanOption {
  key: string;
  name: string;
  tagline: string | null;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  isFeatured: boolean;
}

export default function OnboardingPage() {
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [startingTrial, setStartingTrial] = useState(false);
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const busy = startingTrial || payingKey !== null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setPlans(data?.plans ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Full reload rather than a client push, so the middleware re-evaluates
  // the (now cleared) gate server-side and lands the user cleanly in the
  // app with no stale onboarding redirect.
  const goToApp = () => {
    window.location.href = '/dashboard';
  };

  const startTrial = async () => {
    setStartingTrial(true);
    try {
      const res = await fetch('/api/account/onboarding/start-trial', {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not start your trial.');
      goToApp();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start your trial.');
      setStartingTrial(false);
    }
  };

  const pay = async (plan: PlanOption) => {
    setPayingKey(plan.key);
    try {
      const result = await payForPlan(plan.key);
      if (result === null) {
        setPayingKey(null); // user dismissed the Razorpay modal — no charge
        return;
      }
      toast.success(`${result.planName} plan is active`);
      goToApp();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed.');
      setPayingKey(null);
    }
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">wacrm</span>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-primary">Welcome aboard 🎉</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Pick how you&apos;d like to start
          </h1>
          <p className="mt-3 text-muted-foreground">
            Try everything free for {TRIAL_DAYS} days — no card required — or jump
            straight onto a paid plan. You can change this anytime from
            Settings&nbsp;→&nbsp;Plan.
          </p>
        </div>

        {/* Free-trial hero — the recommended, no-friction path. */}
        <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-primary/30 bg-primary/5">
          <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" /> Recommended
              </div>
              <h2 className="mt-3 text-xl font-semibold">
                Start your {TRIAL_DAYS}-day free trial
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Full access to every feature. No credit card, no charge today.
              </p>
            </div>
            <Button
              type="button"
              onClick={startTrial}
              disabled={busy}
              className="h-12 shrink-0 px-6 text-sm font-semibold"
            >
              {startingTrial ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Start free trial'
              )}
            </Button>
          </div>
        </div>

        <div className="mx-auto my-10 flex max-w-2xl items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            or subscribe now
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {plans === null ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading plans…
          </div>
        ) : plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No paid plans are available right now — start your free trial above,
            and you can upgrade later.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  'flex flex-col rounded-2xl border border-border bg-card p-5',
                  plan.isFeatured && 'border-primary/40 ring-1 ring-primary/20',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{plan.name}</p>
                  {plan.isFeatured && (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Popular
                    </span>
                  )}
                </div>
                {plan.tagline && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {plan.tagline}
                  </p>
                )}
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {formatMoney(plan.amount, plan.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{plan.interval === 'yearly' ? 'yr' : 'mo'}
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.slice(0, 6).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant={plan.isFeatured ? 'default' : 'outline'}
                  className="mt-5"
                  disabled={busy}
                  onClick={() => pay(plan)}
                >
                  {payingKey === plan.key ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    `Subscribe — ${formatMoney(plan.amount, plan.currency)}`
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" />
          Payments are processed securely by Razorpay. Cancel or change your plan
          anytime.
        </div>
      </main>
    </div>
  );
}
