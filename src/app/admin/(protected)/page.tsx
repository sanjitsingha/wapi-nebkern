import Link from 'next/link';
import {
  Users,
  Building2,
  Banknote,
  LifeBuoy,
  AlertCircle,
  Clock,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

import { fmtMoney } from '../_lib/format';
import { getOverviewStats, getTicketAttention } from '../_lib/admin-data';
import {
  CacheNote,
  Meter,
  PageHeader,
  Panel,
  Sparkline,
  StatCard,
  StatRow,
} from '../_components/ui';

export const dynamic = 'force-dynamic';

// Every number on this page comes from three cached reads that the rest
// of the panel shares — see `_lib/admin-data.ts`. The dashboard itself
// issues no query. The support counters are the exception and are
// deliberately live: a stale "awaiting reply" is the one that costs
// something.

const STATUS_ROWS = [
  ['Trialing', 'trialing', 'bg-blue-500'],
  ['Active', 'active', 'bg-primary'],
  ['Past due', 'past_due', 'bg-amber-500'],
  ['Expired', 'expired', 'bg-red-500'],
  ['Canceled', 'canceled', 'bg-muted-foreground'],
] as const;

export default async function AdminOverviewPage() {
  const [stats, tickets] = await Promise.all([
    getOverviewStats(),
    getTicketAttention(),
  ]);

  // Growth vs the previous 30 days. Null when there is no prior period
  // to compare against — "+100%" off a base of zero is noise.
  const growth =
    stats.newLastMonth > 0
      ? Math.round(
          ((stats.newThisMonth - stats.newLastMonth) / stats.newLastMonth) * 100
        )
      : null;

  const paying = stats.byStatus.active ?? 0;
  const trialing = stats.byStatus.trialing ?? 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Tenants, revenue and support at a glance."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>{stats.accounts} tenants</span>
            <span>·</span>
            <span>{stats.users} users</span>
          </>
        }
      />

      <StatRow cols={5}>
        <StatCard
          label="Tenants"
          value={stats.accounts}
          href="/admin/accounts"
          icon={<Building2 className="size-3.5" />}
          tone="primary"
          hint={`${stats.newThisMonth} new in 30d`}
        />
        <StatCard
          label="Users"
          value={stats.users}
          href="/admin/users"
          icon={<Users className="size-3.5" />}
          tone="info"
        />
        <StatCard
          label="Run rate"
          value={fmtMoney(stats.mrrMinor, stats.currency)}
          hint={`${paying} paying · ${trialing} trialing`}
          icon={<Banknote className="size-3.5" />}
          tone="success"
        />
        <StatCard
          label="Signups 30d"
          value={stats.newThisMonth}
          delta={growth}
          icon={<TrendingUp className="size-3.5" />}
          tone="default"
        >
          <Sparkline values={stats.signups} />
        </StatCard>
        <StatCard
          label="Open tickets"
          value={tickets.open}
          href="/admin/tickets"
          icon={<LifeBuoy className="size-3.5" />}
          tone={tickets.needsReply > 0 ? 'warn' : 'default'}
          hint={`${tickets.needsReply} awaiting reply`}
        />
      </StatRow>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Subscription mix" description="Effective, not stored">
          <div className="space-y-2.5">
            {STATUS_ROWS.map(([label, key, color]) => (
              <Meter
                key={key}
                label={label}
                value={stats.byStatus[key] ?? 0}
                total={stats.accounts}
                color={color}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Plan spread" description="Tenants per plan">
          {stats.byPlan.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">
              No tenants yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {stats.byPlan.map((p) => (
                <Meter
                  key={p.key}
                  label={p.name}
                  value={p.count}
                  total={stats.accounts}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Needs attention" description="Live — not cached">
          <div className="space-y-1.5">
            <AttentionRow
              href="/admin/tickets?filter=needs_reply"
              icon={<AlertCircle className="size-3.5 text-amber-500" />}
              label="Tickets awaiting reply"
              value={tickets.needsReply}
              note={
                tickets.oldestWaitingHours !== null
                  ? `oldest ${tickets.oldestWaitingHours}h`
                  : undefined
              }
            />
            <AttentionRow
              href="/admin/accounts?filter=trial_ending"
              icon={<Clock className="size-3.5 text-blue-500" />}
              label="Trials ending in ≤ 3 days"
              value={stats.trialsEndingSoon}
            />
            <AttentionRow
              href="/admin/accounts?filter=past_due"
              icon={<Banknote className="size-3.5 text-red-500" />}
              label="Past due"
              value={stats.byStatus.past_due ?? 0}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

function AttentionRow({
  href,
  icon,
  label,
  value,
  note,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between gap-3 rounded-sm border border-(--admin-line) px-2.5 py-2 text-sm transition-colors ${
        // A zero is good news, so it should not shout the same as a five.
        value > 0 ? 'hover:bg-muted' : 'opacity-60 hover:opacity-100'
      }`}
    >
      <span className="text-foreground flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-xs">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {note && (
          <span className="text-muted-foreground font-mono text-[11px]">
            {note}
          </span>
        )}
        <span className="admin-num text-foreground font-semibold">{value}</span>
        <ArrowRight className="text-muted-foreground size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </Link>
  );
}
