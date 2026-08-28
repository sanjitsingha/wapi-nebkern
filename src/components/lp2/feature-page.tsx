import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DotField, Highlight, Sparkle, type Lp2Hue } from './decor';
import { Btn, SectionHead } from './ui';

// ============================================================
// The shared frame every /features/* page is built from.
//
// Four pages that each hand-rolled a hero, a proof list and a closing
// section would drift apart within a month — three different heading
// sizes, three ideas of how much padding a section gets. These are the
// parts, and a feature page is a short file that arranges them.
//
// Everything is a server component: no state, no client bundle.
// ============================================================

/* ─── Hero ────────────────────────────────────────────────────────── */

/**
 * The top of a feature page.
 *
 * Deliberately narrower than the homepage hero — one product surface,
 * one sentence about it, one button. The eyebrow names the category so
 * a visitor arriving from search knows what kind of page they landed on
 * before they read the headline.
 */
export function FeatureHero({
  eyebrow,
  title,
  highlight,
  hue,
  body,
  visual,
}: {
  eyebrow: string;
  title: string;
  /** Substring of `title` to box. Must appear verbatim. */
  highlight: string;
  hue: Lp2Hue;
  body: string;
  /** The screen, card or diagram that shows the thing working. */
  visual?: ReactNode;
}) {
  const [before, after] = title.includes(highlight)
    ? [
        title.slice(0, title.indexOf(highlight)),
        title.slice(title.indexOf(highlight) + highlight.length),
      ]
    : [title, ''];

  return (
    <section
      className="relative -mt-19 overflow-hidden pt-19 sm:-mt-20 sm:pt-20"
      style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
    >
      <DotField />

      <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
        <span
          className="inline-flex items-center gap-2 rounded-full border-2 border-(--lp2-ink) bg-white px-3.5 py-1.5 text-xs font-bold shadow-(--lp2-shadow-sm)"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          <Sparkle color={hue} className="size-3.5" />
          {eyebrow}
        </span>

        <h1 className="lp2-display mt-6 text-4xl leading-[1.08] font-extrabold text-balance sm:text-6xl">
          {before}
          <Highlight color={hue}>{highlight}</Highlight>
          {after}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
          {body}
        </p>

        <div className="mt-9 flex justify-center">
          <Btn href="/signup">
            Start free trial
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
        </div>

        {visual && <div className="mt-14">{visual}</div>}
      </div>
    </section>
  );
}

/* ─── Three-up ────────────────────────────────────────────────────── */

export interface FeaturePoint {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** The three things this surface actually does, side by side. */
export function FeatureTrio({
  hue,
  points,
}: {
  hue: Lp2Hue;
  points: FeaturePoint[];
}) {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {points.map((p) => (
            <div
              key={p.title}
              className="flex flex-col rounded-2xl border-2 border-(--lp2-ink) bg-white p-6"
            >
              <span
                className="flex size-11 items-center justify-center rounded-xl border-2 border-(--lp2-ink)"
                style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
              >
                <p.icon
                  className="size-5"
                  style={{ color: `var(--lp2-${hue})` }}
                  strokeWidth={2.5}
                />
              </span>
              <p className="lp2-display mt-4 text-lg font-extrabold">
                {p.title}
              </p>
              <p className="mt-2 flex-1 text-lg leading-relaxed text-(--lp2-ink-soft)">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Split ───────────────────────────────────────────────────────── */

/**
 * Copy on one side, a visual on the other.
 *
 * `flip` puts the visual first on desktop. Alternating it down a page
 * is what stops three of these in a row reading as one long column.
 */
export function FeatureSplit({
  hue,
  title,
  highlight,
  body,
  points,
  visual,
  flip = false,
  tint = false,
}: {
  hue: Lp2Hue;
  title: string;
  highlight: string;
  body: string;
  points?: string[];
  visual: ReactNode;
  flip?: boolean;
  /** Wash the section in the hue, for rhythm against white neighbours. */
  tint?: boolean;
}) {
  const [before, after] = title.includes(highlight)
    ? [
        title.slice(0, title.indexOf(highlight)),
        title.slice(title.indexOf(highlight) + highlight.length),
      ]
    : [title, ''];

  return (
    <section
      className={cn('py-20 sm:py-28', !tint && 'bg-white')}
      style={
        tint ? { backgroundColor: `color-mix(in oklab, var(--lp2-${hue}-soft) 40%, #fff)` } : undefined
      }
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div className={cn(flip && 'lg:order-last')}>
          <h2 className="lp2-display text-3xl leading-[1.1] font-extrabold text-balance sm:text-[2.5rem]">
            {before}
            <Highlight color={hue}>{highlight}</Highlight>
            {after}
          </h2>
          <p className="mt-5 text-xl leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-2xl">
            {body}
          </p>

          {points && points.length > 0 && (
            <ul className="mt-7 space-y-3">
              {points.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
                  >
                    <Check
                      className="size-3.5"
                      style={{ color: `var(--lp2-${hue})` }}
                      strokeWidth={3.5}
                    />
                  </span>
                  <span className="text-sm leading-relaxed font-medium sm:text-base">
                    {t}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>{visual}</div>
      </div>
    </section>
  );
}

/* ─── Closing list ────────────────────────────────────────────────── */

/** The smaller capabilities, in a grid, so the page can be thorough
 *  without giving every one of them its own section. */
export function FeatureGrid({
  hue,
  title,
  highlight,
  subtitle,
  items,
}: {
  hue: Lp2Hue;
  title: string;
  highlight: string;
  subtitle: string;
  items: { title: string; body: string }[];
}) {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHead
          hue={hue}
          title={title}
          highlight={highlight}
          subtitle={subtitle}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {items.map((i) => (
            <div
              key={i.title}
              className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-cream) p-6"
            >
              <p className="lp2-display text-lg font-extrabold">{i.title}</p>
              <p className="mt-2 text-lg leading-relaxed text-(--lp2-ink-soft)">
                {i.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Shared visual bits ──────────────────────────────────────────── */

/** A framed "screen" — the site's card treatment at panel size. */
export function FeatureScreen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)',
        className,
      )}
    >
      {children}
    </div>
  );
}
