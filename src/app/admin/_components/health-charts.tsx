'use client';

// ============================================================
// Chart primitives for the System Health console.
//
// Hand-rolled inline SVG (no chart-lib dependency) so they're tiny,
// theme-aware via the app's CSS tokens, and tuned for a monitoring look:
//   • Sparkline  — single-series area+line trend, live hover crosshair
//   • RadialMeter — a ratio-against-limit "meter" drawn as a 270° arc,
//                   severity-toned track fill + hero value in the centre
//   • HBarChart  — magnitude comparison across categories, one hue,
//                   4px rounded data-ends, value direct-labelled at the tip
//
// Colour follows the dataviz method: one sequential hue (the brand
// --primary) for magnitude marks; reserved status hues (amber/red) only
// for meter severity, always paired with the numeric value (never colour
// alone). Text stays in ink tokens, never the mark colour.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* Measure a container's width so SVGs render at true pixels (no
 * aspect-ratio distortion of dots/strokes). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ── Sparkline ──────────────────────────────────────────────── */

export function Sparkline({
  data,
  height = 48,
  formatValue = (n: number) => String(Math.round(n)),
  className,
}: {
  data: number[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = w || 260;
  const pad = 4;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = height - pad * 2;
  const n = data.length;

  const min = n ? Math.min(...data) : 0;
  const max = n ? Math.max(...data) : 1;
  const span = max - min || Math.max(1, Math.abs(max));

  const xAt = (i: number) =>
    n <= 1 ? width / 2 : pad + (i / (n - 1)) * innerW;
  const yAt = (v: number) => pad + (1 - (v - min) / span) * innerH;

  const linePath = n
    ? data.map((v, i) => `${i ? 'L' : 'M'} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`).join(' ')
    : '';
  const areaPath = n
    ? `${linePath} L ${xAt(n - 1).toFixed(2)} ${height - pad} L ${xAt(0).toFixed(2)} ${height - pad} Z`
    : '';

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (n < 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const i = Math.round(((mx - pad) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const lastVal = n ? data[n - 1] : null;

  return (
    <div
      ref={ref}
      className={cn('relative w-full', className)}
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        width={width}
        height={height}
        className="block text-primary"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          className="stroke-border"
          strokeWidth={1}
        />

        {n >= 2 && (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* hover crosshair */}
        {hover !== null && n >= 1 && (
          <>
            <line
              x1={xAt(hover)}
              y1={pad}
              x2={xAt(hover)}
              y2={height - pad}
              className="stroke-border"
              strokeWidth={1}
            />
            <circle
              cx={xAt(hover)}
              cy={yAt(data[hover])}
              r={3.5}
              fill="currentColor"
              className="stroke-card"
              strokeWidth={2}
            />
          </>
        )}

        {/* current-value end dot */}
        {n >= 1 && hover === null && (
          <circle
            cx={xAt(n - 1)}
            cy={yAt(lastVal as number)}
            r={3}
            fill="currentColor"
            className="stroke-card"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* tooltip */}
      {hover !== null && n >= 1 && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-popover-foreground shadow-sm"
          style={{
            left: Math.min(width - 24, Math.max(24, xAt(hover))),
          }}
        >
          {formatValue(data[hover])}
        </div>
      )}

      {n < 2 && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
          collecting…
        </span>
      )}
    </div>
  );
}

/* ── RadialMeter ────────────────────────────────────────────── */

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

const ARC_TONE: Record<Tone, string> = {
  good: 'stroke-primary',
  warning: 'stroke-amber-500',
  critical: 'stroke-red-500',
  neutral: 'stroke-muted-foreground/40',
};

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Clockwise arc from startAngle→endAngle (0° = 12 o'clock). */
function arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = polar(cx, cy, r, startAngle);
  const e = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const SWEEP = 270;
const START = -135;

export function RadialMeter({
  fraction,
  tone = 'good',
  valueText,
  caption,
  size = 132,
}: {
  /** 0..1; clamped. */
  fraction: number | null;
  tone?: Tone;
  valueText: string;
  caption?: string;
  size?: number;
}) {
  const f = fraction == null ? 0 : Math.min(1, Math.max(0, fraction));
  const cx = 50;
  const cy = 50;
  const r = 40;
  const valueEnd = START + f * SWEEP;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        {/* track */}
        <path
          d={arc(cx, cy, r, START, START + SWEEP)}
          fill="none"
          className="stroke-muted"
          strokeWidth={9}
          strokeLinecap="round"
        />
        {/* value */}
        {fraction != null && f > 0 && (
          <path
            d={arc(cx, cy, r, START, valueEnd)}
            fill="none"
            className={ARC_TONE[tone]}
            strokeWidth={9}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">{valueText}</span>
        {caption && (
          <span className="mt-0.5 text-[11px] text-muted-foreground">{caption}</span>
        )}
      </div>
    </div>
  );
}

/* ── HBarChart ──────────────────────────────────────────────── */

export interface HBarItem {
  label: string;
  value: number;
  /** Optional right-side label; defaults to formatValue(value). */
  valueText?: string;
  /** Extra hover context. */
  caption?: string;
}

export function HBarChart({
  items,
  formatValue = (n: number) => String(n),
  max,
}: {
  items: HBarItem[];
  formatValue?: (n: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1">
      {items.map((it) => {
        const pct = Math.min(100, (it.value / top) * 100);
        return (
          <div
            key={it.label}
            title={it.caption}
            className="group flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/50"
          >
            <span className="w-36 shrink-0 truncate text-xs font-medium text-foreground">
              {it.label}
            </span>
            <div className="relative h-2.5 flex-1">
              <div className="absolute inset-0 rounded-full bg-muted" />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
              {it.valueText ?? formatValue(it.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
