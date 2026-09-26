import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Minus } from 'lucide-react';

import type { Comparison } from '@/lib/marketing/comparisons';
import { BrandLogo } from '@/components/brand/logo';
import { Highlight } from './decor';
import { Btn } from './ui';

// ============================================================
// The body of a /compare/<slug> page.
//
// Everything here is driven by one `Comparison` object, so a new rival
// is a data entry and never a new component. See comparisons.ts for the
// rules those entries follow.
// ============================================================

/**
 * The hero for a comparison page.
 *
 * Its own rather than `FeatureHero`, which the /features pages use:
 * those carry an eyebrow chip and a hue-tinted band, and these want
 * neither — a comparison opens on the question, not on a label.
 * Forking it keeps the feature pages exactly as they are.
 *
 * `bg-[var(--wa-white,#fff)]` rather than `bg-white`, because
 * whatsapp.css repaints `section.bg-white` to the cream canvas and
 * the plain utility would silently render cream. The fallback keeps
 * it white under the playful design, which has no --wa-white.
 */
export function ComparisonHero({ data }: { data: Comparison }) {
  return (
    <section className="relative -mt-19 bg-[var(--wa-white,#ffffff)] pt-19 sm:-mt-20 sm:pt-20">
      <div className="mx-auto max-w-4xl px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
        <h1 className="lp2-display text-4xl leading-[1.08] font-extrabold text-balance sm:text-6xl">
          Instant vs <Highlight color={data.hue}>{data.rival}</Highlight>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
          {data.intro}
        </p>
      </div>
    </section>
  );
}

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
        {/* The same card the landing page's compare tiles use: white on
            the cream canvas, a 25px tile radius, and the hard shadow.
            `lp2-hard-shadow` carries no styling — it is the opt-out from
            whatsapp.css's blanket `box-shadow: none !important`, without
            which the shadow is stripped and nothing renders. */}
        <div className="lp2-hard-shadow rounded-[25px] bg-white p-6 shadow-[4px_4px_0_2px_rgba(0,0,0,0.05)] sm:p-8">
          {/* Header row, hidden on phones where each row stacks and
              carries its own labels instead. */}
          <div className="hidden grid-cols-[1.1fr_1fr_1fr] gap-4 pb-4 sm:grid">
            <span className="text-sm font-bold text-(--lp2-ink-soft)" />
            {/* Logos rather than names: the header is the one place the two
                products are set against each other, and a wordmark is
                quicker to place than a line of text. Sized by height so
                marks of different proportions sit on one line. A rival
                with no logo falls back to their name. */}
            <span className="flex items-center">
              <BrandLogo className="h-7" />
            </span>
            <span className="flex items-center">
              {data.rivalLogo ? (
                <Image
                  src={data.rivalLogo.src}
                  alt={data.rival}
                  width={data.rivalLogo.width}
                  height={data.rivalLogo.height}
                  sizes="160px"
                  className="h-11 w-auto"
                />
              ) : (
                <span className="lp2-display text-lg font-extrabold text-(--lp2-ink-soft)">
                  {data.rival}
                </span>
              )}
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
