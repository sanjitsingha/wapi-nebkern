'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Database,
  HardDrive,
  KeyRound,
  Webhook,
  Timer,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CircleDashed,
  Table2,
  SlidersHorizontal,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type {
  SystemHealth,
  ServiceStatus,
} from '../_lib/system-health';

const REFRESH_MS = 30_000;

/* ── formatting helpers ─────────────────────────────────────── */

function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function fmtInt(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString();
}

function fmtAgo(ms: number | null): string {
  if (ms == null) return 'never';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ── status primitives ──────────────────────────────────────── */

const STATUS_META: Record<
  ServiceStatus,
  { label: string; dot: string; text: string; bg: string; icon: typeof CheckCircle2 }
> = {
  operational: {
    label: 'Operational',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    icon: AlertTriangle,
  },
  down: {
    label: 'Down',
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    icon: XCircle,
  },
  unknown: {
    label: 'No data',
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    bg: 'bg-muted',
    icon: CircleDashed,
  },
};

function StatusPill({ status }: { status: ServiceStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        m.bg,
        m.text,
      )}
    >
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function Panel({
  title,
  icon,
  status,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  status?: ServiceStatus;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h2>
        {status && <StatusPill status={status} />}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** A labelled metric with a big value. */
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full', tone ?? 'bg-primary')}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ── service summary card ───────────────────────────────────── */

function ServiceCard({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: ServiceStatus;
  detail: string;
}) {
  const m = STATUS_META[status];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span
          className={cn('flex size-9 items-center justify-center rounded-lg', m.bg, m.text)}
        >
          {icon}
        </span>
        <span className={cn('size-2.5 rounded-full', m.dot)} title={m.label} />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
      <p className={cn('text-xs', m.text)}>{m.label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

/* ── the console ────────────────────────────────────────────── */

export function SystemHealthConsole({ initial }: { initial: SystemHealth }) {
  const [health, setHealth] = useState<SystemHealth>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [auto, setAuto] = useState(true);
  const [tick, setTick] = useState(0); // re-render "x ago" labels
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/admin/api/system', { cache: 'no-store' });
      if (!res.ok) {
        toast.error('Failed to refresh system health');
        return;
      }
      setHealth((await res.json()) as SystemHealth);
    } catch {
      toast.error('Failed to refresh system health');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh loop.
  useEffect(() => {
    if (!auto) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(refresh, REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [auto, refresh]);

  // Keep relative timestamps ("12s ago") fresh once a second.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const generatedAgoMs = Date.now() - Date.parse(health.generatedAt);
  const { database: db, storage, auth, runtime, webhooks, crons, tables, config } =
    health;

  const connPct =
    db.activeConnections != null && db.maxConnections
      ? (db.activeConnections / db.maxConnections) * 100
      : 0;

  const configGroups = Array.from(new Set(config.map((c) => c.group)));

  // `tick` drives a re-render each second so the "x ago" labels stay live.
  void tick;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">System health</h1>
            <StatusPill status={health.overall} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live status of the database, storage, auth, webhooks, and cron jobs.
            Updated {fmtAgo(generatedAgoMs)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Auto-refresh
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={refreshing}
            className="border-border"
          >
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Service summary grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <ServiceCard
          icon={<Database className="size-4.5" />}
          label="Database"
          status={db.status}
          detail={db.latencyMs != null ? `${db.latencyMs} ms` : 'unreachable'}
        />
        <ServiceCard
          icon={<HardDrive className="size-4.5" />}
          label="Storage"
          status={storage.status}
          detail={`${fmtBytes(storage.totalBytes)} used`}
        />
        <ServiceCard
          icon={<KeyRound className="size-4.5" />}
          label="Auth"
          status={auth.status}
          detail={`${fmtInt(auth.total)} users`}
        />
        <ServiceCard
          icon={<Webhook className="size-4.5" />}
          label="Webhooks"
          status={webhooks.status}
          detail={`${fmtInt(webhooks.pending)} pending`}
        />
        <ServiceCard
          icon={<Timer className="size-4.5" />}
          label="Cron jobs"
          status={crons.reduce<ServiceStatus>(
            (w, c) =>
              c.status === 'down'
                ? 'down'
                : c.status === 'degraded' && w !== 'down'
                  ? 'degraded'
                  : w,
            'operational',
          )}
          detail={`${crons.length} scheduled`}
        />
        <ServiceCard
          icon={<Server className="size-4.5" />}
          label="Runtime"
          status={runtime.status}
          detail={`up ${fmtUptime(runtime.uptimeSeconds)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Database */}
        <Panel title="Database" icon={<Database className="size-4" />} status={db.status}>
          {db.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{db.error}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Latency" value={db.latencyMs != null ? `${db.latencyMs} ms` : '—'} />
                <Metric label="Size" value={fmtBytes(db.sizeBytes)} />
                <Metric
                  label="Connections"
                  value={`${fmtInt(db.activeConnections)} / ${fmtInt(db.maxConnections)}`}
                />
                <Metric label="Postgres" value={db.postgresVersion?.split(' ')[0] ?? '—'} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Connection pool</span>
                  <span>{Math.round(connPct)}%</span>
                </div>
                <Bar
                  pct={connPct}
                  tone={connPct > 85 ? 'bg-red-500' : connPct > 65 ? 'bg-amber-500' : 'bg-primary'}
                />
              </div>
            </div>
          )}
        </Panel>

        {/* Auth */}
        <Panel title="Authentication" icon={<KeyRound className="size-4" />} status={auth.status}>
          {auth.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{auth.error}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Total users" value={fmtInt(auth.total)} />
              <Metric label="Confirmed" value={fmtInt(auth.confirmed)} />
              <Metric label="Unconfirmed" value={fmtInt(auth.unconfirmed)} />
              <Metric label="New · 24h" value={fmtInt(auth.new24h)} />
              <Metric label="New · 7d" value={fmtInt(auth.new7d)} />
              <Metric label="Active · 24h" value={fmtInt(auth.active24h)} />
            </div>
          )}
        </Panel>

        {/* Storage */}
        <Panel title="Storage" icon={<HardDrive className="size-4" />} status={storage.status}>
          {storage.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{storage.error}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {fmtBytes(storage.totalBytes)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fmtInt(storage.totalObjects)} objects ·{' '}
                  {storage.buckets.length} buckets
                </span>
              </div>
              <div className="space-y-2.5">
                {storage.buckets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stored objects.</p>
                ) : (
                  storage.buckets.map((b) => {
                    const pct =
                      storage.totalBytes > 0
                        ? (b.bytes / storage.totalBytes) * 100
                        : 0;
                    return (
                      <div key={b.bucket}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{b.bucket}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {fmtBytes(b.bytes)} · {fmtInt(b.objects)}
                          </span>
                        </div>
                        <Bar pct={pct} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* Webhooks */}
        <Panel title="Webhooks" icon={<Webhook className="size-4" />} status={webhooks.status}>
          {webhooks.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{webhooks.error}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Active endpoints" value={fmtInt(webhooks.activeEndpoints)} />
                <Metric
                  label="Pending"
                  value={fmtInt(webhooks.pending)}
                  sub={
                    webhooks.oldestPendingAgeMs != null
                      ? `oldest ${fmtAgo(webhooks.oldestPendingAgeMs)}`
                      : undefined
                  }
                />
                <Metric label="Delivered · 24h" value={fmtInt(webhooks.delivered24h)} />
                <Metric label="Failed · 24h" value={fmtInt(webhooks.failed24h)} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Success rate · 24h</span>
                  <span>
                    {webhooks.successRate24h != null
                      ? `${Math.round(webhooks.successRate24h * 100)}%`
                      : 'n/a'}
                  </span>
                </div>
                <Bar
                  pct={(webhooks.successRate24h ?? 1) * 100}
                  tone={
                    webhooks.successRate24h != null && webhooks.successRate24h < 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }
                />
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Cron jobs */}
      <Panel title="Cron jobs" icon={<Timer className="size-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Job</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Last run</th>
                <th className="pb-2 font-medium">Duration</th>
                <th className="pb-2 font-medium">Runs</th>
                <th className="pb-2 font-medium">Errors</th>
                <th className="pb-2 font-medium">Last result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {crons.map((c) => (
                <tr key={c.key}>
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-foreground">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                    {c.status === 'unknown' ? 'never' : fmtAgo(c.ageMs)}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                    {c.lastDurationMs != null ? `${c.lastDurationMs} ms` : '—'}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-foreground">
                    {fmtInt(c.runCount)}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    <span className={c.errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
                      {fmtInt(c.errorCount)}
                    </span>
                  </td>
                  <td className="py-2.5 text-[11px] text-muted-foreground">
                    {c.lastError ? (
                      <span className="text-red-600 dark:text-red-400">{c.lastError}</span>
                    ) : (
                      <code className="rounded bg-muted px-1.5 py-0.5">
                        {Object.keys(c.detail).length
                          ? Object.entries(c.detail)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')
                          : '—'}
                      </code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {crons.some((c) => c.status === 'unknown') && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            “No data” means the job hasn&apos;t reported a run yet — confirm the
            external scheduler is hitting its endpoint.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Largest tables */}
        <Panel title="Largest tables" icon={<Table2 className="size-4" />}>
          {tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No table stats available.</p>
          ) : (
            <div className="space-y-2">
              {tables.map((t) => {
                const max = tables[0]?.bytes || 1;
                return (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs font-medium text-foreground">
                      {t.name}
                    </span>
                    <div className="flex-1">
                      <Bar pct={(t.bytes / max) * 100} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {fmtBytes(t.bytes)}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {fmtInt(t.estRows)}
                    </span>
                  </div>
                );
              })}
              <p className="pt-1 text-right text-[10px] text-muted-foreground">
                size · est. rows
              </p>
            </div>
          )}
        </Panel>

        {/* Configuration + runtime */}
        <Panel title="Configuration" icon={<SlidersHorizontal className="size-4" />}>
          <div className="space-y-3">
            {configGroups.map((group) => (
              <div key={group}>
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {config
                    .filter((c) => c.group === group)
                    .map((c) => (
                      <span
                        key={c.key}
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs',
                          c.present ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {c.present ? (
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="size-3.5 text-muted-foreground/50" />
                        )}
                        {c.label}
                      </span>
                    ))}
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-3">
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Runtime
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Node {runtime.nodeVersion}</span>
                <span>env: {runtime.environment}</span>
                <span>up {fmtUptime(runtime.uptimeSeconds)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${window.location.origin}${runtime.healthEndpoint}`,
                  );
                  toast.success('Health endpoint URL copied');
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80"
              >
                <Copy className="size-3" />
                Copy public health-check URL ({runtime.healthEndpoint})
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
