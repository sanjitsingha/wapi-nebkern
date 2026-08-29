import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string
  icon: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
  /**
   * Accent for the icon chip. Every card used to be `primary`, which made
   * a row of four read as one block of green. A distinct hue per metric
   * gives each card its own identity and makes them scannable at a glance.
   *
   * Deliberately confined to the 9x9 chip: the numbers, labels and borders
   * stay neutral, so this adds variety without turning the row into a
   * fruit salad. Defaults to `green` so existing callers are unchanged.
   */
  tone?: MetricTone
  /**
   * Flip the delta's colouring, for a metric where UP is bad.
   *
   * The default reads a rise as green and a fall as red, which is right
   * for conversations and messages sent and exactly wrong for failures
   * — "+18 failed vs previous 30 days" in green congratulates you on a
   * broken template.
   */
  invertDelta?: boolean
}

type MetricTone = 'green' | 'blue' | 'amber' | 'violet' | 'red'

/**
 * Soft tinted background + saturated glyph, one pair per tone. The
 * `/12` alpha matches the old `--primary-soft` token so the chips keep
 * exactly the weight they had; only the hue changes. Dark-mode variants
 * lift the glyph a step because the saturated 600s go muddy on a dark
 * surface.
 */
const TONE_CLASSES: Record<MetricTone, string> = {
  green: 'bg-primary-soft text-primary',
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/14 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  red: 'bg-red-500/12 text-red-600 dark:text-red-400',
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  delta,
  subtitle,
  tone = 'green',
  invertDelta = false,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            TONE_CLASSES[tone],
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="mt-3 text-[28px] leading-none font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {delta ? (
        <DeltaRow sign={delta.sign} label={delta.label} invert={invertDelta} />
      ) : subtitle ? (
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}

function DeltaRow({
  sign,
  label,
  invert = false,
}: {
  sign: number
  label: string
  invert?: boolean
}) {
  // The ARROW still follows the number — a rise points up whatever it
  // means. Only the COLOUR flips, because that is the part carrying the
  // judgement.
  const good = invert ? sign < 0 : sign > 0
  const bad = invert ? sign > 0 : sign < 0
  const tone =
    sign === 0
      ? 'text-muted-foreground'
      : good
      ? 'text-primary'
      : bad
      ? 'text-red-600 dark:text-red-400'
      : 'text-muted-foreground'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2 flex items-center gap-1 text-sm', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
