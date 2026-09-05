"use client"

import { Filter } from 'lucide-react'
import { startOfDay, subDays } from 'date-fns'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DashboardDateRange } from '@/lib/dashboard/types'

/**
 * A per-section duration override.
 *
 * `inherit` is the default and means "whatever the page's date-range
 * selector says". The rest pin this one section to a fixed window
 * regardless of the global range — the section header shows which,
 * because two range controls with no visible difference between them is
 * how people end up reading one chart and believing another.
 */
export type SectionDuration = 'inherit' | 'today' | '7d' | '30d' | '90d'

const OPTIONS: { value: SectionDuration; label: string }[] = [
  { value: 'inherit', label: 'Match dashboard range' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

/** Short form for the header chip. `inherit` renders nothing. */
export function durationLabel(value: SectionDuration): string | null {
  switch (value) {
    case 'today':
      return 'Today'
    case '7d':
      return '7d'
    case '30d':
      return '30d'
    case '90d':
      return '90d'
    default:
      return null
  }
}

/**
 * Resolve a section's duration against the page range.
 *
 * Returns `fallback` untouched for `inherit`, so a section that has not
 * been overridden keeps following the global selector — including when
 * that selector changes underneath it.
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            title={active ? `${label}: ${durationLabel(value)}` : 'Filter'}
            aria-label={`Filter ${label} by duration`}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              // An overridden section has to look different from an
              // inheriting one at a glance, or the only way to find out
              // what a chart covers is to open every menu in turn.
              active && 'text-primary hover:text-primary',
            )}
          />
        }
      >
        <Filter className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Duration</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as SectionDuration)}
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
