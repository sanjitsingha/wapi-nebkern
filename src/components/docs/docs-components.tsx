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
import { softBadge } from '@/lib/badge-colors';
import { docHref, docsSiblings } from '@/lib/docs/nav';

/**
 * Shared building blocks for every /docs/* content page.
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
        '[&>h2]:mt-14 [&>h2]:scroll-mt-24 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:tracking-tight [&>h2]:text-foreground [&>h2:first-child]:mt-0',
        '[&>h3]:mt-10 [&>h3]:scroll-mt-24 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-foreground',
        '[&>p]:mt-4 [&>p]:text-[15px] [&>p]:leading-relaxed [&>p]:text-muted-foreground',
        '[&>ul]:mt-4 [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul]:text-[15px] [&>ul]:text-muted-foreground [&>ul]:list-disc',
        '[&>ol]:mt-4 [&>ol]:space-y-2 [&>ol]:pl-5 [&>ol]:text-[15px] [&>ol]:text-muted-foreground [&>ol]:list-decimal',
        '[&_li>ul]:mt-2 [&_li>ul]:mb-0',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-foreground',
        '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/30 [&_a]:underline-offset-2 [&_a]:hover:decoration-primary',
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
    <div className="max-w-3xl border-b border-border pb-8">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        {badge && (
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-semibold',
              badge === 'Coming soon' ? softBadge.neutral : softBadge.amber,
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>
    </div>
  );
}

const CALLOUT_STYLE: Record<
  'info' | 'tip' | 'warning',
  { icon: LucideIcon; classes: string }
> = {
  info: { icon: Info, classes: 'border-border bg-card-2 text-foreground' },
  tip: {
    icon: Lightbulb,
    classes: 'border-primary/20 bg-primary-soft text-foreground',
  },
  warning: {
    icon: AlertTriangle,
    classes:
      'border-amber-200 bg-amber-50 text-foreground dark:border-amber-500/25 dark:bg-amber-500/10',
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
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && 'mt-1', 'text-muted-foreground [&_strong]:text-foreground [&_strong]:font-semibold')}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Numbered walkthrough steps — mirrors the "How it works" 1-2-3-4
 *  cards on the landing page, reused here for connect/setup flows. */
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
          className="flex gap-4 rounded-xl border border-border bg-card p-5"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-foreground">
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
    <div className="mt-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-card-2">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
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
              className={cn(i > 0 && 'border-t border-border')}
            >
              {row.cells.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    'px-4 py-2.5 align-top text-[13.5px] leading-relaxed',
                    j === 0
                      ? 'font-mono text-foreground whitespace-nowrap'
                      : 'text-muted-foreground',
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
    <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card-2">
      {label && (
        <div className="border-b border-border px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
      )}
      <pre className="p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
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
    <div className="mt-16 flex items-stretch justify-between gap-4 border-t border-border pt-8">
      {prev ? (
        <Link
          href={docHref(prev.slug)}
          className="group flex max-w-[48%] flex-col items-start gap-1 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary-soft"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" /> Previous
          </span>
          <span className="text-sm font-semibold text-foreground group-hover:text-primary">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={docHref(next.slug)}
          className="group ml-auto flex max-w-[48%] flex-col items-end gap-1 rounded-xl border border-border bg-card px-4 py-3 text-right transition-colors hover:border-primary/30 hover:bg-primary-soft"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Next <ArrowRight className="size-3" />
          </span>
          <span className="text-sm font-semibold text-foreground group-hover:text-primary">
            {next.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
