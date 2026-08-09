import Link from 'next/link';

import { cn } from '@/lib/utils';

// ============================================================
// Admin panel primitives.
//
// Every page had been hand-rolling its own header, card and table
// markup, so spacing, border radii, text sizes and empty states all
// drifted apart — sixteen pages, sixteen slightly different tables.
// These are the shared pieces; a page should not be writing
// `rounded-xl border border-border bg-card p-4` by hand any more.
//
// Density is the theme. A back office is read, scanned and acted on,
// not admired: rows are tighter than the marketing site's, headers are
// sticky so a scrolled table still says what its columns are, and
// numbers are tabular so they line up when compared down a column.
// ============================================================

/* ─── Page header ─────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  /** Actions, right-aligned. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
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
        'border-border bg-card overflow-hidden rounded-xl border',
        className
      )}
    >
      {(title || actions) && (
        <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-foreground text-sm font-semibold">{title}</h2>
            )}
            {description && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName ?? 'p-4'}>{children}</div>
    </section>
  );
}

/* ─── Stat ────────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
  href?: string;
  tone?: 'default' | 'primary' | 'info' | 'warn' | 'danger' | 'success';
}) {
  const tones: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  const body = (
    <div
      className={cn(
        'border-border bg-card rounded-xl border p-4 transition-colors',
        href && 'hover:bg-muted/50 hover:border-foreground/15'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {icon && (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg',
              tones[tone]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {/* Tabular so a column of these lines up digit for digit. */}
      <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
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
        <tbody className="divide-border divide-y">{children}</tbody>
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
        'px-4 py-2.5 text-xs font-medium whitespace-nowrap',
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
    <td className={cn('px-4 py-2.5 align-middle', className)}>{children}</td>
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
        <span className="bg-muted text-muted-foreground mb-3 flex size-10 items-center justify-center rounded-xl">
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
    <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums">
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
