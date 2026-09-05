'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Radio } from 'lucide-react';

import type { FailureReport } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';
import {
  SectionDurationFilter,
  type SectionDuration,
} from './section-duration-filter';

// ============================================================
// Delivery problems.
//
// Grouped by CAUSE rather than listed message by message. A bad
// template fails a thousand times and is one problem; a list of a
// thousand rows hides that, and hides the other two problems
// underneath it. Each group carries what to do about it, because the
// point of this panel is that someone fixes something.
// ============================================================

/** Above this, the rate is called out rather than just shown. */
const CONCERNING_RATE = 5;

export function FailurePanel({
  report,
  loading,
  duration,
  onDurationChange,
}: {
  report: FailureReport | null;
  loading: boolean;
  duration: SectionDuration;
  onDurationChange: (value: SectionDuration) => void;
}) {
  return (
    <section className="border-border bg-card rounded-xl border">
      <header className="border-border flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-foreground text-sm font-semibold">
          Delivery problems
        </h2>
        <div className="flex items-center gap-2">
          {report && report.total > 0 && (
            <Link
              href="/broadcasts"
              className="text-primary hover:text-primary/80 text-xs font-medium"
            >
              View broadcasts →
            </Link>
          )}
          <SectionDurationFilter
            value={duration}
            onChange={onDurationChange}
            label="Delivery problems"
          />
        </div>
      </header>

      {loading || !report ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : report.total === 0 ? (
        // Not the generic empty state: "nothing failed" is good news and
        // should read as such, rather than as missing data.
        <EmptyState
          icon={CheckCircle2}
          title="Everything delivered"
          hint={
            report.failureRate === null
              ? 'No messages were sent in this period.'
              : 'No failed messages in this period.'
          }
        />
      ) : (
        <>
          <div className="border-border flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b px-5 py-3">
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {report.total.toLocaleString()}
              <span className="text-muted-foreground ml-1.5 text-xs font-medium">
                failed
              </span>
            </p>
            {report.failureRate !== null && (
              <p
                className={cn(
                  'text-xs font-medium',
                  report.failureRate >= CONCERNING_RATE
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
                )}
              >
                {report.failureRate.toFixed(1)}% of attempted sends
              </p>
            )}
          </div>

          <ul className="divide-border divide-y">
            {report.groups.map((g) => (
              <li key={`${g.code ?? g.title}`} className="px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                    <AlertTriangle className="size-3.5 text-red-600 dark:text-red-400" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-foreground text-sm font-medium">
                        {g.title}
                      </span>
                      {g.code !== null && (
                        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                          {g.code}
                        </span>
                      )}
                      <span className="text-muted-foreground ml-auto text-sm font-semibold tabular-nums">
                        {g.count.toLocaleString()}
                      </span>
                    </div>

                    {/* Which broadcasts, by name. "9 from a broadcast" is
                        not actionable; "9 in Diwali offer" is. */}
                    {g.broadcasts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {g.broadcasts.map((b) => (
                          <Link
                            key={b.id}
                            href={`/broadcasts/${b.id}`}
                            className="border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-foreground/20 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors"
                          >
                            <Radio className="size-2.5" />
                            {b.name}
                            <span className="tabular-nums opacity-70">
                              {b.count}
                            </span>
                          </Link>
                        ))}
                        {g.count > g.broadcastCount && (
                          <span className="text-muted-foreground px-1 py-0.5 text-[11px]">
                            + {(g.count - g.broadcastCount).toLocaleString()}{' '}
                            direct
                          </span>
                        )}
                      </div>
                    )}

                    {g.action && (
                      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                        → {g.action}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
