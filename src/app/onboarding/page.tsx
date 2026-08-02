'use client';

// The plan cards below are the landing page's cards, so they need the
// palette those tokens hang off. Scoped to the grid alone (see the
// `.lp2` wrapper) — the rest of this page stays on the app theme.
import '../(marketing)/lp2.css';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Check, Loader2, MessageSquare, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/billing/plans';
import { TRIAL_DAYS } from '@/lib/billing/subscription';
import { createClient } from '@/lib/supabase/client';
import { payForPlan } from '@/components/billing/razorpay-checkout';
import { lp2Display } from '@/components/lp2/font';
import { Sparkle } from '@/components/lp2/decor';
import { press } from '@/components/lp2/ui';

// ============================================================
// One-time plan-selection gate shown right after registration, before
// the app. The middleware (accounts.onboarded_at, migration 070) routes
// every not-yet-onboarded owner here and won't let them into the app
// until they either start the free trial or pay for a plan — both of
// which stamp onboarded_at server-side and clear the gate.
//
// The plan cards match the landing page's, so someone who just read
// that pricing table recognises these on sight instead of re-comparing
// three columns they already compared. Everything around them — the
// header, the heading, the surface — stays on the app theme.
//
// The trial is deliberately quiet: one text link under the cards, no
// card of its own and no "Recommended" badge. It used to be the hero
// of this page, which did its job far too well — the paid plans are
// the offer, and the trial is the way out for someone not ready.
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

/** Same order the landing table uses, so a plan keeps its colour. */
const HUES = ['sky', 'lemon', 'grape'] as const;
/** Hues dark enough that an ink tick vanishes into them. */
const DARK_HUES = new Set(['sky', 'grape']);

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
            Pick the plan that fits
          </h1>
          <p className="mt-3 text-muted-foreground">
            Every plan runs on the official WhatsApp Business API. You can change
            or cancel it anytime from Settings&nbsp;→&nbsp;Plan — nothing here is
            locked in.
          </p>
        </div>

        {plans === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading plans…
          </div>
        ) : plans.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No paid plans are available right now — start your free trial below,
            and you can upgrade later.
          </p>
        ) : (
          /* `.lp2` is the scope every --lp2-* token hangs off, and the
             font variable is what resolves the display face inside it.
             Confined to this wrapper so the landing palette lives in the
             cards and nowhere else on the page.

             `items-start` so a taller card can't stretch its neighbours
             into matching whitespace — each ends where its content does. */
          <div
            className={cn(
              'lp2',
              lp2Display.variable,
              'mx-auto mt-12 grid max-w-lg items-start gap-6 lg:max-w-none lg:grid-cols-3',
            )}
          >
            {plans.map((plan, i) => {
              const hue = HUES[i % HUES.length];
              const paying = payingKey === plan.key;
              return (
                <div
                  key={plan.key}
                  className={cn(
                    'relative flex flex-col rounded-xl border-2 border-(--lp2-ink) bg-white p-6 text-(--lp2-ink) transition-transform duration-200 hover:-translate-y-1 sm:p-7',
                    // The featured card is lifted so the eye is told
                    // where to land (the ink outline is shared by all).
                    plan.isFeatured && 'lg:-mt-4 lg:pb-9',
                  )}
                >
                  {plan.isFeatured && (
                    <span className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-(--lp2-coral) px-3 py-1 text-[11px] font-extrabold tracking-wide text-white uppercase">
                      <Sparkle color="lemon" className="size-3" />
                      Most loved
                    </span>
                  )}

                  {/* Price block sits on the plan's hue, so each column
                      is identifiable at a glance from across the page. */}
                  <div
                    className="rounded-xl p-5"
                    style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
                  >
                    <h2 className="lp2-display text-xl font-extrabold">
                      {plan.name}
                    </h2>
                    {plan.tagline && (
                      <p className="mt-1 text-xs leading-relaxed font-semibold text-(--lp2-ink-soft)">
                        {plan.tagline}
                      </p>
                    )}
                    <p className="mt-4 flex items-baseline gap-1.5">
                      <span className="lp2-display text-4xl font-extrabold">
                        {formatMoney(plan.amount, plan.currency)}
                      </span>
                      <span className="text-sm font-bold text-(--lp2-ink-soft)">
                        /{plan.interval === 'yearly' ? 'year' : 'month'}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => pay(plan)}
                    disabled={busy}
                    className={cn(
                      'mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-(--lp2-ink) text-sm font-bold disabled:opacity-60',
                      plan.isFeatured
                        ? 'bg-(--lp2-grass) text-white'
                        : 'bg-(--lp2-cream)',
                      press,
                    )}
                  >
                    {paying ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Subscribe
                        <ArrowRight className="size-4" strokeWidth={2.75} />
                      </>
                    )}
                  </button>

                  {plan.features.length > 0 && (
                    <>
                      <p className="mt-6 text-xs font-extrabold tracking-wide uppercase">
                        What you get
                      </p>
                      <ul className="mt-4 space-y-3">
                        {plan.features.slice(0, 6).map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <span
                              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: `var(--lp2-${hue})` }}
                            >
                              <Check
                                className={cn(
                                  'size-3',
                                  DARK_HUES.has(hue) && 'text-white',
                                )}
                                strokeWidth={4}
                              />
                            </span>
                            <span className="text-sm leading-snug font-medium">
                              {f}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* The quiet exit. One line, no chrome — findable for someone
            who wants it, invisible to someone who doesn't. */}
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Not ready to decide?{' '}
          <button
            type="button"
            onClick={startTrial}
            disabled={busy}
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary disabled:opacity-50"
          >
            {startingTrial
              ? 'Starting your trial…'
              : `Skip and start a ${TRIAL_DAYS}-day free trial`}
          </button>
        </p>

        <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" />
          Payments are processed securely by Razorpay. Cancel or change your plan
          anytime.
        </div>
      </main>
    </div>
  );
}
