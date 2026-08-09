import Link from 'next/link';

import { cn } from '@/lib/utils';

// ============================================================
// Admin panel primitives.
//
// A back office is read, scanned and acted on, not admired. These are
// built for that: hairline rules instead of card shadows, cells that
// share edges instead of floating apart, monospace on anything you
// compare down a column, and 10px tracked caps for labels so the eye
// separates "what this is" from "what it says" without a size jump.
//
// A page should never be hand-writing `rounded-xl border bg-card p-4`
// again — sixteen pages doing that is how sixteen slightly different
// tables happened the first time.
//
// The 2px corner comes from `--radius` on the admin root (admin.css),
// not from classes here, so shadcn components rendered inside these
// panels match without knowing anything about the admin.
// ============================================================

/* ─── Page header ─────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  meta,
  children,
}: {
  title: string;
  description?: string;
  /** Small mono facts printed under the title — counts, freshness. */
  meta?: React.ReactNode;
  /** Actions, right-aligned. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--admin-line) pb-4">
      <div className="min-w-0">
        <h1 className="text-foreground text-lg font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {description}
          </p>
        )}
        {meta && (
          <div className="text-muted-foreground/80 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
            {meta}
          </div>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Panel ───────────────────────────────────────────────────────── */

export function Panel({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'bg-card overflow-hidden rounded-sm border border-(--admin-line)',
        className
      )}
    >
      {(title || actions) && (
        <header className="bg-muted/30 flex items-center justify-between gap-3 border-b border-(--admin-line) px-3 py-2">
          <div className="min-w-0">
            {title && (
              <h2 className="admin-label text-muted-foreground">{title}</h2>
            )}
            {description && (
              <p className="text-muted-foreground/80 mt-1 text-xs">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={bodyClassName ?? 'p-3'}>{children}</div>
    </section>
  );
}

/* ─── Stat ────────────────────────────────────────────────────────── */

const TONES: Record<string, string> = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  info: 'text-blue-600 dark:text-blue-400',
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  success: 'text-emerald-600 dark:text-emerald-400',
};

export type StatTone = keyof typeof TONES;

/**
 * One readout.
 *
 * Designed to sit in a `StatRow`, where cards share edges rather than
 * floating on their own — a strip of instruments reads as one
 * dashboard, four separate cards read as four unrelated facts.
 *
 * The tone colours the 2px top marker and the icon only. Tinting the
 * whole card is what made the old version look like a marketing page:
 * six pastel rectangles competing for the same attention.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = 'default',
  delta,
  children,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
  href?: string;
  tone?: StatTone;
  /** Percent change vs the previous period. Sign decides the colour. */
  delta?: number | null;
  /** Sparkline or similar, drawn under the value. */
  children?: React.ReactNode;
}) {
  const body = (
    <div
      className={cn(
        'bg-card relative h-full px-3 py-2.5 transition-colors',
        href && 'hover:bg-muted/40'
      )}
    >
      {/* Top marker rather than a tinted panel: it colour-codes the
          card from the corner of your eye and stays out of the way of
          the number, which is the thing you came to read. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-0.5',
          tone === 'default' ? 'bg-transparent' : 'bg-current',
          TONES[tone]
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="admin-label text-muted-foreground truncate">{label}</p>
        {icon && (
          <span className={cn('shrink-0', TONES[tone])}>{icon}</span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="admin-num text-foreground text-2xl font-semibold">
          {value}
        </p>
        {typeof delta === 'number' && delta !== 0 && (
          <span
            className={cn(
              'admin-num text-xs font-medium',
              delta > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p className="text-muted-foreground mt-1 truncate text-[11px]">
          {hint}
        </p>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="group block">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * A strip of StatCards sharing hairline dividers.
 *
 * `gap-px` over the line colour is the trick: the gap itself becomes
 * the rule, so there is exactly one hairline between neighbours
 * instead of two borders sitting side by side.
 */
export function StatRow({
  cols = 4,
  children,
}: {
  cols?: 2 | 3 | 4 | 5;
  children: React.ReactNode;
}) {
  const grid: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
  };
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-sm border border-(--admin-line) bg-(--admin-line)',
        grid[cols]
      )}
    >
      {children}
    </div>
  );
}

/* ─── Sparkline ───────────────────────────────────────────────────── */

/**
 * Thirty numbers in the space of a line of text.
 *
 * Pure SVG, no charting library — this draws one polyline and one
 * filled area, and pulling in a dependency to do that would cost more
 * than the entire admin bundle. `preserveAspectRatio="none"` lets it
 * stretch to whatever width the card ends up.
 */
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const w = 100;
  const h = 24;
  const step = w / (values.length - 1);
  const pts = values.map(
    (v, i) => [i * step, h - (v / max) * h] as [number, number]
  );
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn('text-primary mt-2 h-6 w-full', className)}
    >
      <polygon
        points={`0,${h} ${line} ${w},${h}`}
        fill="currentColor"
        opacity={0.12}
      />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ─── Meter ───────────────────────────────────────────────────────── */

/** A labelled proportion bar — the subscription mix, plan spread. */
export function Meter({
  label,
  value,
  total,
  color = 'bg-primary',
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-24 shrink-0 truncate text-xs">
        {label}
      </span>
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-none">
        <div className={cn('h-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="admin-num text-foreground w-6 shrink-0 text-right text-xs">
        {value}
      </span>
      <span className="admin-num text-muted-foreground w-9 shrink-0 text-right text-[11px]">
        {pct}%
      </span>
    </div>
  );
}

/* ─── Table ───────────────────────────────────────────────────────── */

/**
 * Table chrome only — each page still writes its own rows.
 *
 * `max-h` + `overflow-auto` with a sticky header rather than letting
 * the page scroll: a 40-row table whose header has scrolled off is a
 * grid of unlabelled values.
 */
export function TableShell({
  head,
  children,
  maxHeight = 'max-h-[70vh]',
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
}) {
  return (
    <div className={cn('overflow-auto', maxHeight)}>
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10 backdrop-blur">
          {head}
        </thead>
        <tbody className="divide-y divide-(--admin-line)">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        'admin-label border-b border-(--admin-line) px-3 py-2 font-normal whitespace-nowrap',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn('px-3 py-2 align-middle', className)}>{children}</td>
  );
}

export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn('hover:bg-muted/40 transition-colors', className)}>
      {children}
    </tr>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────── */

/**
 * Every list needs one. "No results" in grey 13px was the previous
 * answer on some pages and nothing at all on others, which leaves you
 * unsure whether the page is empty or broken.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <span className="bg-muted text-muted-foreground mb-3 flex size-9 items-center justify-center rounded-sm">
          {icon}
        </span>
      )}
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Misc ────────────────────────────────────────────────────────── */

/** A count beside a heading, e.g. "Accounts 5". */
export function Count({ n }: { n: number }) {
  return (
    <span className="admin-num bg-muted text-muted-foreground rounded-sm px-1.5 py-0.5 text-xs">
      {n}
    </span>
  );
}

/** Muted mono for ids, slugs and keys — the things you copy. */
export function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground font-mono text-xs">{children}</span>
  );
}

/**
 * How old the data on screen is.
 *
 * Reads are cached for a minute, which is invisible until you change
 * something elsewhere and wonder why the number did not move. Saying
 * so costs one line and removes the whole question.
 */
export function CacheNote({ cached = true }: { cached?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          cached ? 'bg-muted-foreground/50' : 'bg-emerald-500'
        )}
      />
      {cached ? 'cached ≤60s' : 'live'}
    </span>
  );
}
