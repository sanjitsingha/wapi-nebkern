// Centralised date helpers for the dashboard so every chart / card
// agrees on what "today", "day boundary", and "day of week" mean.
// All boundaries are computed in the user's LOCAL timezone — which is
// what a business user intuitively expects when they say "today".

export function startOfLocalDay(d: Date = new Date()): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function daysAgoStart(days: number): Date {
  const out = startOfLocalDay()
  out.setDate(out.getDate() - days)
  return out
}

/** Date-only key (YYYY-MM-DD) for bucketing rows by local calendar day. */
export function localDayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Inclusive list of local-day keys spanning the last `n` days, in
 * chronological order. Useful for seeding chart buckets so days with
 * zero activity still render a 0-point in the line.
 */
export function lastNDayKeys(n: number): string[] {
  const keys: string[] = []
  const start = daysAgoStart(n - 1)
  for (let i = 0; i < n; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    keys.push(localDayKey(d))
  }
  return keys
}

/** Return a new date `n` local days after `d` (n may be negative). */
export function addLocalDays(d: Date, n: number): Date {
  const out = startOfLocalDay(d)
  out.setDate(out.getDate() + n)
  return out
}

/**
 * Inclusive count of local calendar days spanned by [from, to].
 * `round` absorbs the ±1h wobble a DST boundary would otherwise add.
 */
export function daysInRangeInclusive(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime()
  const b = startOfLocalDay(to).getTime()
  return Math.round((b - a) / 86_400_000) + 1
}

/**
 * Inclusive list of local-day keys (YYYY-MM-DD) spanning [from, to] in
 * chronological order. The arbitrary-range analogue of lastNDayKeys —
 * used to seed chart buckets so zero-activity days still render a point.
 */
export function dayKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = []
  const start = startOfLocalDay(from)
  const count = daysInRangeInclusive(from, to)
  for (let i = 0; i < count; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    keys.push(localDayKey(d))
  }
  return keys
}

/**
 * ISO day-of-week where 0 = Monday … 6 = Sunday. JavaScript's native
 * getDay() uses 0 = Sunday which is awkward for most business charts.
 */
export function mondayIndex(d: Date): number {
  const jsDow = d.getDay() // 0..6 with Sunday=0
  return (jsDow + 6) % 7
}

export const DOW_SHORT_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
