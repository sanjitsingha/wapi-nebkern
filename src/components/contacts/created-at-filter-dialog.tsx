'use client';

import { useEffect, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Preset {
  label: string;
  range: () => { from: Date; to: Date } | null;
}

const today = () => startOfDay(new Date());

const PRESETS: Preset[] = [
  { label: 'Today', range: () => ({ from: today(), to: today() }) },
  {
    label: 'Last 7 days',
    range: () => ({ from: subDays(today(), 6), to: today() }),
  },
  {
    label: 'Last 30 days',
    range: () => ({ from: subDays(today(), 29), to: today() }),
  },
  { label: 'All time', range: () => null },
];

function toDateOrNull(value: string): Date | null {
  return value ? parseISO(value) : null;
}

function toStringOrEmpty(value: Date | null): string {
  return value ? format(value, 'yyyy-MM-dd') : '';
}

interface CreatedAtFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently applied range, both 'yyyy-MM-dd' or '' for unset. */
  appliedFrom: string;
  appliedTo: string;
  onApply: (from: string, to: string) => void;
}

/**
 * "Created at" filter — a preset rail (Today / Last 7 days / Last 30
 * days / All time) beside a single-month range calendar. Click a day
 * to start a range, click a second to complete it; a third click
 * starts over. Local `from`/`to`/`viewMonth` are re-seeded from the
 * applied props every time the dialog opens, so Cancel (closing
 * without Apply) can't leak an in-progress selection into the filter.
 */
export function CreatedAtFilterDialog({
  open,
  onOpenChange,
  appliedFrom,
  appliedTo,
  onApply,
}: CreatedAtFilterDialogProps) {
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    if (!open) return;
    const seededFrom = toDateOrNull(appliedFrom);
    const seededTo = toDateOrNull(appliedTo);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(seededFrom);
    setTo(seededTo);
    setViewMonth(startOfMonth(seededTo ?? seededFrom ?? new Date()));
  }, [open, appliedFrom, appliedTo]);

  function handleDayClick(day: Date) {
    if (isAfter(day, today())) return; // contacts can't be created in the future
    if (!from || (from && to)) {
      setFrom(day);
      setTo(null);
    } else if (isBefore(day, from)) {
      setTo(from);
      setFrom(day);
    } else {
      setTo(day);
    }
  }

  function applyPreset(preset: Preset) {
    const range = preset.range();
    setFrom(range?.from ?? null);
    setTo(range?.to ?? null);
    setViewMonth(startOfMonth(range?.to ?? range?.from ?? new Date()));
  }

  function isPresetActive(preset: Preset): boolean {
    const range = preset.range();
    if (!range) return !from && !to;
    return !!from && !!to && isSameDay(from, range.from) && isSameDay(to, range.to);
  }

  function handleApply() {
    onApply(toStringOrEmpty(from), toStringOrEmpty(to));
    onOpenChange(false);
  }

  function handleClear() {
    setFrom(null);
    setTo(null);
  }

  const monthStart = startOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(viewMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const rangeLabel =
    from && to
      ? isSameDay(from, to)
        ? format(from, 'MMM d, yyyy')
        : `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`
      : from
        ? `${format(from, 'MMM d, yyyy')} – select an end date`
        : 'Select a start date';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            Filter by created at
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Show contacts created within a date range.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 sm:flex-row">
          {/* Presets */}
          <div className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-40 sm:flex-col sm:overflow-visible sm:border-r sm:border-border sm:pr-4">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                  isPresetActive(preset)
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-sm font-semibold text-foreground">
                {format(viewMonth, 'MMMM yyyy')}
              </p>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
              {days.map((day) => {
                const outsideMonth = !isSameMonth(day, viewMonth);
                const isStart = !!from && isSameDay(day, from);
                const isEnd = !!to && isSameDay(day, to);
                const inRange =
                  !!from && !!to && isWithinInterval(day, { start: from, end: to });
                const isFuture = isAfter(day, today());
                const isToday = isSameDay(day, today());

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      !outsideMonth && inRange && 'bg-primary-soft',
                      !outsideMonth && isStart && 'rounded-l-full',
                      !outsideMonth && isEnd && 'rounded-r-full',
                    )}
                  >
                    <button
                      type="button"
                      disabled={outsideMonth || isFuture}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors',
                        outsideMonth && 'invisible',
                        isFuture && !outsideMonth && 'cursor-not-allowed text-muted-foreground/30',
                        !isFuture &&
                          !outsideMonth &&
                          !isStart &&
                          !isEnd &&
                          'text-foreground hover:bg-muted',
                        (isStart || isEnd) &&
                          !outsideMonth &&
                          'bg-primary font-semibold text-primary-foreground hover:bg-primary',
                        isToday &&
                          !isStart &&
                          !isEnd &&
                          !outsideMonth &&
                          'ring-1 ring-inset ring-primary/50',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">{rangeLabel}</p>
          </div>
        </div>

        <DialogFooter className="border-border bg-popover">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={!from && !to}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            Clear
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
