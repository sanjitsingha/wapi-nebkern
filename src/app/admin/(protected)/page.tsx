import Link from 'next/link';
import {
  Users,
  Building2,
  CreditCard,
  LifeBuoy,
  AlertCircle,
  Clock,
} from 'lucide-react';

import {
  computeSubscription,
  type SubscriptionStatus,
} from '@/lib/billing/subscription';
import { adminDb } from '../_lib/admin-db';

export const dynamic = 'force-dynamic';

interface AccountRow {
  plan: string | null;
  subscription_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

interface TicketRow {
  status: string;
  last_message_at: string | null;
  last_support_reply_at: string | null;
}

/** A ticket whose newest message came from the customer and isn't closed. */
function ticketNeedsReply(t: TicketRow): boolean {
  if (t.status === 'closed' || t.status === 'resolved') return false;
  if (!t.last_message_at) return false;
  if (!t.last_support_reply_at) return true;
  return Date.parse(t.last_message_at) > Date.parse(t.last_support_reply_at);
}

function StatCard({
  label,
  value,
  icon,
  href,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href?: string;
  accent?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
      <div
        className={`flex size-9 items-center justify-center rounded-lg ${accent ?? 'bg-muted text-muted-foreground'}`}
      >
        {icon}
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminDashboardPage() {
  const db = adminDb();

  const [accountsRes, usersRes, ticketsRes] = await Promise.all([
    db
      .from('accounts')
      .select('plan, subscription_status, trial_started_at, trial_ends_at, created_at'),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db
      .from('support_tickets')
      .select('status, last_message_at, last_support_reply_at'),
  ]);

  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const tickets = (ticketsRes.data ?? []) as TicketRow[];
  const userCount = usersRes.count ?? 0;

  const byStatus: Record<SubscriptionStatus, number> = {
    trialing: 0,
    active: 0,
    past_due: 0,
    canceled: 0,
    expired: 0,
  };
  let trialsEndingSoon = 0;
  for (const a of accounts) {
    const sub = computeSubscription(a);
    byStatus[sub.status] += 1;
    if (sub.isTrial && sub.trialDaysLeft <= 3) trialsEndingSoon += 1;
  }

  const openTickets = tickets.filter(
    (t) => t.status === 'open' || t.status === 'pending',
  ).length;
  const needsReply = tickets.filter(ticketNeedsReply).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tenants, subscriptions, and support at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={accounts.length}
          href="/admin/accounts"
          icon={<Building2 className="size-4.5" />}
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          label="Users"
          value={userCount}
          icon={<Users className="size-4.5" />}
          accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Active / trialing"
          value={byStatus.active + byStatus.trialing}
          icon={<CreditCard className="size-4.5" />}
          accent="bg-teal-500/10 text-teal-600 dark:text-teal-400"
        />
        <StatCard
          label="Open tickets"
          value={openTickets}
          href="/admin/tickets"
          icon={<LifeBuoy className="size-4.5" />}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Subscription breakdown */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Subscriptions</h2>
          <div className="mt-3 space-y-2">
            {(
              [
                ['Trialing', byStatus.trialing, 'bg-blue-500'],
                ['Active', byStatus.active, 'bg-primary'],
                ['Past due', byStatus.past_due, 'bg-amber-500'],
                ['Expired', byStatus.expired, 'bg-red-500'],
                ['Canceled', byStatus.canceled, 'bg-muted-foreground'],
              ] as const
            ).map(([label, count, color]) => {
              const pct =
                accounts.length > 0
                  ? Math.round((count / accounts.length) * 100)
                  : 0;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">
                    {label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Attention */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Needs attention</h2>
          <div className="mt-3 space-y-2">
            <Link
              href="/admin/tickets?filter=needs_reply"
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-foreground">
                <AlertCircle className="size-4 text-amber-500" />
                Tickets awaiting reply
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {needsReply}
              </span>
            </Link>
            <Link
              href="/admin/accounts?filter=trial_ending"
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-foreground">
                <Clock className="size-4 text-blue-500" />
                Trials ending ≤ 3 days
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {trialsEndingSoon}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
