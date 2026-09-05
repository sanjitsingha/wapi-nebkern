"use client"

import { Check, Filter } from 'lucide-react'
import { startOfDay, subDays } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DashboardDateRange } from '@/lib/dashboard/types'

/**
 * A per-section duration override.
 *
 * `inherit` is the unfiltered state — the section follows the page's
 * date-range selector. It is deliberately NOT offered in the menu:
 * picking the option that is already active clears it instead, so
 * "remove this filter" is the same gesture as "set it", and the menu
 * stays four real choices rather than five with one of them meaning
 * "never mind".
 */
export type SectionDuration = 'inherit' | 'today' | '7d' | '30d' | '90d'

const OPTIONS: { value: Exclude<SectionDuration, 'inherit'>; label: string }[] =
  [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
  ]

/** Short form for a header chip or tooltip. `inherit` renders nothing. */
export function durationLabel(value: SectionDuration): string | null {
  return OPTIONS.find((o) => o.value === value)?.label ?? null
}

/**
 * Resolve a section's duration against the page range.
 *
 * Returns `fallback` untouched for `inherit`, so an unfiltered section
 * keeps following the global selector — including when that selector
 * changes underneath it.
 */
export function resolveDuration(
  value: SectionDuration,
  fallback: DashboardDateRange,
): DashboardDateRange {
  const to = startOfDay(new Date())
  switch (value) {
    case 'today':
      return { from: to, to }
    case '7d':
      return { from: subDays(to, 6), to }
    case '30d':
      return { from: subDays(to, 29), to }
    case '90d':
      return { from: subDays(to, 89), to }
    default:
      return fallback
  }
}

interface SectionDurationFilterProps {
  value: SectionDuration
  onChange: (value: SectionDuration) => void
  /** Names the section for screen readers, e.g. "Recent Activity". */
  label: string
}

export function SectionDurationFilter({
  value,
  onChange,
  label,
}: SectionDurationFilterProps) {
  const active = value !== 'inherit'
  const activeLabel = durationLabel(value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            title={active ? `Filtered: ${activeLabel}` : 'Filter'}
            aria-label={
              active
                ? `Filter ${label} by duration, currently ${activeLabel}`
                : `Filter ${label} by duration`
            }
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        {/* Dot rather than a tinted icon: a filtered card has to be
            obvious from across the dashboard, and a colour shift on a
            16px glyph is not. Same markup as the header's unread dot. */}
        <span className="relative flex">
          <Filter className="h-4 w-4" />
          {active && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-card" />
          )}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              // Plain items, not a radio group: a radio never fires for
              // the option already chosen, which is exactly the click
              // that has to clear the filter here.
              onClick={() => onChange(selected ? 'inherit' : option.value)}
              className="justify-between"
            >
              <span>{option.label}</span>
              {selected && <Check className="h-4 w-4 text-emerald-500" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
