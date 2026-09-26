'use client';

import { Tabs } from '@base-ui/react/tabs';
import { Check } from 'lucide-react';

import type { Comparison } from '@/lib/marketing/comparisons';
import { cn } from '@/lib/utils';

// ============================================================
// "Choose Instant when / Choose <rival> when", as a tab set on the
// black band — the same shape the homepage stats use
// (components/wa/stats-tabs.tsx): rail down the left, the selected
// panel filling the right.
//
// Client-only because a tab set has state. Everything else on a
// comparison page is a server component and stays one.
//
// Built on the Base UI primitive rather than `components/ui/tabs`,
// whose trigger carries the dashboard theme's colours baked in
// (`bg-background`, `text-foreground`, a stack of `dark:` variants).
// On a pure-black band each of those would need undoing, so this takes
// the primitive — same roving focus, arrow keys and aria wiring — and
// dresses it to match.
// ============================================================

export function ComparisonVerdictTabs({ data }: { data: Comparison }) {
  const sides = [
    { value: 'instant', name: 'Instant', points: data.verdict.instant },
    { value: 'rival', name: data.rival, points: data.verdict.rival },
  ];

  // A floor rather than a fixed height: the two sides have different
  // numbers of points, so the band would otherwise jump height as you
  // switch tabs. `items-center` keeps the shorter side centred in the
  // space instead of stranding it at the top.
  return (
    <section className="flex min-h-[560px] items-center bg-black px-4 py-16 text-white sm:px-6 sm:py-20 lg:min-h-[620px]">
      <div className="mx-auto w-full max-w-5xl">
        <Tabs.Root
          defaultValue="instant"
          orientation="vertical"
          className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] lg:gap-16"
        >
          {/* Below lg the rail is a row: two tall stacked names would
              push the list most of a screen down. */}
          <Tabs.List className="flex gap-8 lg:flex-col lg:gap-0">
            {sides.map((side) => (
              <Tabs.Tab
                key={side.value}
                value={side.value}
                className={cn(
                  'group shrink-0 cursor-pointer text-left outline-none',
                  'focus-visible:outline-2 focus-visible:outline-offset-4',
                  'focus-visible:outline-white/70',
                  // The active marker is a rule on the inline-start edge
                  // on desktop, where the rail is a column. On the row
                  // that edge means nothing, so there the name's own
                  // contrast carries the state. No radius — rounding
                  // bends the ends of that rule into visible hooks.
                  'lg:w-full lg:border-l-2 lg:border-white/10 lg:py-5 lg:pl-7',
                  'lg:transition-colors',
                  'lg:data-[active]:border-[var(--wa-green,var(--lp2-grass))]',
                )}
              >
                <span
                  className={cn(
                    'lp2-display block text-2xl font-extrabold sm:text-3xl',
                    'text-white/30 transition-colors group-data-[active]:text-white',
                    'group-hover:text-white/60',
                  )}
                >
                  {side.name}
                </span>
                <span
                  className={cn(
                    'mt-1 block text-xs font-bold tracking-wide uppercase',
                    'text-white/30 transition-colors',
                    'group-data-[active]:text-white/70',
                  )}
                >
                  Choose when
                </span>
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {/* Both panels live in one grid cell and stay mounted, so the
              block is always as tall as the taller side and nothing moves
              when you switch. Base UI hides the inactive one with the
              `hidden` attribute, which is `display: none` and would
              collapse the cell — so it is put back to `block` and hidden
              with `visibility` instead, which still takes it out of the
              tab order and away from screen readers. */}
          <div className="grid min-w-0">
            {sides.map((side) => (
              <Tabs.Panel
                key={side.value}
                value={side.value}
                keepMounted
                className={cn(
                  'col-start-1 row-start-1 outline-none',
                  '[&[hidden]]:block [&[hidden]]:invisible',
                )}
              >
                <p className="text-sm font-bold tracking-wide text-white/50 uppercase">
                  Choose {side.name} when
                </p>
                <ul className="mt-6 space-y-5">
                  {side.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <Check
                        aria-hidden
                        className="mt-1 size-4 shrink-0 text-[var(--wa-green,var(--lp2-grass))]"
                        strokeWidth={3}
                      />
                      <span className="text-base leading-relaxed text-white/80">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </Tabs.Panel>
            ))}
          </div>
        </Tabs.Root>
      </div>
    </section>
  );
}
