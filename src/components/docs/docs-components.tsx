import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Info,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { docHref, docsSiblings } from '@/lib/docs/nav';

/**
 * Shared building blocks for every /docs/* content page.
 *
 * Same lp2 design tokens (ink/cream/paper, DM Sans) as `/`, but
 * deliberately without its stickers, blobs, or hard offset shadows —
 * see docs/layout.tsx for why. The accent colour throughout is the
 * brand green (--lp2-grass), not the confetti hues the marketing page
 * cycles through, so this reads as one steady reference rather than a
 * pitch.
 *
 * There's no MDX/CMS layer in this codebase (the landing page and blog
 * are hand-authored TSX too), so docs pages are plain .tsx files built
 * from these primitives rather than markdown files. `DocsArticle` styles
 * bare `<h2>` / `<h3>` / `<p>` / `<ul>` / `<ol>` / `<a>` / `<code>` /
 * `<strong>` tags via descendant selectors, so page bodies read as
 * ordinary HTML-ish JSX instead of every element needing its own
 * className.
 */

export function DocsArticle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'max-w-3xl',
        '[&>h2]:mt-14 [&>h2]:scroll-mt-24 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:tracking-tight [&>h2]:text-(--lp2-ink) [&>h2:first-child]:mt-0',
        '[&>h3]:mt-10 [&>h3]:scroll-mt-24 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-(--lp2-ink)',
        '[&>p]:mt-4 [&>p]:text-[15px] [&>p]:leading-relaxed [&>p]:text-(--lp2-ink-soft)',
        '[&>ul]:mt-4 [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul]:text-[15px] [&>ul]:text-(--lp2-ink-soft) [&>ul]:list-disc',
        '[&>ol]:mt-4 [&>ol]:space-y-2 [&>ol]:pl-5 [&>ol]:text-[15px] [&>ol]:text-(--lp2-ink-soft) [&>ol]:list-decimal',
        '[&_li>ul]:mt-2 [&_li>ul]:mb-0',
        '[&_strong]:font-bold [&_strong]:text-(--lp2-ink)',
        '[&_code]:rounded [&_code]:bg-(--lp2-cream) [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-(--lp2-ink)',
        '[&_a]:font-semibold [&_a]:text-(--lp2-grass-deep) [&_a]:underline [&_a]:decoration-(--lp2-grass)/30 [&_a]:underline-offset-2 [&_a]:hover:decoration-(--lp2-grass-deep)',
      )}
    >
      {children}
    </div>
  );
}

export function DocsHero({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: 'Beta' | 'Coming soon';
}) {
  return (
    <div className="max-w-3xl border-b border-(--lp2-ink)/10 pb-8">
      <p className="text-sm font-bold text-(--lp2-grass-deep)">{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="lp2-display text-3xl font-extrabold text-balance sm:text-4xl">
          {title}
        </h1>
        {badge && (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-bold',
              badge === 'Coming soon'
                ? 'bg-(--lp2-ink)/8 text-(--lp2-ink-soft)'
                : 'bg-(--lp2-tangerine-soft) text-(--lp2-tangerine)',
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 text-base leading-relaxed text-(--lp2-ink-soft) text-pretty">
        {description}
      </p>
    </div>
  );
}

const CALLOUT_STYLE: Record<
  'info' | 'tip' | 'warning',
  { icon: LucideIcon; classes: string }
> = {
  info: { icon: Info, classes: 'border-(--lp2-ink)/10 bg-(--lp2-cream) text-(--lp2-ink)' },
  tip: {
    icon: Lightbulb,
    classes: 'border-(--lp2-grass)/20 bg-(--lp2-mint)/50 text-(--lp2-ink)',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-(--lp2-coral)/25 bg-(--lp2-coral-soft)/50 text-(--lp2-ink)',
  },
};

/** Callout box for gotchas, permission requirements, and plan-gating
 *  notes — the kind of aside that shouldn't interrupt the main prose
 *  flow but needs to stand out visually. */
export function DocsCallout({
  type = 'info',
  title,
  children,
}: {
  type?: 'info' | 'tip' | 'warning';
  title?: string;
  children: React.ReactNode;
}) {
  const { icon: Icon, classes } = CALLOUT_STYLE[type];
  return (
    <div className={cn('mt-6 flex gap-3 rounded-xl border p-4', classes)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="text-[14px] leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        <div className={cn(title && 'mt-1', 'text-(--lp2-ink-soft) [&_strong]:text-(--lp2-ink) [&_strong]:font-bold')}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Numbered walkthrough steps — same idea as the landing page's "How
 *  it works" cards, restyled flat (no sticker shadow) for a reference
 *  page. */
export function DocsSteps({
  steps,
}: {
  steps: { title: string; description: React.ReactNode }[];
}) {
  return (
    <ol className="mt-6 space-y-4">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="flex gap-4 rounded-xl border border-(--lp2-ink)/10 bg-(--lp2-paper) p-5"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--lp2-grass) text-sm font-bold text-white">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-bold text-(--lp2-ink)">{step.title}</p>
            <div className="mt-1 text-sm leading-relaxed text-(--lp2-ink-soft) [&_code]:rounded [&_code]:bg-(--lp2-cream) [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-(--lp2-ink)">
              {step.description}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Definition-table for field/parameter/event reference lists — used
 *  for contact fields, API request/response shapes, webhook events,
 *  automation trigger/action catalogs, etc. */
export function DocsFieldTable({
  columns = ['Field', 'Type', 'Description'],
  rows,
}: {
  columns?: string[];
  rows: { cells: React.ReactNode[]; }[];
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-(--lp2-ink)/10">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-(--lp2-ink)/10 bg-(--lp2-cream)">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-xs font-bold tracking-wide text-(--lp2-ink-soft) uppercase"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(i > 0 && 'border-t border-(--lp2-ink)/10')}
            >
              {row.cells.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    'px-4 py-2.5 align-top text-[13.5px] leading-relaxed',
                    j === 0
                      ? 'font-mono text-(--lp2-ink) whitespace-nowrap'
                      : 'text-(--lp2-ink-soft)',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Labelled code/URL block — for endpoint signatures, request bodies,
 *  env vars, and the like. Not a syntax highlighter, just a
 *  monospace panel consistent with the rest of the design system. */
export function DocsCode({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-(--lp2-ink)/10 bg-(--lp2-cream)">
      {label && (
        <div className="border-b border-(--lp2-ink)/10 px-4 py-2 text-xs font-bold tracking-wide text-(--lp2-ink-soft) uppercase">
          {label}
        </div>
      )}
      <pre className="p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-(--lp2-ink)">
        {children}
      </pre>
    </div>
  );
}

/** Prev/next pager at the bottom of every topic page, in the same
 *  reading order as the sidebar. */
export function DocsPager({ slug }: { slug: string }) {
  const { prev, next } = docsSiblings(slug);
  if (!prev && !next) return null;
  return (
    <div className="mt-16 flex items-stretch justify-between gap-4 border-t border-(--lp2-ink)/10 pt-8">
      {prev ? (
        <Link
          href={docHref(prev.slug)}
          className="group flex max-w-[48%] flex-col items-start gap-1 rounded-xl border border-(--lp2-ink)/10 bg-(--lp2-paper) px-4 py-3 transition-colors hover:border-(--lp2-grass)/30 hover:bg-(--lp2-mint)/40"
        >
          <span className="flex items-center gap-1 text-xs text-(--lp2-ink-soft)">
            <ArrowLeft className="size-3" /> Previous
          </span>
          <span className="text-sm font-bold text-(--lp2-ink) group-hover:text-(--lp2-grass-deep)">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={docHref(next.slug)}
          className="group ml-auto flex max-w-[48%] flex-col items-end gap-1 rounded-xl border border-(--lp2-ink)/10 bg-(--lp2-paper) px-4 py-3 text-right transition-colors hover:border-(--lp2-grass)/30 hover:bg-(--lp2-mint)/40"
        >
          <span className="flex items-center gap-1 text-xs text-(--lp2-ink-soft)">
            Next <ArrowRight className="size-3" />
          </span>
          <span className="text-sm font-bold text-(--lp2-ink) group-hover:text-(--lp2-grass-deep)">
            {next.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
