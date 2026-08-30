'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast, BroadcastRecipient, RecipientStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Loader2,
  Users,
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  MessageCircle,
  Filter,
  Download,
  ChevronDown,
  Trash2,
  Pencil,
  User,
  Phone,
  CircleDot,
  TrendingUp,
  XCircle,
  CalendarClock,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  getBroadcastStatus,
  getRecipientStatus,
} from '@/lib/broadcast-status';
import { DeleteCampaignDialog } from '@/components/broadcasts/delete-campaign-dialog';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

/** A small, uppercase section label used to group the report. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, total, icon, color }: StatCardProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-muted/20">
      <div className="flex items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          {icon}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

interface OutcomeSlice {
  label: string;
  value: number;
  color: string;
  hint: string;
}

/**
 * Where every recipient ended up, as a donut.
 *
 * The slices are deliberately NOT the funnel steps. Sent / Delivered /
 * Read / Replied are nested subsets — a replied message was also read,
 * delivered and sent — so putting them in a pie double-counts them and
 * the angles mean nothing. These five buckets are mutually exclusive and
 * sum to total_recipients, which is what a share-of-whole chart needs.
 *
 * Colour: the four outcome hues are the validated SERIES palette (CVD
 * separation ≥ 10 ΔE on every adjacent pair, ≥ 3:1 on both surfaces).
 * "Pending" is deliberately the de-emphasis gray rather than a fifth
 * hue — nothing has happened to those recipients yet, and a saturated
 * colour would give the inert bucket the same visual weight as a real
 * outcome. It fails the palette checker's chroma floor by design.
 */
function OutcomeDonut({
  slices,
  total,
}: {
  slices: OutcomeSlice[];
  total: number;
}) {
  const shown = slices.filter((s) => s.value > 0);
  const share = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-foreground">Outcome breakdown</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Every recipient, counted once, by how far the message got.
      </p>

      {shown.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Nothing to chart yet — this campaign hasn&apos;t sent.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mt-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shown}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="88%"
                  // A 2px gap in the surface colour between segments, so
                  // adjacent slices read as separate marks rather than one
                  // continuous ring.
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {shown.map((s) => (
                    <Cell key={s.label} fill={s.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const s = payload[0].payload as OutcomeSlice;
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
                        <p className="text-xs font-medium text-foreground">
                          {s.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.value.toLocaleString()} ·{' '}
                          {share(s.value).toFixed(1)}% of recipients
                        </p>
                        <p className="mt-1 max-w-[200px] text-[11px] text-muted-foreground/80">
                          {s.hint}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Hero number in the hole — the denominator every slice is a
                share of, so the ring needs no axis. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {total.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">recipients</p>
            </div>
          </div>

          {/* Legend doubles as the direct labels — five or fewer slices, so
              every one gets its number rather than a colour-only key. */}
          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {shown.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate text-muted-foreground">{s.label}</span>
                <span className="ml-auto shrink-0 font-medium text-foreground tabular-nums">
                  {s.value.toLocaleString()}
                </span>
                <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
                  {share(s.value).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Series colours for the multi-series engagement chart. Validated with
 * the dataviz palette checker (CVD-safe + ≥3:1 contrast) in BOTH light and
 * dark surfaces — do not swap for the softer teal/blue/indigo used on the
 * count cards, which fail adjacent-CVD separation when overlaid in one plot.
 * `failed` is a reserved status colour, only used in the error breakdown.
 */
const SERIES = {
  delivered: '#0d9488',
  read: '#3b82f6',
  replied: '#d97706',
  failed: '#ef4444',
} as const;

/**
 * The inert bucket in the outcome donut. A neutral on purpose — "nothing
 * has happened to these yet" should not compete with a real outcome for
 * attention, so it gets the de-emphasis gray rather than a fifth hue.
 * slate-500 clears 3:1 against both the light and dark card surfaces.
 */
const PENDING_COLOR = '#64748b';

interface RateTile {
  label: string;
  pct: number;
  detail: string;
  color: string;
}

/** Headline conversion rates with a thin meter under each. */
function RateTiles({ tiles }: { tiles: RateTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t.label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
            {t.pct}%
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${t.pct}%`, backgroundColor: t.color }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t.detail}</p>
        </div>
      ))}
    </div>
  );
}

interface TimelinePoint {
  delivered: number;
  read: number;
  replied: number;
}
interface TimelineData {
  points: TimelinePoint[];
  yMax: number;
  startMs: number;
  endMs: number;
}

function parseMs(s?: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/**
 * Build cumulative delivered/read/replied series over the send window from
 * per-recipient timestamps. Returns null when there aren't at least two
 * distinct events to plot (e.g. a draft, or an instant test send) so the
 * caller can skip the chart rather than draw a degenerate line.
 */
function buildTimeline(recipients: BroadcastRecipient[]): TimelineData | null {
  const delivered: number[] = [];
  const read: number[] = [];
  const replied: number[] = [];
  const sent: number[] = [];
  for (const r of recipients) {
    const s = parseMs(r.sent_at);
    if (s != null) sent.push(s);
    const d = parseMs(r.delivered_at);
    if (d != null) delivered.push(d);
    const rd = parseMs(r.read_at);
    if (rd != null) read.push(rd);
    const rp = parseMs(r.replied_at);
    if (rp != null) replied.push(rp);
  }
  const all = [...delivered, ...read, ...replied];
  if (all.length < 2) return null;
  const startMs = Math.min(...(sent.length ? sent : all));
  const endMs = Math.max(...all);
  if (endMs <= startMs) return null;

  const buckets = 24;
  const step = (endMs - startMs) / buckets;
  const countLE = (arr: number[], t: number) =>
    arr.reduce((c, x) => (x <= t ? c + 1 : c), 0);
  const points: TimelinePoint[] = [];
  for (let i = 0; i <= buckets; i++) {
    const t = startMs + step * i;
    points.push({
      delivered: countLE(delivered, t),
      read: countLE(read, t),
      replied: countLE(replied, t),
    });
  }
  const yMax = Math.max(points[points.length - 1].delivered, 1);
  return { points, yMax, startMs, endMs };
}

function formatTick(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TIMELINE_SERIES = [
  { key: 'delivered' as const, label: 'Delivered', color: SERIES.delivered },
  { key: 'read' as const, label: 'Read', color: SERIES.read },
  { key: 'replied' as const, label: 'Replied', color: SERIES.replied },
];

/**
 * Cumulative engagement line chart (SVG). Three CVD-safe series with a
 * legend, endpoint dots, and a hover crosshair + tooltip driven by
 * invisible per-bucket hit rects (avoids viewBox↔screen coordinate math).
 */
function EngagementTimeline({ data }: { data: TimelineData }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const padL = 12;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.points.length;

  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) =>
    padT + plotH - (data.yMax > 0 ? (v / data.yMax) * plotH : 0);
  const path = (key: keyof TimelinePoint) =>
    data.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(' ');

  const hoverPoint = hover != null ? data.points[hover] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Engagement over time
        </h3>
        <div className="flex items-center gap-3">
          {TIMELINE_SERIES.map((s) => (
            <span
              key={s.key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Cumulative delivered, read, and replied counts over time"
          onMouseLeave={() => setHover(null)}
        >
          {/* Baseline + midline gridlines (recessive) */}
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={padL}
              x2={W - padR}
              y1={padT + plotH - f * plotH}
              y2={padT + plotH - f * plotH}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={f === 0 ? undefined : '3 4'}
              opacity={f === 0 ? 0.8 : 0.4}
            />
          ))}
          {/* y-axis end labels */}
          <text x={padL} y={padT - 4} className="fill-muted-foreground text-[10px]">
            {data.yMax.toLocaleString()}
          </text>

          {/* Series lines */}
          {TIMELINE_SERIES.map((s) => (
            <path
              key={s.key}
              d={path(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Hover crosshair */}
          {hover != null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padT}
              y2={padT + plotH}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              opacity={0.5}
            />
          )}

          {/* Endpoint / hover dots */}
          {TIMELINE_SERIES.map((s) => {
            const idx = hover ?? n - 1;
            return (
              <circle
                key={s.key}
                cx={x(idx)}
                cy={y(data.points[idx][s.key])}
                r={3}
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={1.5}
              />
            );
          })}

          {/* Invisible hit targets — one per bucket */}
          {data.points.map((_, i) => (
            <rect
              key={i}
              x={x(i) - (n > 1 ? plotW / (n - 1) / 2 : plotW / 2)}
              y={padT}
              width={n > 1 ? plotW / (n - 1) : plotW}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hoverPoint && hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="mb-1 font-medium text-popover-foreground">
              {formatTick(data.startMs + ((data.endMs - data.startMs) / (n - 1)) * hover)}
            </p>
            {TIMELINE_SERIES.map((s) => (
              <p
                key={s.key}
                className="flex items-center gap-1.5 text-muted-foreground tabular-nums"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                {s.label}: {hoverPoint[s.key].toLocaleString()}
              </p>
            ))}
          </div>
        )}

        {/* x-axis range labels */}
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatTick(data.startMs)}</span>
          <span>{formatTick(data.endMs)}</span>
        </div>
      </div>
    </div>
  );
}

interface ErrorGroup {
  reason: string;
  count: number;
}

/** Top failure reasons as horizontal bars (reserved status colour + labels). */
function ErrorBreakdown({ groups }: { groups: ErrorGroup[] }) {
  const max = Math.max(...groups.map((g) => g.count), 1);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
        <XCircle className="h-4 w-4 text-red-500" />
        Failure reasons
      </h3>
      <div className="space-y-2.5">
        {groups.map((g) => (
          <div key={g.reason} className="flex items-center gap-3">
            <span
              className="w-48 shrink-0 truncate text-xs text-muted-foreground"
              title={g.reason}
            >
              {g.reason}
            </span>
            <div className="relative h-6 flex-1 rounded-md bg-muted">
              <div
                className="h-6 rounded-md bg-red-500/80 transition-[width] duration-500"
                style={{ width: `${Math.max(4, Math.round((g.count / max) * 100))}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-foreground">
                {g.count.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RECIPIENT_STATUSES: readonly RecipientStatus[] = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
  'failed',
];

/** Dot colour per recipient status — the status column reads as a plain
 *  label with a small coloured marker rather than a filled pill, matching
 *  the lighter status styling used across the other tables. */
const RECIPIENT_DOT: Record<RecipientStatus, string> = {
  pending: '#64748b',
  sent: '#94a3b8',
  delivered: '#0d9488',
  read: '#3b82f6',
  replied: '#d97706',
  failed: '#ef4444',
};

/**
 * CSV export helper — RFC 4180 quoting. Quote every field so
 * commas/newlines/quotes round-trip cleanly.
 */
function toCsv(rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function BroadcastDetailPage() {
  const params = useParams();
  const router = useRouter();
  const broadcastId = params.id as string;

  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecipientStatus | 'all'>(
    'all',
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        const { data: bc, error: bcError } = await supabase
          .from('broadcasts')
          .select('*')
          .eq('id', broadcastId)
          .single();

        if (bcError) throw bcError;
        setBroadcast(bc);

        const { data: recs, error: recsError } = await supabase
          .from('broadcast_recipients')
          .select('*, contact:contacts(*)')
          .eq('broadcast_id', broadcastId)
          .order('created_at', { ascending: false });

        if (recsError) throw recsError;
        setRecipients(recs ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load broadcast');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [broadcastId]);

  const filteredRecipients = useMemo(
    () =>
      statusFilter === 'all'
        ? recipients
        : recipients.filter((r) => r.status === statusFilter),
    [recipients, statusFilter],
  );

  const timeline = useMemo(() => buildTimeline(recipients), [recipients]);

  const errorGroups = useMemo<ErrorGroup[]>(() => {
    const map = new Map<string, number>();
    for (const r of recipients) {
      if (r.status !== 'failed') continue;
      const reason = r.error_message?.trim() || 'Unknown error';
      map.set(reason, (map.get(reason) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [recipients]);

  function handleExport() {
    if (!broadcast) return;
    const header = [
      'Contact',
      'Phone',
      'Status',
      'Sent At',
      'Delivered At',
      'Read At',
      'Replied At',
      'Error',
    ];
    const rows = recipients.map((r) => [
      r.contact?.name ?? '',
      r.contact?.phone ?? '',
      r.status,
      r.sent_at ?? '',
      r.delivered_at ?? '',
      r.read_at ?? '',
      r.replied_at ?? '',
      r.error_message ?? '',
    ]);
    const csv = toCsv([header, ...rows]);
    const safeName = broadcast.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    downloadBlob(`broadcast-${safeName}-${broadcastId.slice(0, 8)}.csv`, csv);
  }

  /**
   * Pull the .xlsx from the report route and hand it to the browser.
   *
   * Fetched rather than navigated to, so an error comes back as a toast
   * instead of replacing the page with a JSON blob.
   */
  async function handleDownloadReport() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/report`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Report failed (HTTP ${res.status})`);
      }
      // Prefer the filename the server chose — it carries the campaign
      // name and the date the report was taken.
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? 'campaign-report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not build the report',
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    // broadcast_recipients cascades on broadcasts.id (migration 001), so a
    // single delete is sufficient — the aggregate trigger in migration 003
    // is defined on broadcast_recipients but fires only on its own row
    // changes, not on a cascaded drop of the parent row.
    const { error: delErr } = await supabase
      .from('broadcasts')
      .delete()
      .eq('id', broadcastId);
    setDeleting(false);
    if (delErr) {
      toast.error(`Failed to delete: ${delErr.message}`);
      return;
    }
    toast.success('Campaign deleted');
    router.push('/campaigns');
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">{error ?? 'Campaign not found'}</p>
        <Button variant="outline" onClick={() => router.push('/campaigns')}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const status = getBroadcastStatus(broadcast.status);

  // Mutually exclusive buckets that sum to EXACTLY total_recipients.
  //
  // The counters are maintained by a trigger per webhook, so they can be
  // momentarily inconsistent mid-send — a read receipt can land before
  // the delivery one, leaving read_count > delivered_count. Subtracting
  // raw counters and clamping each difference at zero is not enough: the
  // clamp hides the negative, but the residual "Pending" bucket then
  // over-counts and the slices sum past 100% (read=600/delivered=500 on
  // 1000 recipients yields 1100). So the ladder is forced monotonic
  // first — each stage capped by the one before it — and only then
  // differenced. Every bucket is non-negative and the total is exact by
  // construction, whatever the counters say.
  const clamp = (n: number, max: number) => Math.min(Math.max(0, n), max);
  const totalR = Math.max(0, broadcast.total_recipients);
  const deliveredM = clamp(broadcast.delivered_count, totalR);
  const readM = clamp(broadcast.read_count, deliveredM);
  const repliedM = clamp(broadcast.replied_count, readM);
  const failedM = clamp(broadcast.failed_count, totalR - deliveredM);

  const outcomeSlices: OutcomeSlice[] = [
    {
      label: 'Replied',
      value: repliedM,
      color: SERIES.replied,
      hint: 'Read the message and wrote back.',
    },
    {
      label: 'Read, no reply',
      value: readM - repliedM,
      color: SERIES.read,
      hint: 'Opened the message but has not responded.',
    },
    {
      label: 'Delivered, unread',
      value: deliveredM - readM,
      color: SERIES.delivered,
      hint: 'Landed on the handset, not opened yet.',
    },
    {
      label: 'Failed',
      value: failedM,
      color: SERIES.failed,
      hint: 'Meta rejected the send — see the error breakdown below.',
    },
    {
      label: 'Pending',
      value: totalR - deliveredM - failedM,
      color: PENDING_COLOR,
      hint: 'Queued or in flight — no delivery receipt back from Meta yet.',
    },
  ];

  // Conversion rates — each relative to the meaningful denominator in the
  // funnel (delivery of what was sent, opens of what was delivered, etc.),
  // not raw % of total, so the numbers answer "how well did it perform".
  const rate = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 100) : 0;
  const rateTiles: RateTile[] = [
    {
      label: 'Delivery rate',
      pct: rate(broadcast.delivered_count, broadcast.sent_count),
      detail: `${broadcast.delivered_count.toLocaleString()} of ${broadcast.sent_count.toLocaleString()} sent`,
      color: SERIES.delivered,
    },
    {
      label: 'Open rate',
      pct: rate(broadcast.read_count, broadcast.delivered_count),
      detail: `${broadcast.read_count.toLocaleString()} of ${broadcast.delivered_count.toLocaleString()} delivered`,
      color: SERIES.read,
    },
    {
      label: 'Response rate',
      pct: rate(broadcast.replied_count, broadcast.delivered_count),
      detail: `${broadcast.replied_count.toLocaleString()} of ${broadcast.delivered_count.toLocaleString()} delivered`,
      color: SERIES.replied,
    },
    {
      label: 'Failure rate',
      pct: rate(broadcast.failed_count, broadcast.total_recipients),
      detail: `${broadcast.failed_count.toLocaleString()} of ${broadcast.total_recipients.toLocaleString()} total`,
      color: SERIES.failed,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back link — quiet, above the hero. */}
      <button
        type="button"
        onClick={() => router.push('/campaigns')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Campaigns
      </button>

      {/* Hero — identity, status, meta, and actions in one panel. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-muted/40 to-transparent p-5 sm:p-6">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {broadcast.name}
              </h1>
              {broadcast.status === 'scheduled' && broadcast.scheduled_at ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Scheduled
                  <span className="text-blue-400 dark:text-blue-500/70">|</span>
                  {format(new Date(broadcast.scheduled_at), 'MMM d, yyyy · h:mm a')}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                >
                  {status.label}
                </span>
              )}
            </div>

            {/* Meta chips — template, recipients, created. */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1">
                <FileText className="h-3.5 w-3.5" />
                {broadcast.template_name}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 tabular-nums">
                <Users className="h-3.5 w-3.5" />
                {broadcast.total_recipients.toLocaleString()} recipients
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {format(new Date(broadcast.created_at), 'MMM d, yyyy · h:mm a')}
              </span>
            </div>
          </div>

          {/* `flex-wrap`: a draft shows three buttons here and "Download
              report" is a wide one — without it they overflow the viewport
              on a phone instead of stacking. */}
          <div className="flex flex-wrap items-center gap-2">
            {broadcast.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => router.push(`/campaigns/new?draft=${broadcastId}`)}
                className="h-10 border-border px-4 text-foreground"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}

            {/* Report — built server-side and streamed back as .xlsx, so the
                spreadsheet library never reaches the browser bundle and the
                recipient sheet isn't capped at one PostgREST page. */}
            <Button
              variant="outline"
              onClick={handleDownloadReport}
              disabled={downloading}
              title="Download this campaign's report as an Excel file"
              className="h-10 border-border px-4 text-foreground"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? 'Preparing...' : 'Download report'}
            </Button>

            {/* Delete — type-to-confirm modal. Mid-send broadcasts can't be
                deleted because orphaning in-flight Meta messages would leave
                the counts inconsistent. */}
            <Button
              variant="outline"
              disabled={broadcast.status === 'sending'}
              onClick={() => setConfirmDelete(true)}
              title={
                broadcast.status === 'sending'
                  ? 'Cannot delete while a campaign is actively sending'
                  : 'Delete this campaign'
              }
              className="h-10 border-border px-4 text-red-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <DeleteCampaignDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        campaignName={broadcast.name}
        statusLabel={status.label}
        onConfirm={handleDelete}
        deleting={deleting}
      />

      {/* Performance — the headline conversion rates. */}
      <section className="space-y-3">
        <SectionHeading>Performance</SectionHeading>
        <RateTiles tiles={rateTiles} />
      </section>

      {/* Delivery funnel — 6 counts: Total / Sent / Delivered / Read / Replied / Failed */}
      <section className="space-y-3">
        <SectionHeading>Delivery funnel</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Recipients"
          value={broadcast.total_recipients}
          total={broadcast.total_recipients}
          icon={<Users className="h-4 w-4" />}
          color="bg-muted text-muted-foreground"
        />
        <StatCard
          label="Sent"
          value={broadcast.sent_count}
          total={broadcast.total_recipients}
          icon={<Send className="h-4 w-4" />}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          label="Delivered"
          value={broadcast.delivered_count}
          total={broadcast.total_recipients}
          icon={<CheckCheck className="h-4 w-4" />}
          color="bg-teal-500/10 text-teal-600 dark:text-teal-400"
        />
        <StatCard
          label="Read"
          value={broadcast.read_count}
          total={broadcast.total_recipients}
          icon={<Eye className="h-4 w-4" />}
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Replied"
          value={broadcast.replied_count}
          total={broadcast.total_recipients}
          icon={<MessageCircle className="h-4 w-4" />}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          label="Failed"
          value={broadcast.failed_count}
          total={broadcast.total_recipients}
          icon={<AlertCircle className="h-4 w-4" />}
          color="bg-red-500/10 text-red-600 dark:text-red-400"
        />
        </div>
      </section>

      {/* Insights — outcome breakdown + engagement over time */}
      <section className="space-y-3">
        <SectionHeading>Insights</SectionHeading>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <OutcomeDonut
            slices={outcomeSlices}
            total={broadcast.total_recipients}
          />
          {timeline ? (
            <EngagementTimeline data={timeline} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-4 text-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">
                Not enough delivery timing yet
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The engagement timeline appears once messages start being
                delivered and read.
              </p>
            </div>
          )}
        </div>

        {/* Failure reasons — only when there are failures to explain */}
        {errorGroups.length > 0 && <ErrorBreakdown groups={errorGroups} />}
      </section>

      {/* Recipients Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">
            Recipients ({filteredRecipients.length}
            {statusFilter !== 'all' ? ` of ${recipients.length}` : ''})
          </h2>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-muted-foreground hover:bg-muted"
                  />
                }
              >
                <Filter className="h-3.5 w-3.5" />
                {statusFilter === 'all'
                  ? 'All statuses'
                  : getRecipientStatus(statusFilter).label}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="border-border bg-popover">
                <DropdownMenuItem
                  onClick={() => setStatusFilter('all')}
                  className={
                    statusFilter === 'all' ? 'text-primary' : 'text-popover-foreground'
                  }
                >
                  All statuses
                </DropdownMenuItem>
                {RECIPIENT_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={
                      statusFilter === s
                        ? 'text-primary'
                        : 'text-popover-foreground'
                    }
                  >
                    {getRecipientStatus(s).label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={recipients.length === 0}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {filteredRecipients.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {recipients.length === 0
                ? 'No recipients found.'
                : 'No recipients match this filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={User}>Contact</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={Phone}>Phone</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CircleDot}>Status</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={Send}>Sent</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CheckCheck}>Delivered</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={Eye}>Read</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={AlertCircle}>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipients.map((recipient) => {
                  const rStatus = getRecipientStatus(recipient.status);
                  const fmt = (s?: string | null) =>
                    s ? format(new Date(s), 'MMM d, yyyy · h:mm a') : '—';
                  return (
                    <TableRow key={recipient.id} className="border-border hover:bg-muted/40">
                      <TableCell className="px-6 py-4 font-medium text-foreground">
                        {recipient.contact?.name ?? 'Unknown'}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground tabular-nums">
                        {recipient.contact?.phone ?? '—'}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 text-sm text-foreground">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: RECIPIENT_DOT[recipient.status] }}
                          />
                          {rStatus.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {fmt(recipient.sent_at)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {fmt(recipient.delivered_at)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {fmt(recipient.read_at)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate px-6 py-4 text-xs text-red-600 dark:text-red-400">
                        {recipient.error_message ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
