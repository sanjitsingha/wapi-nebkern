'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Contact,
  Sparkles,
  Smartphone,
  Users,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { PLANS, inr, type PricingPlan } from '@/lib/marketing/pricing-data';
import { track } from '@/lib/marketing/track';
import { Sparkle } from './decor';
import { press } from './ui';

// ============================================================
// The plan cards + billing toggle — the interactive heart of /pricing.
//
// Client because of the Monthly/Yearly toggle and the analytics events
// the spec asks for (pricing_page_viewed, billing_toggle_changed,
// plan_cta_clicked). Everything below the
// cards on the page is static and stays server-rendered.
//
// Default cycle is YEARLY, so a visitor lands on the discounted price
// (spec §11). The card's own hue tints its price block, matching the
// landing page's plan cards so a colour reads as "the same plan".
// ============================================================

type Cycle = 'monthly' | 'yearly';

/** One hue per plan, in display order. Sky & grape are dark enough that
 *  an ink tick vanishes into them — those get a white tick. */
const HUES = ['sky', 'lemon', 'grape', 'mint'] as const;
const DARK_HUES = new Set(['sky', 'grape']);

export function PricingCards() {
  const [cycle, setCycle] = useState<Cycle>('yearly');

  useEffect(() => {
    track('pricing_page_viewed');
  }, []);

  const changeCycle = (next: Cycle) => {
    setCycle(next);
    track('billing_toggle_changed', { cycle: next });
  };

  return (
    <section className="bg-(--lp2-coral-soft) py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Billing toggle */}
        <div className="flex justify-center">
          <div
            role="tablist"
            aria-label="Billing cycle"
            className="inline-flex items-center gap-1 rounded-full border-2 border-(--lp2-ink) bg-white p-1 shadow-(--lp2-shadow-sm)"
          >
            <CycleButton
              active={cycle === 'monthly'}
              onClick={() => changeCycle('monthly')}
            >
              Monthly
            </CycleButton>
            <CycleButton
              active={cycle === 'yearly'}
              onClick={() => changeCycle('yearly')}
            >
              Yearly
              <span className="ml-1.5 hidden rounded-full bg-(--lp2-grass) px-1.5 py-0.5 text-[10px] font-extrabold text-white sm:inline">
                SAVE UP TO 35%
              </span>
            </CycleButton>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-md items-start gap-6 md:max-w-none md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              hue={HUES[i % HUES.length]}
            />
          ))}
        </div>

        <p className="mt-10 text-center text-sm font-semibold text-(--lp2-ink-soft)">
          All prices in INR and exclude 18% GST. Cancel any time — your
          contacts and history stay yours.
        </p>
      </div>
    </section>
  );
}

function CycleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-full px-4 text-sm font-bold transition-colors',
        active ? 'bg-(--lp2-ink) text-white' : 'text-(--lp2-ink-soft) hover:text-(--lp2-ink)',
      )}
    >
      {children}
    </button>
  );
}

function PlanCard({
  plan,
  cycle,
  hue,
}: {
  plan: PricingPlan;
  cycle: Cycle;
  hue: (typeof HUES)[number];
}) {
  const featured = plan.isPopular;
  const yearly = cycle === 'yearly';

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border-2 border-(--lp2-ink) bg-white p-6 transition-transform duration-200 hover:-translate-y-1',
        // Growth first on mobile (spec §12), natural order from md up.
        featured && 'order-first shadow-(--lp2-shadow-lg) md:order-0 lg:-mt-4 lg:pb-9',
      )}
    >
      {featured && plan.popularBadgeText && (
        <span className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-(--lp2-coral) px-3 py-1 text-[11px] font-extrabold tracking-wide text-white uppercase">
          <Sparkle color="lemon" className="size-3" />
          {plan.popularBadgeText}
        </span>
      )}

      {/* Price block on the plan's hue */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
      >
        <h3 className="lp2-display text-xl font-extrabold">{plan.name}</h3>
        <p className="mt-1 text-sm leading-relaxed font-semibold text-(--lp2-ink-soft)">
          {plan.tagline}
        </p>

        {yearly ? (
          <>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="lp2-display text-4xl font-extrabold tabular-nums">
                {inr(plan.yearlyEffectiveMonthly ?? plan.yearlyPrice)}
              </span>
              <span className="text-sm font-bold text-(--lp2-ink-soft)">
                /month
              </span>
              <span className="ml-auto rounded-full bg-(--lp2-grass) px-2 py-0.5 text-[10px] font-extrabold text-white">
                SAVE {plan.yearlyDiscountPct}%
              </span>
            </p>
            <p className="mt-1.5 text-xs font-bold text-(--lp2-ink-soft)">
              Billed {inr(plan.yearlyPrice)}/year
              {plan.yearlySavings ? ` — save ${inr(plan.yearlySavings)}` : ''}
            </p>
          </>
        ) : (
          <p className="mt-4 flex items-baseline gap-1.5">
            <span className="lp2-display text-4xl font-extrabold tabular-nums">
              {inr(plan.monthlyPrice)}
            </span>
            <span className="text-sm font-bold text-(--lp2-ink-soft)">
              /month
            </span>
          </p>
        )}
      </div>

      <Link
        href={plan.ctaHref}
        onClick={() =>
          track('plan_cta_clicked', { plan_id: plan.id, billing_cycle: cycle })
        }
        className={cn(
          'mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-(--lp2-ink) text-sm font-bold',
          plan.ctaVariant === 'primary'
            ? 'bg-(--lp2-grass) text-white'
            : 'bg-(--lp2-cream)',
          press,
        )}
      >
        {plan.ctaLabel}
        <ArrowRight className="size-4" strokeWidth={2.75} />
      </Link>

      {/* Key stats */}
      <dl className="mt-6 grid grid-cols-2 gap-3 border-y-2 border-(--lp2-ink)/10 py-4">
        <Stat icon={<Users className="size-4" />} label="Users" value={plan.limits.users} />
        <Stat
          icon={<Smartphone className="size-4" />}
          label="Numbers"
          value={plan.limits.whatsappNumbers}
        />
        <Stat
          icon={<Contact className="size-4" />}
          label="Contacts"
          value={
            typeof plan.limits.contacts === 'number'
              ? plan.limits.contacts.toLocaleString('en-IN')
              : plan.limits.contacts
          }
        />
        <Stat
          icon={<Sparkles className="size-4" />}
          label="Maya AI"
          value={
            plan.limits.mayaAi ? (
              <Check className="size-4 text-(--lp2-grass)" strokeWidth={3.5} />
            ) : (
              <X className="size-4 text-(--lp2-ink-soft)" strokeWidth={3.5} />
            )
          }
        />
      </dl>

      {/* Features */}
      <ul className="mt-5 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `var(--lp2-${hue})` }}
            >
              <Check
                className={cn('size-3', DARK_HUES.has(hue) && 'text-white')}
                strokeWidth={4}
              />
            </span>
            <span className="text-sm leading-snug font-medium text-pretty">{f}</span>
          </li>
        ))}
      </ul>

      {plan.notIncluded && plan.notIncluded.length > 0 && (
        <div className="mt-5 border-t-2 border-(--lp2-ink)/10 pt-4">
          <p className="text-[11px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
            Not included
          </p>
          <ul className="mt-2 space-y-1.5">
            {plan.notIncluded.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-xs font-medium text-(--lp2-ink-soft)"
              >
                <X className="mt-0.5 size-3 shrink-0" strokeWidth={3} />
                <span className="text-pretty">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-(--lp2-ink-soft)">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-bold tracking-wide text-(--lp2-ink-soft) uppercase">
          {label}
        </dt>
        <dd className="flex items-center text-sm font-extrabold">{value}</dd>
      </div>
    </div>
  );
}
