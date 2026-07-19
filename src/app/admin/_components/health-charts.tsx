'use client';

// ============================================================
// Chart primitives for the System Health console — Chart.js edition.
//
//   • Sparkline  — line+area trend with index-mode tooltip + crosshair
//   • RadialMeter — 270° doughnut gauge, severity fill on a muted track,
//                   hero value overlaid in the centre (HTML, ink tokens)
//   • HBarChart  — horizontal bars, one hue, rounded data-ends, value
//                   direct-labelled at the bar tip via an inline plugin
//
// Chart.js paints to canvas, so the app's CSS tokens can't apply
// directly: colors are resolved from the CSS custom properties at build
// time (oklch → rgb via a probe element) and the charts rebuild when the
// theme flips (MutationObserver on <html> + prefers-color-scheme).
//
// Colour rules (dataviz method): one sequential hue — the brand
// --primary — for magnitude marks; status hues (amber/red) only as meter
// severity, always beside the numeric value; text stays in ink tokens.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js';

import { cn } from '@/lib/utils';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
);
Chart.defaults.font.family =
  'system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.font.size = 11;

/* ── theme-token resolution (CSS oklch → canvas-safe rgb) ───── */

/** Resolve any CSS color (oklch, var-value, …) to its computed rgb(). */
function resolveColor(cssValue: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = cssValue || fallback;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return rgb || fallback;
}

function withAlpha(rgb: string, alpha: number): string {
  const m = rgb.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgb;
  const [r, g, b] = m[1].split(',').map((s) => s.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ThemeColors {
  primary: string;
  muted: string;
  mutedFg: string;
  border: string;
  card: string;
  popover: string;
  popoverFg: string;
}

function readTheme(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fb: string) =>
    resolveColor(styles.getPropertyValue(name).trim(), fb);
  return {
    primary: token('--primary', 'rgb(22, 101, 52)'),
    muted: token('--muted', 'rgb(238, 240, 238)'),
    mutedFg: token('--muted-foreground', 'rgb(115, 120, 115)'),
    border: token('--border', 'rgb(226, 229, 226)'),
    card: token('--card', 'rgb(255, 255, 255)'),
    popover: token('--popover', 'rgb(255, 255, 255)'),
    popoverFg: token('--popover-foreground', 'rgb(20, 22, 20)'),
  };
}

/** Bumps whenever the theme may have changed, so charts re-resolve tokens. */
function useThemeVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', bump);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', bump);
    };
  }, []);
  return v;
}

function tooltipDefaults(t: ThemeColors) {
  return {
    backgroundColor: t.popover,
    titleColor: t.mutedFg,
    bodyColor: t.popoverFg,
    borderColor: t.border,
    borderWidth: 1,
    displayColors: false,
    padding: 8,
    cornerRadius: 6,
    caretSize: 4,
  } as const;
}

/* ── generic canvas host ────────────────────────────────────── */

type AnyChartConfig =
  | ChartConfiguration<'line'>
  | ChartConfiguration<'bar'>
  | ChartConfiguration<'doughnut'>;

/**
 * Owns one Chart.js instance. `build` runs client-side only (inside the
 * effect), so it may read the DOM for theme tokens. The chart is created
 * once, then mutated + `update('none')` when `signature` changes, and
 * destroyed on unmount.
 */
function ChartCanvas({
  build,
  signature,
  height,
  className,
  overlay,
}: {
  build: () => AnyChartConfig;
  signature: string;
  height: number;
  className?: string;
  overlay?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const buildRef = useRef(build);

  // Keep the latest builder without re-running the chart effect. Effects
  // run in declaration order, so this always lands before the one below.
  useEffect(() => {
    buildRef.current = build;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = buildRef.current() as ChartConfiguration;
    const chart = chartRef.current;
    if (!chart) {
      chartRef.current = new Chart(canvas, cfg);
    } else {
      chart.data = cfg.data;
      chart.options = cfg.options ?? {};
      chart.update('none');
    }
    // `signature` encodes data + theme; build stays fresh via buildRef.
  }, [signature]);

  useEffect(
    () => () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    },
    [],
  );

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <canvas ref={canvasRef} />
      {overlay}
    </div>
  );
}

/* ── Sparkline ──────────────────────────────────────────────── */

/** Vertical hairline through the hovered point (Chart.js has none built in). */
const sparkCrosshair: Plugin<'line'> = {
  id: 'sparkCrosshair',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (!active?.length) return;
    const ds = chart.data.datasets[0] as { crosshairColor?: string };
    const { x } = active[0].element;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = ds.crosshairColor ?? 'rgba(128,128,128,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

export function Sparkline({
  data,
  labels,
  height = 48,
  formatValue = (n: number) => String(Math.round(n)),
  className,
}: {
  data: number[];
  /** Tooltip titles (e.g. sample times), same length as data. */
  labels?: string[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}) {
  const themeV = useThemeVersion();
  const n = data.length;

  const build = (): ChartConfiguration<'line'> => {
    const t = readTheme();
    return {
      type: 'line',
      data: {
        labels: labels && labels.length === n ? labels : data.map((_, i) => String(i + 1)),
        datasets: [
          {
            data,
            borderColor: t.primary,
            backgroundColor: withAlpha(t.primary, 0.16),
            crosshairColor: t.border,
            fill: true,
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 0,
            pointHitRadius: 12,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: t.primary,
            pointHoverBorderColor: t.card,
            pointHoverBorderWidth: 2,
          } as never,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 4, bottom: 2 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { display: false },
          y: { display: false, grace: '15%' },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipDefaults(t),
            callbacks: {
              label: (item) => formatValue(item.parsed.y ?? 0),
            },
          },
        },
      },
      plugins: [sparkCrosshair],
    };
  };

  return (
    <ChartCanvas
      build={build}
      signature={`spark|${themeV}|${data.join(',')}|${labels?.join(',') ?? ''}`}
      height={height}
      className={className}
      overlay={
        n < 2 ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
            collecting…
          </span>
        ) : undefined
      }
    />
  );
}

/* ── RadialMeter ────────────────────────────────────────────── */

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

export function RadialMeter({
  fraction,
  tone = 'good',
  valueText,
  caption,
  size = 132,
}: {
  /** 0..1; clamped. null = no data (track only). */
  fraction: number | null;
  tone?: Tone;
  valueText: string;
  caption?: string;
  size?: number;
}) {
  const themeV = useThemeVersion();
  const f = fraction == null ? 0 : Math.min(1, Math.max(0, fraction));

  const build = (): ChartConfiguration<'doughnut'> => {
    const t = readTheme();
    const toneColor: Record<Tone, string> = {
      good: t.primary,
      warning: '#f59e0b',
      critical: '#ef4444',
      neutral: withAlpha(t.mutedFg, 0.4),
    };
    return {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data: fraction == null ? [1] : [f, 1 - f],
            backgroundColor:
              fraction == null ? [t.muted] : [toneColor[tone], t.muted],
            borderWidth: 0,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '78%',
        rotation: -135,
        circumference: 270,
        events: [],
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    };
  };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ChartCanvas
        build={build}
        signature={`meter|${themeV}|${fraction ?? 'null'}|${tone}`}
        height={size}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
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
  /** Right-of-bar label; defaults to formatValue(value). */
  valueText?: string;
  /** Extra tooltip context. */
  caption?: string;
}

/** Draws each bar's value text just past its data-end, in muted ink. */
const barValueLabels: Plugin<'bar'> = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const ds = chart.data.datasets[0] as {
      valueTexts?: string[];
      labelColor?: string;
    };
    if (!ds.valueTexts) return;
    const meta = chart.getDatasetMeta(0);
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = ds.labelColor ?? 'rgb(128,128,128)';
    ctx.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    meta.data.forEach((bar, i) => {
      const text = ds.valueTexts?.[i];
      if (text) ctx.fillText(text, bar.x + 6, bar.y);
    });
    ctx.restore();
  },
};

const HBAR_ROW = 26;

export function HBarChart({
  items,
  formatValue = (n: number) => String(n),
}: {
  items: HBarItem[];
  formatValue?: (n: number) => string;
}) {
  const themeV = useThemeVersion();

  const build = (): ChartConfiguration<'bar'> => {
    const t = readTheme();
    const max = Math.max(1, ...items.map((i) => i.value));
    return {
      type: 'bar',
      data: {
        labels: items.map((i) => i.label),
        datasets: [
          {
            data: items.map((i) => i.value),
            valueTexts: items.map((i) => i.valueText ?? formatValue(i.value)),
            labelColor: t.mutedFg,
            backgroundColor: t.primary,
            hoverBackgroundColor: t.primary,
            borderRadius: 5,
            barThickness: 12,
          } as never,
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // Right padding is where the value labels are drawn.
        layout: { padding: { right: 68 } },
        scales: {
          x: { display: false, suggestedMax: max },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: t.mutedFg, autoSkip: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipDefaults(t),
            callbacks: {
              label: (item) => {
                const it = items[item.dataIndex];
                return (
                  it?.caption ?? it?.valueText ?? formatValue(item.parsed.x ?? 0)
                );
              },
            },
          },
        },
      },
      plugins: [barValueLabels],
    };
  };

  return (
    <ChartCanvas
      build={build}
      signature={`hbar|${themeV}|${items
        .map((i) => `${i.label}:${i.value}`)
        .join(',')}`}
      height={items.length * HBAR_ROW + 12}
    />
  );
}
