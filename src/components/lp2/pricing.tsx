import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Sparkle } from './decor';
import { SectionHead, press } from './ui';

// ============================================================
// Pricing.
//
// Numbers, seat counts and capability splits are copied from the live
// landing page (`src/app/page.tsx`), which took them from the real
// `billing_plans` rows — so this table is accurate, not illustrative.
// It is static copy on both pages: nothing syncs it to the admin panel,
// so if a plan changes, both tables need the edit.
//
// Flat treatment: white section, faint hairline cards (the featured one
// emphasised by a lift + a slightly stronger line, not a shadow),
// gentler corners, and borderless inner graphics.
// ============================================================

const PLANS = [
  {
    name: 'Try',
    tagline: 'Kick the tyres on a real number, with your own contacts.',
    price: '₹100',
    meta: '2 seats · 60 contacts',
    hue: 'sky',
    featured: false,
    featuresTitle: 'Key features',
    features: [
      'Shared team inbox on the official API',
      'Contacts, tags and custom fields',
      'Message templates and broadcasts',
      'Sales pipelines and deal stages',
      'AI agent with your own knowledge base',
    ],
  },
  {
    name: 'Pro',
    tagline: 'For teams running sales and support on WhatsApp daily.',
    price: '₹999',
    meta: '10 seats · 25,000 contacts',
    hue: 'lemon',
    featured: true,
    featuresTitle: 'Everything in Try, plus',
    features: [
      'No-code automations and triggers',
      'Flows — the visual chatbot builder',
      'WhatsApp calling',
      'Instagram and Messenger channels',
      'REST API, API keys and webhooks',
    ],
  },
  {
    name: 'Business',
    tagline: 'Unlimited everything, for when WhatsApp is the whole business.',
    price: '₹2,499',
    meta: 'Unlimited seats · unlimited contacts',
    hue: 'grape',
    featured: false,
    featuresTitle: 'Everything in Pro, plus',
    features: [
      'Unlimited team members',
      'Unlimited contacts',
      'Roles and granular permissions',
      'Priority support, faster responses',
      'Self-host on your own infrastructure',
    ],
  },
] as const;

export function Lp2Pricing({
  compareLink = true,
}: {
  /** Show the "compare every plan" link under the table. On by default;
   *  off on /pricing, where the matrix it points at is on the same
   *  page a screen further down. */
  compareLink?: boolean;
} = {}) {
  return (
    <section id="pricing" className="scroll-mt-28 bg-(--lp2-coral-soft) py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="grape"
          title="Plans that stay friendly as you grow."
          highlight="stay friendly"
          subtitle="Every plan runs on the official WhatsApp Business API and starts with a 14-day trial. No card, no sales call, no minimum term."
        />

        {/* `items-start` so a taller card can't stretch its neighbours
            into matching whitespace — each ends where its content does. */}
        <div className="mx-auto mt-14 grid max-w-lg items-start gap-6 lg:max-w-none lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'relative flex flex-col rounded-xl border-2 border-(--lp2-ink) bg-white p-6 transition-transform duration-200 hover:-translate-y-1 sm:p-7',
                // The featured card is lifted so the eye is told where
                // to land (the black outline is shared by all three).
                plan.featured && 'lg:-mt-4 lg:pb-9',
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-(--lp2-coral) px-3 py-1 text-[11px] font-extrabold tracking-wide text-white uppercase">
                  <Sparkle color="lemon" className="size-3" />
                  Most loved
                </span>
              )}

              {/* Price block sits on the plan's hue, so each column is
                  identifiable at a glance from across the page. */}
              <div
                className="rounded-xl p-5"
                style={{ backgroundColor: `var(--lp2-${plan.hue}-soft)` }}
              >
                <h3 className="lp2-display text-xl font-extrabold">
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed font-semibold text-(--lp2-ink-soft)">
                  {plan.tagline}
                </p>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="lp2-display text-4xl font-extrabold">
                    {plan.price}
                  </span>
                  <span className="text-sm font-bold text-(--lp2-ink-soft)">
                    /month
                  </span>
                </p>
                <p className="mt-1.5 text-xs font-bold text-(--lp2-ink-soft)">
                  {plan.meta}
                </p>
              </div>

              <Link
                href="/signup"
                className={cn(
                  'mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold',
                  plan.featured
                    ? 'bg-(--lp2-grass) text-white'
                    : 'bg-(--lp2-cream)',
                  press,
                )}
              >
                Start free trial
                <ArrowRight className="size-4" strokeWidth={2.75} />
              </Link>

              <p className="mt-6 text-xs font-extrabold tracking-wide uppercase">
                {plan.featuresTitle}
              </p>
              <ul className="mt-4 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `var(--lp2-${plan.hue})` }}
                    >
                      <Check
                        className={cn(
                          'size-3',
                          // Sky and grape are dark enough that an ink
                          // tick disappears into them.
                          (plan.hue === 'sky' || plan.hue === 'grape') &&
                            'text-white',
                        )}
                        strokeWidth={4}
                      />
                    </span>
                    <span className="text-sm leading-snug font-medium">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm font-semibold text-(--lp2-ink-soft)">
          All prices in INR. Cancel any time — your contacts and history stay
          yours.
        </p>

        {compareLink && (
          <p className="mt-4 text-center">
            <Link
              href="/pricing"
              className={cn(
                'inline-flex h-11 items-center gap-1.5 rounded-xl border-2 border-(--lp2-ink) bg-white px-5 text-sm font-bold shadow-(--lp2-shadow-sm)',
                press,
              )}
            >
              Compare every plan, line by line
              <ArrowRight className="size-4" strokeWidth={2.75} />
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
