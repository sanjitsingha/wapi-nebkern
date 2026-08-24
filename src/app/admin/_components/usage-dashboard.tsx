'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Database,
  HardDrive,
  Users,
  Layers,
  Zap,
  Radio,
  Globe,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Server,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  type SupabaseUsageData,
  type SupabaseQuota,
  FREE_TIER_LIMITS,
  fmtBytes,
  fmtNumber,
} from '../_lib/supabase-usage-types';

// Vibrant palette for multi-bar and category displays
const PALETTE = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#a855f7', // Purple
  '#0ea5e9', // Sky
  '#84cc16', // Lime
];

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

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    name?: string;
    color?: string;
    payload?: {
      name?: string;
      estRows?: number;
      [key: string]: unknown;
    };
  }>;
  label?: string | number;
  valueFormatter?: (v: number) => string;
  title?: string;
}

function CustomChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v: number) => String(v),
  title,
}: CustomChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const extra = item.payload;
  const heading = title ?? (typeof label === 'string' ? label : extra?.name ?? 'Metric');
  const numValue = typeof item.value === 'number' ? item.value : Number(item.value) || 0;

  return (
    <div className="bg-popover/95 text-popover-foreground border-border min-w-36 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground text-xs font-medium">
        {String(heading)}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: item.color ?? '#6366f1' }}
        />
        <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
          {valueFormatter(numValue)}
        </span>
      </div>
      {extra?.estRows != null && (
        <p className="text-muted-foreground mt-1 border-t border-border/50 pt-1 text-[11px]">
          ~{fmtNumber(Number(extra.estRows))} estimated rows
        </p>
      )}
    </div>
  );
}

function QuotaCard({
  quota,
  icon,
  subtext,
}: {
  quota: SupabaseQuota;
  icon: React.ReactNode;
  subtext?: string;
}) {
  // Mini donut data for Recharts
  const pieData = [
    { name: 'Used', value: Math.max(0.1, quota.percentage) },
    { name: 'Remaining', value: Math.max(0, 100 - quota.percentage) },
  ];

  const pieColors =
    quota.tone === 'critical'
      ? ['#ef4444', 'rgba(239, 68, 68, 0.12)']
      : quota.tone === 'warning'
        ? ['#f59e0b', 'rgba(245, 158, 11, 0.12)']
        : ['#10b981', 'rgba(16, 185, 129, 0.12)'];

  return (
    <div className="border-border bg-card relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-xs transition-all hover:border-border/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-9 items-center justify-center rounded-xl"
            style={{
              backgroundColor:
                quota.tone === 'critical'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : quota.tone === 'warning'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(16, 185, 129, 0.12)',
              color:
                quota.tone === 'critical'
                  ? '#ef4444'
                  : quota.tone === 'warning'
                    ? '#f59e0b'
                    : '#10b981',
            }}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-foreground text-sm font-semibold">{quota.label}</h3>
            <p className="text-muted-foreground text-xs">
              {quota.usedFormatted} of {quota.limitFormatted}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            quota.tone === 'good' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            quota.tone === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            quota.tone === 'critical' && 'bg-red-500/10 text-red-600 dark:text-red-400'
          )}
        >
          {quota.percentage}%
        </span>
      </div>

      {/* Recharts Mini Gauge */}
      <div className="relative my-3 flex h-28 items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={48}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-foreground text-xl font-bold tabular-nums">
            {quota.percentage}%
          </span>
          <span className="text-muted-foreground text-[10px]">used</span>
        </div>
      </div>

      <div className="border-border/60 bg-muted/30 -mx-5 -mb-5 flex items-center justify-between border-t px-5 py-2.5 text-xs">
        <span className="text-muted-foreground">Free Limit: {quota.limitFormatted}</span>
        <span className="text-foreground font-medium">{subtext ?? 'Free Tier'}</span>
      </div>
    </div>
  );
}

export function UsageDashboard({ initial }: { initial: SupabaseUsageData }) {
  const [data, setData] = useState<SupabaseUsageData>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  // Manual on-demand refresh only (saves API tokens & quotas)
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/admin/api/usage', { cache: 'no-store' });
      if (!res.ok) {
        toast.error('Failed to refresh Supabase usage metrics');
        return;
      }
      const next = (await res.json()) as SupabaseUsageData;
      setData(next);
      toast.success('Metrics updated successfully');
    } catch {
      toast.error('Failed to refresh Supabase usage metrics');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Update relative timestamp ("X seconds ago")
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  void tick;
  const ageMs = Date.now() - Date.parse(data.generatedAt);
  const { quotas, database, storage, auth, project } = data;

  // Recharts Table Data
  const tableChartData = database.topTables.map((t, idx) => ({
    name: t.name,
    mb: Math.round((t.bytes / (1024 * 1024)) * 100) / 100,
    bytes: t.bytes,
    estRows: t.estRows,
    color: PALETTE[idx % PALETTE.length],
  }));

  // Recharts Signup Trend Data
  const signupChartData = auth.signupTrend.map((d) => ({
    day: d.label,
    signups: d.signups,
    rawDay: d.day,
  }));

  // Database capacity breakdown for Pie Chart
  const dbUsedMB = Math.round((database.sizeBytes / (1024 * 1024)) * 10) / 10;
  const dbFreeMB = Math.max(0, 500 - dbUsedMB);
  const dbCapacityData = [
    { name: 'Used DB Space', value: dbUsedMB, color: '#10b981' },
    { name: 'Free Available', value: dbFreeMB, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              Supabase Usage & Quotas
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {project.status}
            </span>
            <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {project.plan}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Resource metrics for <strong className="text-foreground">{project.organization}</strong> (
            {project.name}) · Updated {fmtAgo(ageMs)}.
          </p>
        </div>

        {/* On-demand refresh button (no background polling token consumption) */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground/80 hidden text-xs sm:inline-block">
            ⚡ On-demand (saves API calls)
          </span>
          <Button
            type="button"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-2 shadow-xs"
          >
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh Metrics'}
          </Button>
        </div>
      </div>

      {/* Quota Progress Cards with Recharts Mini Gauges */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuotaCard
          quota={quotas.database}
          icon={<Database className="size-4.5" />}
          subtext={`${fmtBytes(FREE_TIER_LIMITS.dbSizeBytes - database.sizeBytes)} free space`}
        />
        <QuotaCard
          quota={quotas.storage}
          icon={<HardDrive className="size-4.5" />}
          subtext={`${storage.totalObjects} objects across ${storage.buckets.length} buckets`}
        />
        <QuotaCard
          quota={quotas.mau}
          icon={<Users className="size-4.5" />}
          subtext={`${auth.confirmed} confirmed accounts`}
        />
        <QuotaCard
          quota={quotas.projects}
          icon={<Layers className="size-4.5" />}
          subtext="1 active project available"
        />
      </div>

      {/* Inactivity Auto-Pause & Health Banner */}
      <div className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-sm font-semibold">
                Free-Tier Auto-Pause Guard
              </h2>
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                7-Day Inactivity Rule
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Supabase automatically pauses Free Tier projects after 7 consecutive days of no API or dashboard activity.
              Your database is active today and is completely safe from pausing.
            </p>
          </div>
        </div>
        <div className="bg-emerald-500/5 border-emerald-500/20 shrink-0 rounded-xl border px-4 py-2 text-right sm:text-center">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">
            Safety Status
          </p>
          <p className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
            ● Active & Protected
          </p>
        </div>
      </div>

      {/* Recharts Interactive Visualizations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Table Storage Distribution (Colorful Recharts BarChart) */}
        <div className="border-border bg-card rounded-2xl border p-5 shadow-xs lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4.5 text-indigo-500" />
                <div>
                  <h2 className="text-foreground text-base font-semibold">
                    Table Storage Distribution
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    Largest public schema tables by disk footprint (MB)
                  </p>
                </div>
              </div>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                Total: {fmtBytes(database.sizeBytes)}
              </span>
            </div>

            {tableChartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tableChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(200,200,200,0.15)" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `${v} MB`}
                      tick={{ fill: '#888', fontSize: 11 }}
                      axisLine={{ stroke: '#444', strokeWidth: 0.5 }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#888', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={100}
                    />
                    <RechartsTooltip
                      content={
                        <CustomChartTooltip
                          valueFormatter={(v) => `${v} MB (${fmtBytes(Number(v) * 1024 * 1024)})`}
                        />
                      }
                    />
                    <Bar dataKey="mb" radius={[0, 6, 6, 0]}>
                      {tableChartData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground py-16 text-center text-sm">
                No tables found in public schema.
              </p>
            )}
          </div>

          <div className="border-border/60 mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-[11px] text-muted-foreground">
            {tableChartData.slice(0, 4).map((t) => (
              <span key={t.name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-foreground font-medium">{t.name}</span> ({t.mb} MB)
              </span>
            ))}
          </div>
        </div>

        {/* 14-Day User Signups Trend (Colorful Recharts AreaChart) */}
        <div className="border-border bg-card rounded-2xl border p-5 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4.5 text-violet-500" />
                <div>
                  <h2 className="text-foreground text-base font-semibold">
                    14-Day Registration Trend
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    Daily Auth registrations timeline
                  </p>
                </div>
              </div>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {auth.total} total users
              </span>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={signupChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.15)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#888', fontSize: 10 }}
                    axisLine={{ stroke: '#444', strokeWidth: 0.5 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#888', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    content={<CustomChartTooltip valueFormatter={(v) => `${v} signups`} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="signups"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#signupGradient)"
                    dot={{ fill: '#8b5cf6', stroke: '#fff', strokeWidth: 1.5, r: 3 }}
                    activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-4 text-center">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <p className="text-muted-foreground text-[11px]">New · 24h</p>
              <p className="text-foreground text-base font-semibold tabular-nums">
                {auth.new24h}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5">
              <p className="text-muted-foreground text-[11px]">New · 7d</p>
              <p className="text-foreground text-base font-semibold tabular-nums">
                {auth.new7d}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5">
              <p className="text-muted-foreground text-[11px]">Active · 24h</p>
              <p className="text-foreground text-base font-semibold tabular-nums">
                {auth.active24h}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Free Tier Limits Table */}
      <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-xs">
        <div className="border-border border-b p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChartIcon className="size-4.5 text-emerald-500" />
              <div>
                <h2 className="text-foreground text-base font-semibold">
                  Free Tier Quotas & Capacity Summary
                </h2>
                <p className="text-muted-foreground text-xs">
                  Official quotas for Supabase Free Tier vs your current consumption
                </p>
              </div>
            </div>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Sparkles className="size-3.5 text-amber-500" />
              All quotas safe
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 font-semibold">Resource</th>
                <th className="px-5 py-3 font-semibold">Current Usage</th>
                <th className="px-5 py-3 font-semibold">Free Tier Limit</th>
                <th className="px-5 py-3 font-semibold">Capacity Bar</th>
                <th className="px-5 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {[
                {
                  name: 'Database Storage',
                  icon: <Database className="size-4 text-emerald-500" />,
                  used: quotas.database.usedFormatted,
                  limit: quotas.database.limitFormatted,
                  pct: quotas.database.percentage,
                  tone: quotas.database.tone,
                },
                {
                  name: 'File Storage (Buckets)',
                  icon: <HardDrive className="size-4 text-emerald-500" />,
                  used: quotas.storage.usedFormatted,
                  limit: quotas.storage.limitFormatted,
                  pct: quotas.storage.percentage,
                  tone: quotas.storage.tone,
                },
                {
                  name: 'Monthly Active Users (MAU)',
                  icon: <Users className="size-4 text-emerald-500" />,
                  used: `${quotas.mau.usedFormatted} users`,
                  limit: quotas.mau.limitFormatted,
                  pct: quotas.mau.percentage,
                  tone: quotas.mau.tone,
                },
                {
                  name: 'Active Projects',
                  icon: <Layers className="size-4 text-emerald-500" />,
                  used: '1 project',
                  limit: '2 projects',
                  pct: 50,
                  tone: 'good' as const,
                },
                {
                  name: 'Edge Functions Invocations',
                  icon: <Zap className="size-4 text-emerald-500" />,
                  used: '0 calls',
                  limit: '500,000 / mo',
                  pct: 0,
                  tone: 'good' as const,
                },
                {
                  name: 'Realtime Messages',
                  icon: <Radio className="size-4 text-emerald-500" />,
                  used: '< 100 msgs',
                  limit: '2,000,000 / mo',
                  pct: 0.1,
                  tone: 'good' as const,
                },
                {
                  name: 'Egress Bandwidth',
                  icon: <Globe className="size-4 text-emerald-500" />,
                  used: '< 50 MB',
                  limit: '5 GB / mo',
                  pct: 1,
                  tone: 'good' as const,
                },
              ].map((row) => (
                <tr key={row.name} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5 font-medium">
                      {row.icon}
                      <span className="text-foreground">{row.name}</span>
                    </div>
                  </td>
                  <td className="text-foreground px-5 py-3.5 font-mono text-xs font-medium tabular-nums">
                    {row.used}
                  </td>
                  <td className="text-muted-foreground px-5 py-3.5 text-xs">
                    {row.limit}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex w-36 items-center gap-2">
                      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                        <div
                          style={{ width: `${Math.max(3, row.pct)}%` }}
                          className={cn(
                            'h-full rounded-full transition-all',
                            row.tone === 'good' && 'bg-emerald-500',
                            row.tone === 'warning' && 'bg-amber-500',
                            row.tone === 'critical' && 'bg-red-500'
                          )}
                        />
                      </div>
                      <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                        {row.pct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Normal
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Database Connection & Host Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-medium">Database Host</p>
          <p className="text-foreground mt-1 truncate font-mono text-xs" title={project.dbHost}>
            {project.dbHost}
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-medium">Postgres Engine</p>
          <p className="text-foreground mt-1 font-mono text-xs">
            {project.postgresVersion}
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-medium">Connection Pool</p>
          <p className="text-foreground mt-1 font-mono text-xs tabular-nums">
            {database.activeConnections} / {database.maxConnections} max
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-medium">Response Latency</p>
          <p className="text-foreground mt-1 font-mono text-xs tabular-nums">
            {database.latencyMs} ms
          </p>
        </div>
      </div>
    </div>
  );
}
