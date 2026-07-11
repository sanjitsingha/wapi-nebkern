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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getBroadcastStatus,
  getRecipientStatus,
} from '@/lib/broadcast-status';

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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          {icon}
        </div>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

/**
 * Pure-CSS funnel chart: decreasing-width rounded bars.
 * Width is relative to the largest step (typically Sent) so we
 * always render a full bar at the top and proportional tails.
 */
function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">Funnel</h3>
      <div className="space-y-2">
        {steps.map((step) => {
          const pctOfMax = Math.max(5, Math.round((step.value / max) * 100));
          const pctOfSent =
            steps[0].value > 0
              ? Math.round((step.value / steps[0].value) * 100)
              : 0;
          return (
            <div key={step.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {step.label}
              </span>
              <div className="relative h-7 flex-1 rounded-full bg-muted">
                <div
                  className={`h-7 rounded-full ${step.color} transition-[width] duration-500`}
                  style={{ width: `${pctOfMax}%` }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-foreground">
                  {step.value.toLocaleString()}
                  <span className="ml-2 text-muted-foreground/80">
                    ({pctOfSent}%)
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
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

  const funnelSteps: FunnelStep[] = [
    { label: 'Sent', value: broadcast.sent_count, color: 'bg-primary' },
    { label: 'Delivered', value: broadcast.delivered_count, color: 'bg-teal-500' },
    { label: 'Read', value: broadcast.read_count, color: 'bg-blue-500' },
    { label: 'Replied', value: broadcast.replied_count, color: 'bg-amber-500' },
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/campaigns')}
            className="border-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{broadcast.name}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
              >
                {status.label}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span>Template: {broadcast.template_name}</span>
              <span>-</span>
              <span>
                Created {new Date(broadcast.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {broadcast.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/campaigns/new?draft=${broadcastId}`)}
              className="border-border text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Campaign
            </Button>
          )}

        {/* Delete — inline-confirm pattern matches the pipeline-settings
            "Delete Pipeline" flow. Mid-send broadcasts can't be deleted
            because orphaning in-flight Meta messages would leave the
            funnel inconsistent. */}
        {confirmDelete ? (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm dark:border-red-500/30 dark:bg-red-500/10">
            <span className="text-red-700 dark:text-red-300">Delete this campaign?</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="h-7 border-border bg-transparent text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="h-7 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Confirm'}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={broadcast.status === 'sending'}
            onClick={() => setConfirmDelete(true)}
            title={
              broadcast.status === 'sending'
                ? 'Cannot delete while a campaign is actively sending'
                : 'Delete this campaign'
            }
            className="border-red-200 bg-transparent text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
        </div>
      </div>

      {/* Stats — 6 cards: Total / Sent / Delivered / Read / Replied / Failed */}
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

      {/* Conversion rates */}
      <RateTiles tiles={rateTiles} />

      {/* Funnel + engagement timeline */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FunnelChart steps={funnelSteps} />
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
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground" icon={User}>Contact</TableHead>
                  <TableHead className="text-muted-foreground" icon={Phone}>Phone</TableHead>
                  <TableHead className="text-muted-foreground" icon={CircleDot}>Status</TableHead>
                  <TableHead className="text-muted-foreground" icon={Send}>Sent</TableHead>
                  <TableHead className="text-muted-foreground" icon={CheckCheck}>Delivered</TableHead>
                  <TableHead className="text-muted-foreground" icon={Eye}>Read</TableHead>
                  <TableHead className="text-muted-foreground" icon={AlertCircle}>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipients.map((recipient) => {
                  const rStatus = getRecipientStatus(recipient.status);
                  return (
                    <TableRow key={recipient.id} className="border-border">
                      <TableCell className="font-medium text-foreground">
                        {recipient.contact?.name ?? 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.contact?.phone ?? '-'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${rStatus.classes}`}
                        >
                          {rStatus.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.sent_at
                          ? new Date(recipient.sent_at).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.delivered_at
                          ? new Date(recipient.delivered_at).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recipient.read_at
                          ? new Date(recipient.read_at).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-red-600 dark:text-red-400">
                        {recipient.error_message ?? '-'}
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
