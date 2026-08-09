import Link from 'next/link';
import {
  Users,
  Building2,
  CreditCard,
  LifeBuoy,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

import { getOverviewStats, getTicketAttention } from '../_lib/admin-data';
import { PageHeader, Panel, StatCard } from '../_components/ui';

export const dynamic = 'force-dynamic';

// The two loaders differ on purpose: the stats are cached for a minute,
// the ticket counters are not. See `_lib/admin-data.ts` — a stale
// "awaiting reply" number is the one that actually costs something.

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Tenants, subscriptions and support at a glance."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={stats.accounts}
          href="/admin/accounts"
          icon={<Building2 className="size-4" />}
          tone="primary"
        />
        <StatCard
          label="Users"
          value={stats.users}
          href="/admin/users"
          icon={<Users className="size-4" />}
          tone="info"
        />
        <StatCard
          label="Active / trialing"
          value={(stats.byStatus.active ?? 0) + (stats.byStatus.trialing ?? 0)}
          hint={`${stats.byStatus.active ?? 0} paying`}
          icon={<CreditCard className="size-4" />}
          tone="success"
        />
        <StatCard
          label="Open tickets"
          value={tickets.open}
          href="/admin/tickets"
          icon={<LifeBuoy className="size-4" />}
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Subscriptions" description="Across all tenants">
          <div className="space-y-2.5">
            {STATUS_ROWS.map(([label, key, color]) => {
              const count = stats.byStatus[key] ?? 0;
              const pct =
                stats.accounts > 0
                  ? Math.round((count / stats.accounts) * 100)
                  : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-muted-foreground w-20 shrink-0 text-xs">
                    {label}
                  </span>
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-foreground w-8 shrink-0 text-right text-xs font-medium tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Needs attention" description="Live — not cached">
          <div className="space-y-2">
            <AttentionRow
              href="/admin/tickets?filter=needs_reply"
              icon={<AlertCircle className="size-4 text-amber-500" />}
              label="Tickets awaiting reply"
              value={tickets.needsReply}
            />
            <AttentionRow
              href="/admin/accounts?filter=trial_ending"
              icon={<Clock className="size-4 text-blue-500" />}
              label="Trials ending in ≤ 3 days"
              value={stats.trialsEndingSoon}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AttentionRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className={`border-border hover:bg-muted group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        // A zero is good news, so it should not shout the same as a five.
        value > 0 ? '' : 'opacity-70'
      }`}
    >
      <span className="text-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-foreground font-semibold tabular-nums">
          {value}
        </span>
        <ArrowRight className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </Link>
  );
}
