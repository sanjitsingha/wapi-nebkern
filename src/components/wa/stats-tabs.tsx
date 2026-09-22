'use client';

import { Tabs } from '@base-ui/react/tabs';

import { Magnetic } from '@/components/ui/magnetic-button';
import { cn } from '@/lib/utils';
import { WaPill, waType } from './ui';

export interface WaStat {
  /** The number itself — this is what the tab shows, and its tab value. */
  value: string;
  /** What the number counts, under it in the tab. */
  label: string;
  /** One-line gloss, the lead of the panel. */
  note: string;
  /** Panel body. Placeholder until the real copy lands. */
  detail: string;
  /** Where the panel's Read more goes. */
  href: string;
}

/**
 * The black band's numbers as a tab set: the figures run down the left,
 * the detail for whichever is selected fills the right.
 *
 * Built on the Base UI primitive rather than `components/ui/tabs`,
 * which carries the dashboard theme's colours (`bg-background`,
 * `text-foreground`, a pile of `dark:` variants) baked into its
 * trigger. On a pure-black band every one of those would need undoing,
 * so this takes the primitive — same roving focus, arrow keys and
 * aria wiring — and dresses it in the wa design instead.
 *
 * Client-only because a tab set has state; `landing.tsx` is a server
 * component and stays one.
 */
export function WaStatsTabs({ stats }: { stats: readonly WaStat[] }) {
  const first = stats[0];
  if (!first) return null;

  return (
    <Tabs.Root
      defaultValue={first.value}
      orientation="vertical"
      className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20"
    >
      {/* Below lg the rail turns into a scrolling row: four numbers
          stacked vertically would push the panel most of a screen down.
          The negative margin lets it bleed to the section's edge so a
          scrolled tab isn't clipped mid-glyph, and the scrollbar is
          hidden because the row is short enough to read as complete. */}
      <Tabs.List
        className={cn(
          '-mx-6 flex gap-8 overflow-x-auto px-6 [scrollbar-width:none]',
          '[&::-webkit-scrollbar]:hidden',
          'lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0'
        )}
      >
        {stats.map((s) => (
          <Tabs.Tab
            key={s.value}
            value={s.value}
            className={cn(
              'group shrink-0 cursor-pointer text-left outline-none',
              'focus-visible:outline-2 focus-visible:outline-offset-4',
              'focus-visible:outline-white/70',
              // The active marker is a rule on the inline-start edge on
              // desktop, where the rail is a column; on the mobile row
              // that edge is meaningless, so there it is the number's
              // own contrast that carries the state. Deliberately no
              // radius on this element — any rounding bends the ends of
              // that rule into visible hooks.
              'lg:w-full lg:border-l-2 lg:border-white/10 lg:py-6 lg:pl-7',
              'lg:transition-colors lg:data-[active]:border-(--wa-green)'
            )}
          >
            <span
              className={cn(
                'block text-[clamp(2.5rem,5vw,3.75rem)] leading-none tracking-[-0.02em]',
                'text-white/30 transition-colors group-data-[active]:text-white',
                'group-hover:text-white/60 group-data-[active]:group-hover:text-white'
              )}
            >
              {s.value}
            </span>
            <span
              className={cn(
                waType.bodyMd,
                'mt-3 block whitespace-nowrap text-white/40 transition-colors',
                'group-data-[active]:text-white/80 lg:whitespace-normal'
              )}
            >
              {s.label}
            </span>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {/* One wrapper, so the panels share a single grid cell: an
          inactive panel is `hidden` and would otherwise stop being a
          grid item, letting the next one claim its column. */}
      <div className="min-w-0">
        {stats.map((s) => (
          <Tabs.Panel
            key={s.value}
            value={s.value}
            className="outline-none lg:pt-2"
          >
            <p className={cn(waType.displayMd, 'text-balance')}>{s.note}</p>
            <p
              className={cn(
                waType.bodyLg,
                'mt-6 max-w-[46ch] text-pretty text-white/60'
              )}
            >
              {s.detail}
            </p>

            {/* Secondary, not the green primary — the spec allows that
                one only on the page's four primary actions, and this is
                not one of them. */}
            <div className="mt-9">
              <Magnetic radius="full">
                <WaPill href={s.href} onDark>
                  Read more
                </WaPill>
              </Magnetic>
            </div>
          </Tabs.Panel>
        ))}
      </div>
    </Tabs.Root>
  );
}
