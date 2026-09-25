import Link from 'next/link';
import { ArrowRight, Check, Minus } from 'lucide-react';

import type { Comparison } from '@/lib/marketing/comparisons';
import { Sparkle } from './decor';
import { Btn } from './ui';

// ============================================================
// The body of a /compare/<slug> page.
//
// Everything here is driven by one `Comparison` object, so a new rival
// is a data entry and never a new component. See comparisons.ts for the
// rules those entries follow.
// ============================================================

/**
 * The table. Two columns rather than a tick grid: a tick says "has it"
 * and nothing about what it costs, which is the whole question on this
 * page. Every cell is a short sentence instead.
 *
 * Rows where the rival wins are marked and rendered as such. That is
 * deliberate — see the note in comparisons.ts.
 */
export function ComparisonTable({ data }: { data: Comparison }) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        {/* Header row, hidden on phones where each row stacks and
            carries its own labels instead. */}
        <div className="hidden grid-cols-[1.1fr_1fr_1fr] gap-4 pb-4 sm:grid">
          <span className="text-sm font-bold text-(--lp2-ink-soft)" />
          <span className="lp2-display text-lg font-extrabold">Instant</span>
          <span className="lp2-display text-lg font-extrabold text-(--lp2-ink-soft)">
            {data.rival}
          </span>
        </div>

        <div className="divide-y-2 divide-(--lp2-ink)/10 border-t-2 border-(--lp2-ink)/10">
          {data.rows.map((row) => (
            <div
              key={row.feature}
              className="grid gap-2 py-5 sm:grid-cols-[1.1fr_1fr_1fr] sm:gap-4"
            >
              <p className="text-sm font-bold text-(--lp2-ink)">{row.feature}</p>

              <div className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-(--lp2-grass)"
                >
                  {row.rivalBetter ? (
                    <Minus className="size-3" strokeWidth={3} />
                  ) : (
                    <Check className="size-3" strokeWidth={3} />
                  )}
                </span>
                <span className="text-sm leading-relaxed text-(--lp2-ink)">
                  {/* Phones lose the header row, so each cell says whose
                      answer it is. */}
                  <span className="font-bold sm:hidden">Instant: </span>
                  {row.instant}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-(--lp2-ink-soft)">
                <span className="font-bold sm:hidden">{data.rival}: </span>
                {row.rival}
              </p>
            </div>
          ))}
        </div>

        {/* Where the numbers came from and when. A comparison without
            this is unverifiable, and rivals change their pricing. */}
        <p className="mt-8 text-xs leading-relaxed text-(--lp2-ink-soft)">
          {data.rival} figures read from{' '}
          <a
            href={data.source}
            rel="nofollow noopener"
            className="underline underline-offset-2"
          >
            their own pricing page
          </a>{' '}
          on{' '}
          {new Date(data.checkedOn).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          , and quoted as published. Prices change — check theirs before
          you decide. Meta’s own per-conversation charges are the same
          whichever platform you use.
        </p>
      </div>
    </section>
  );
}

/**
 * Who each product suits. The rival column is not a courtesy: a
 * comparison that concludes "we win on everything" is an advert, and
 * the reader can tell.
 */
export function ComparisonVerdict({ data }: { data: Comparison }) {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border-2 border-(--lp2-ink) bg-white p-7 sm:p-8">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase">
            <Sparkle color={data.hue} className="size-3.5" />
            Choose Instant when
          </span>
          <ul className="mt-5 space-y-3">
            {data.verdict.instant.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <Check
                  aria-hidden
                  className="mt-1 size-4 shrink-0"
                  strokeWidth={3}
                />
                <span className="text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) p-7 sm:p-8">
          <span className="text-xs font-extrabold tracking-wide uppercase text-(--lp2-ink-soft)">
            Choose {data.rival} when
          </span>
          <ul className="mt-5 space-y-3">
            {data.verdict.rival.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <Minus
                  aria-hidden
                  className="mt-1 size-4 shrink-0 text-(--lp2-ink-soft)"
                  strokeWidth={3}
                />
                <span className="text-sm leading-relaxed text-(--lp2-ink-soft)">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Closing prompt, and a way back into the other comparisons. */
export function ComparisonCta({ data }: { data: Comparison }) {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="lp2-display text-3xl leading-tight font-extrabold text-balance sm:text-4xl">
          Try it before you switch
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-pretty text-(--lp2-ink-soft)">
          Fourteen days, every feature, no card. Keep your number — embedded
          signup moves it across for you.
        </p>
        <div className="mt-8 flex justify-center">
          <Btn href="/signup">
            Start free trial
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
        </div>
        <p className="mt-8 text-sm text-(--lp2-ink-soft)">
          <Link href="/compare" className="underline underline-offset-2">
            See the other comparisons
          </Link>
        </p>
      </div>
    </section>
  );
}
