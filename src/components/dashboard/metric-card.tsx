import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "₹1,250"). */
  value: string
  /** A small glyph in front of the label, in the label's own grey. */
  icon?: ComponentType<{ className?: string }>
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
   * Flip the delta's colouring, for a metric where UP is bad.
   *
   * The default reads a rise as green and a fall as red, which is right
   * for conversations and messages sent and exactly wrong for failures
   * — "+18 failed vs previous 30 days" in green congratulates you on a
   * broken template.
   */
  invertDelta?: boolean
}

// Plain figures — no coloured chip, no frame of its own. The dashboard
// sets the row inside one white panel; the label carries a small grey
// glyph and nothing more.
export function MetricCard({
  title,
  value,
  icon: Icon,
  delta,
  subtitle,
  invertDelta = false,
}: MetricCardProps) {
  return (
    <div className="px-5 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {Icon && <Icon className="size-4 shrink-0" />}
        {title}
      </p>
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
