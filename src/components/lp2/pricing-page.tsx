import Link from 'next/link';
import { ArrowRight, Check, Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ADDONS,
  COMPETITOR_COMPARISON,
  FAIR_USE,
  MAYA,
  META_PRICING,
  inr,
} from '@/lib/marketing/pricing-data';
import { DotField, Highlight, Sparkle } from './decor';
import { Btn, SectionHead } from './ui';
import { PricingFaqList, TrackInView } from './pricing-trackers';

// ============================================================
// /pricing — the dedicated pricing page for Instant by Nebkern.
//
// The 4 plan cards + billing toggle live in `pricing-cards.tsx` (client).
// This file holds every static section around them: the hero, the Meta
// pass-through pricing block, "how Maya works", add-ons, the competitor
// comparison, the fair-use policy and the FAQ. Copy comes from
// src/lib/marketing/pricing-data.ts — edit numbers there, not here.
//
// Meta model is PASS-THROUGH: Meta bills the customer's own WABA directly,
// so "0% markup" means "we add nothing", never "buy Meta credits from us".
// ============================================================

/* ═══════════════════════════ Hero ═══════════════════════════════ */

export function PricingHero() {
  return (
    <section className="relative -mt-19 overflow-hidden bg-(--lp2-mint) pt-19 sm:-mt-20 sm:pt-20">
      <DotField />

      <div className="relative mx-auto max-w-5xl px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
        <span
          className="inline-flex items-center gap-2 rounded-full border-2 border-(--lp2-ink) bg-white px-3.5 py-1.5 text-xs font-bold shadow-(--lp2-shadow-sm)"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          <Sparkle color="lemon" className="size-3.5" />
          Maya included · unlimited AI replies · zero markup on Meta
        </span>

        <h1 className="lp2-display mx-auto mt-6 max-w-5xl text-4xl leading-[1.08] font-extrabold text-pretty sm:text-6xl">
          WhatsApp API with Maya AI,
          <br className="hidden sm:block" /> at prices that{' '}
          <Highlight color="lemon">actually make sense</Highlight>.
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
          A flat platform fee, and every rupee you send to Meta goes to Meta —
          passed through at cost, with no hidden markup, ever.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════ Meta message pricing (pass-through) ═════════════ */

export function MetaPricingBlock() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHead
          hue="lemon"
          title="What you pay Meta — passed through at zero markup"
          highlight="zero markup"
          subtitle={META_PRICING.intro}
        />

        <div className="mt-14 overflow-hidden rounded-2xl border-2 border-(--lp2-ink) shadow-(--lp2-shadow)">
          <div className="grid grid-cols-[2fr_1fr_1fr] bg-(--lp2-ink) text-white">
            <Cell head>Message type</Cell>
            <Cell head center>
              Meta charge (India)
            </Cell>
            <Cell head center>
              Instant markup
            </Cell>
          </div>
          {META_PRICING.rates.map((r, i) => (
            <div
              key={r.type}
              className={cn(
                'grid grid-cols-[2fr_1fr_1fr] border-t-2 border-(--lp2-ink)/15',
                i % 2 === 0 ? 'bg-white' : 'bg-(--lp2-cream)',
              )}
            >
              <Cell>{r.type}</Cell>
              <Cell center>
                <span className="font-bold">{r.metaCharge}</span>
              </Cell>
              <Cell center>
                <span className="rounded-full bg-(--lp2-grass) px-2.5 py-0.5 text-xs font-extrabold text-white">
                  {r.markup}
                </span>
              </Cell>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-(--lp2-ink-soft)">
          {META_PRICING.footnote} Meta bills these to your own WhatsApp Business
          Account directly — they never pass through Instant.
        </p>
      </div>
    </section>
  );
}

function Cell({
  children,
  head,
  center,
}: {
  children: React.ReactNode;
  head?: boolean;
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        'px-4 py-3.5 text-sm sm:px-5',
        center && 'text-center',
        head ? 'font-extrabold' : 'font-semibold',
      )}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════ How Maya works ═════════════════════════ */

export function HowMayaWorks() {
  return (
    <section className="bg-(--lp2-grape-soft) py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHead
          hue="grape"
          highlightText="white"
          title="Meet Maya — your AI agent, trained only on what you tell her"
          highlight="trained only on what you tell her"
        />

        <div className="mx-auto mt-10 max-w-3xl space-y-4 text-lg leading-relaxed text-(--lp2-ink-soft)">
          <p>
            Maya is your always-on WhatsApp agent. She replies to customers
            24×7, in natural, human-like language, in English and multiple
            Indian languages.
          </p>
          <p>
            <span className="font-bold text-(--lp2-ink)">
              The important part:
            </span>{' '}
            Maya only knows what you teach her. Upload your product catalog,
            FAQs, doctor schedules, service pricing, hospital protocols,
            appointment rules — whatever you want her to handle. Paste text
            directly, or upload PDFs, Word files, or spreadsheets. Maya reads
            it, understands it, and uses only that content to answer your
            customers.
          </p>
          <p>
            She will <span className="font-bold text-(--lp2-ink)">never</span>{' '}
            make up answers, pull from the general internet, or say something
            you didn&rsquo;t authorize. If a customer asks about something
            outside your provided content, Maya politely says she doesn&rsquo;t
            know and offers to hand off to a human agent on your team.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {MAYA.columns.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border-2 border-(--lp2-ink) bg-white p-6 shadow-(--lp2-shadow-sm)"
            >
              <span className="text-3xl" aria-hidden>
                {c.icon}
              </span>
              <h3 className="lp2-display mt-3 text-lg font-extrabold text-pretty">
                {c.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed font-medium text-(--lp2-ink-soft)">
                {c.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border-2 border-(--lp2-ink) bg-white">
          {MAYA.knowledgeByPlan.map((row, i) => (
            <div
              key={row.plan}
              className={cn(
                'grid grid-cols-[1fr_2fr] gap-3 px-5 py-3.5',
                i > 0 && 'border-t-2 border-(--lp2-ink)/10',
              )}
            >
              <span className="text-sm font-extrabold">{row.plan}</span>
              <span className="text-sm font-medium text-(--lp2-ink-soft)">
                {row.source}
              </span>
            </div>
          ))}
        </div>

        {/* Fair-use lives here now, as one quiet line with a hover/focus
            info box, instead of its own section. CSS-only (peer-hover),
            so this section stays server-rendered. */}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-(--lp2-ink-soft)">
          &ldquo;Unlimited&rdquo; Maya replies are subject to fair use
          <span className="relative inline-flex">
            <button
              type="button"
              aria-label={FAIR_USE.title}
              aria-describedby="maya-fairuse"
              className="peer inline-flex size-4 items-center justify-center rounded-full text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink) focus-visible:text-(--lp2-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp2-ink)"
            >
              <Info className="size-4" strokeWidth={2.5} />
            </button>
            <span
              id="maya-fairuse"
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-72 max-w-[85vw] -translate-x-1/2 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-ink) px-3.5 py-3 text-left opacity-0 shadow-(--lp2-shadow-sm) transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100"
            >
              <span className="block text-xs font-extrabold text-white">
                {FAIR_USE.title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed font-medium text-white/85">
                {FAIR_USE.body}
              </span>
            </span>
          </span>
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════ Add-ons ════════════════════════════ */

export function AddonsBlock() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <SectionHead
          hue="sky"
          title="Add-ons — transparent, no surprises"
          highlight="no surprises"
        />

        <div className="mt-12 overflow-hidden rounded-2xl border-2 border-(--lp2-ink) shadow-(--lp2-shadow)">
          {ADDONS.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                'flex items-center justify-between gap-4 px-5 py-4',
                i % 2 === 0 ? 'bg-white' : 'bg-(--lp2-cream)',
                i > 0 && 'border-t-2 border-(--lp2-ink)/15',
              )}
            >
              <span className="text-sm font-semibold text-pretty">{a.label}</span>
              <span className="shrink-0 text-sm font-extrabold whitespace-nowrap">
                {inr(a.price)}
                <span className="text-(--lp2-ink-soft)">
                  {a.unit === 'one-time' ? ' one-time' : a.unit}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ Competitor comparison ══════════════════════ */

export function CompetitorComparison() {
  const { scenario, rows, footnote } = COMPETITOR_COMPARISON;
  return (
    <section className="bg-(--lp2-sky-soft) py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="sky"
          title="See how much you save vs Wati, AiSensy, and Interakt"
          highlight="how much you save"
          subtitle={`Example: A D2C brand sending ${scenario}.`}
        />

        <TrackInView event="competitor_comparison_viewed">
          <div className="mt-14 overflow-x-auto">
            <div className="min-w-[720px] overflow-hidden rounded-2xl border-2 border-(--lp2-ink) shadow-(--lp2-shadow-lg)">
              <div className="grid grid-cols-[1.6fr_1fr_1.4fr_1.4fr_1fr_1fr] bg-(--lp2-ink) text-white">
                <Cell head>Provider</Cell>
                <Cell head center>
                  Platform fee
                </Cell>
                <Cell head center>
                  AI included?
                </Cell>
                <Cell head center>
                  Meta charges
                </Cell>
                <Cell head center>
                  Total/month
                </Cell>
                <Cell head center>
                  You save
                </Cell>
              </div>
              {rows.map((row, i) => (
                <div
                  key={row.provider}
                  className={cn(
                    'grid grid-cols-[1.6fr_1fr_1.4fr_1.4fr_1fr_1fr] border-t-2 border-(--lp2-ink)/15',
                    row.highlight
                      ? 'bg-(--lp2-mint)'
                      : i % 2 === 0
                        ? 'bg-white'
                        : 'bg-(--lp2-cream)',
                  )}
                >
                  <Cell>
                    <span className={cn(row.highlight && 'font-extrabold')}>
                      {row.provider}
                    </span>
                  </Cell>
                  <Cell center>{row.platformFee}</Cell>
                  <Cell center>{row.aiIncluded}</Cell>
                  <Cell center>{row.metaCharges}</Cell>
                  <Cell center>
                    <span className={cn('font-extrabold', row.highlight && 'text-(--lp2-grass)')}>
                      {inr(row.total)}
                    </span>
                  </Cell>
                  <Cell center>
                    <span className="font-bold">{row.save}</span>
                  </Cell>
                </div>
              ))}
            </div>
          </div>
        </TrackInView>

        <p className="mt-6 text-center text-xs leading-relaxed text-(--lp2-ink-soft)">
          {footnote}
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════ FAQ ════════════════════════════════ */

export function PricingFaq() {
  return (
    <section className="bg-(--lp2-grape-soft) py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead
          hue="pop"
          title="The awkward questions, answered first."
          highlight="answered first"
        />

        <div className="mt-12">
          <PricingFaqList />
        </div>

        <p className="mt-8 text-center text-lg font-semibold text-(--lp2-ink-soft)">
          Still unsure?{' '}
          <Link href="/contact" className="underline underline-offset-2">
            Ask us anything
          </Link>{' '}
          — a person answers.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════ Final CTA banner ═══════════════════════ */

export function PricingFinalCta() {
  return (
    <section className="bg-(--lp2-coral-soft) py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="lp2-display text-3xl font-extrabold text-balance sm:text-5xl">
          Start your 14-day free trial.
        </h2>
        <p className="mt-4 text-xl font-semibold text-(--lp2-ink-soft)">
          No credit card required.
        </p>
        <div className="mt-9 flex justify-center">
          <Btn href="/signup">
            Start free trial
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
        </div>
        <p className="mt-6 text-xs font-semibold text-(--lp2-ink-soft)">
          All prices exclude 18% GST.
        </p>
      </div>
    </section>
  );
}
