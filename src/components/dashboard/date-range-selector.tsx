"use client"

import { useEffect, useState } from 'react'
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DashboardDateRange } from '@/lib/dashboard/types'

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const today = () => startOfDay(new Date())

interface Preset {
  label: string
  range: () => { from: Date; to: Date }
}

// Every preset yields a full range — the dashboard is always scoped to a
// concrete window (there is no "unset" state like the contacts filter).
const PRESETS: Preset[] = [
  { label: 'Today', range: () => ({ from: today(), to: today() }) },
  { label: 'Last 7 days', range: () => ({ from: subDays(today(), 6), to: today() }) },
  { label: 'Last 30 days', range: () => ({ from: subDays(today(), 29), to: today() }) },
  { label: 'Last 90 days', range: () => ({ from: subDays(today(), 89), to: today() }) },
  { label: 'This month', range: () => ({ from: startOfMonth(today()), to: today() }) },
  { label: 'Last 6 months', range: () => ({ from: subMonths(today(), 6), to: today() }) },
]

interface DateRangeSelectorProps {
  value: DashboardDateRange
  onChange: (range: DashboardDateRange) => void
  /** Disable the trigger while a fetch for the selected range is in flight. */
  disabled?: boolean
}

/**
 * Global time-window control for the dashboard. Renders a trigger button
 * (top-right of the page header) that opens a modal with a preset rail
 * beside a range calendar — the same pattern as the contacts "Created at"
 * filter. Applying a range drives every range-scoped widget (metric
 * cards + conversations chart).
 */
export function DateRangeSelector({
  value,
  onChange,
  disabled = false,
}: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="border-border text-foreground hover:bg-muted h-10 shrink-0"
      >
        <CalendarDays className="size-4 text-muted-foreground" />
        {triggerLabel(value)}
      </Button>

      <DateRangeDialog
        open={open}
        onOpenChange={setOpen}
        value={value}
        onApply={(range) => {
          onChange(range)
          setOpen(false)
        }}
      />
    </>
  )
}

/** Friendly button text: the matching preset name, else the formatted span. */
function triggerLabel(value: DashboardDateRange): string {
  const preset = PRESETS.find((p) => {
    const r = p.range()
    return isSameDay(r.from, value.from) && isSameDay(r.to, value.to)
  })
  if (preset) return preset.label
  return isSameDay(value.from, value.to)
    ? format(value.from, 'MMM d, yyyy')
    : `${format(value.from, 'MMM d')} – ${format(value.to, 'MMM d, yyyy')}`
}

interface DateRangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: DashboardDateRange
  onApply: (range: DashboardDateRange) => void
}

/**
 * Preset rail + single-month range calendar. Click a day to start a
 * range, a second to complete it, a third to start over. Local state is
 * re-seeded from `value` every time the dialog opens so cancelling can't
 * leak an in-progress selection.
 */
function DateRangeDialog({
  open,
  onOpenChange,
  value,
  onApply,
}: DateRangeDialogProps) {
  const [from, setFrom] = useState<Date | null>(value.from)
  const [to, setTo] = useState<Date | null>(value.to)
  const [hoverDay, setHoverDay] = useState<Date | null>(null)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value.to))

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(value.from)
    setTo(value.to)
    setHoverDay(null)
    setViewMonth(startOfMonth(value.to))
  }, [open, value.from, value.to])

  function handleDayClick(day: Date) {
    if (isAfter(day, today())) return // no future data to show
    if (!from || (from && to)) {
      setFrom(day)
      setTo(null)
    } else if (isBefore(day, from)) {
      setTo(from)
      setFrom(day)
    } else {
      setTo(day)
    }
  }

  function applyPreset(preset: Preset) {
    const range = preset.range()
    setFrom(range.from)
    setTo(range.to)
    setViewMonth(startOfMonth(range.to))
  }

  function isPresetActive(preset: Preset): boolean {
    const range = preset.range()
    return (
      !!from && !!to && isSameDay(from, range.from) && isSameDay(to, range.to)
    )
  }

  function handleApply() {
    if (!from) return
    // A lone start date is a valid single-day range — no second click
    // required. A completed range uses both ends.
    onApply({ from, to: to ?? from })
  }

  const monthStart = startOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(endOfMonth(viewMonth))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // While picking the end date, preview the range under the cursor so the
  // calendar responds live before the second click lands.
  const previewing =
    !!from &&
    !to &&
    !!hoverDay &&
    !isSameDay(hoverDay, from) &&
    !isAfter(hoverDay, today())
  const previewEnd = previewing ? hoverDay : to
  // Normalise so the highlighted band always runs start → end regardless
  // of which side of `from` the cursor is on.
  let bandStart = from
  let bandEnd = previewEnd
  if (bandStart && bandEnd && isBefore(bandEnd, bandStart)) {
    ;[bandStart, bandEnd] = [bandEnd, bandStart]
  }

  const dayCount =
    from && (to ?? previewEnd)
      ? differenceInCalendarDays(
          (bandEnd ?? bandStart) as Date,
          bandStart as Date,
        ) + 1
      : from
        ? 1
        : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-border border-b px-5 py-4">
          <DialogTitle className="text-popover-foreground text-base">
            Select date range
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Scope the dashboard metrics and conversations chart to a period.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="border-border bg-muted/30 shrink-0 border-b p-3 sm:w-44 sm:border-r sm:border-b-0">
            <p className="text-muted-foreground mb-2 hidden px-2 text-[11px] font-semibold tracking-wide uppercase sm:block">
              Quick ranges
            </p>
            <div className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
              {PRESETS.map((preset) => {
                const active = isPresetActive(preset)
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {preset.label}
                    {active && <Check className="size-3.5 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Calendar */}
          <div className="min-w-0 flex-1 p-5">
            {/* Selected-range summary */}
            <div className="mb-4 flex items-center gap-2">
              <SummaryChip
                label="Start"
                date={bandStart}
                active={!from || (!!from && !!to)}
              />
              <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              <SummaryChip
                label="End"
                date={to ?? (previewing ? bandEnd : null)}
                active={!!from && !to}
              />
            </div>

            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                aria-label="Previous month"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-foreground text-sm font-semibold">
                {format(viewMonth, 'MMMM yyyy')}
              </p>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div
              className="grid grid-cols-7 gap-y-1"
              onMouseLeave={() => setHoverDay(null)}
            >
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-muted-foreground flex h-8 items-center justify-center text-xs font-medium"
                >
                  {label}
                </div>
              ))}
              {days.map((day) => {
                const outsideMonth = !isSameMonth(day, viewMonth)
                const isStart = !!bandStart && isSameDay(day, bandStart)
                const isEnd = !!bandEnd && isSameDay(day, bandEnd)
                const inBand =
                  !!bandStart &&
                  !!bandEnd &&
                  isWithinInterval(day, { start: bandStart, end: bandEnd })
                const isEndpoint = isStart || isEnd
                const isFuture = isAfter(day, today())
                const isToday = isSameDay(day, today())

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      // Continuous band behind the days between endpoints.
                      !outsideMonth && inBand && !isEndpoint && 'bg-primary-soft',
                      !outsideMonth && inBand && isStart && !isEnd && 'bg-primary-soft rounded-l-full',
                      !outsideMonth && inBand && isEnd && !isStart && 'bg-primary-soft rounded-r-full',
                    )}
                    onMouseEnter={() => setHoverDay(day)}
                  >
                    <button
                      type="button"
                      disabled={outsideMonth || isFuture}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors',
                        outsideMonth && 'invisible',
                        isFuture && !outsideMonth && 'text-muted-foreground/30 cursor-not-allowed',
                        !isFuture &&
                          !outsideMonth &&
                          !isEndpoint &&
                          'text-foreground hover:bg-muted',
                        isEndpoint &&
                          !outsideMonth &&
                          'bg-primary text-primary-foreground hover:bg-primary font-semibold shadow-sm',
                        isToday &&
                          !isEndpoint &&
                          !outsideMonth &&
                          'ring-primary/50 ring-1 ring-inset',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="border-border bg-muted/30 mx-0 mb-0 items-center border-t px-5 py-3 sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {dayCount > 0 ? (
              <>
                <span className="text-foreground font-semibold tabular-nums">
                  {dayCount}
                </span>{' '}
                {dayCount === 1 ? 'day' : 'days'} selected
              </>
            ) : (
              'Pick a start date'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!from}>
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A Start / End date pill in the calendar summary row. */
function SummaryChip({
  label,
  date,
  active,
}: {
  label: string
  date: Date | null
  active: boolean
}) {
  return (
    <div
      className={cn(
        'flex-1 rounded-lg border px-3 py-2 transition-colors',
        active ? 'border-primary bg-primary-soft' : 'border-border bg-muted/40',
      )}
    >
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-medium tabular-nums',
          date ? 'text-foreground' : 'text-muted-foreground/60',
        )}
      >
        {date ? format(date, 'MMM d, yyyy') : 'Select'}
      </p>
    </div>
  )
}
