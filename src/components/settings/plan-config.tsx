'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Hourglass,
  Loader2,
  Receipt,
  Repeat,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { softBadge } from '@/lib/badge-colors';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/billing/plans';
import { type Invoice } from '@/lib/billing/invoice';
import { type SubscriptionState } from '@/lib/billing/subscription';
import { UpgradeDialog, type PlanOption } from '@/components/billing/upgrade-dialog';

/** Mirrors AccountBilling from /api/account/subscription. */
interface AccountBilling {
  planKey: string | null;
  planName: string | null;
  amount: number | null;
  currency: string;
  interval: 'monthly' | 'yearly' | null;
  periodStart: string | null;
  periodEnd: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function intervalSuffix(interval: 'monthly' | 'yearly' | null): string {
  if (interval === 'yearly') return '/yr';
  if (interval === 'monthly') return '/mo';
  return '';
}

const PILL = 'rounded-full border px-2 py-0.5 text-[11px] font-medium';

type Fact = { icon: LucideIcon; label: string; value: string };

/**
 * What the account is on, as one row of facts — the dashboard's
 * figures idiom: a grey icon and label over each value, a rule between
 * them. Only facts that exist are shown.
 */
function planFacts(sub: SubscriptionState, billing: AccountBilling | null): Fact[] {
  const rawName = billing?.planName ?? billing?.planKey ?? null;
  // A bare key ('growth') reads as a name with its first letter up.
  const paidName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : null;

  if (sub.status === 'trialing') {
    return [
      { icon: BadgeCheck, label: 'Plan', value: 'Free trial' },
      {
        icon: Hourglass,
        label: 'Days left',
        value:
          sub.trialDaysLeft > 0
            ? `${sub.trialDaysLeft} day${sub.trialDaysLeft === 1 ? '' : 's'}`
            : 'Ends today',
      },
      { icon: CalendarDays, label: 'Ends on', value: formatDate(sub.trialEndsAt) },
    ];
  }

  if (sub.status !== 'active') {
    const facts: Fact[] = [{ icon: BadgeCheck, label: 'Plan', value: paidName ?? 'Free trial' }];
    const endedAt = billing?.periodEnd ?? sub.trialEndsAt;
    if (endedAt) facts.push({ icon: CalendarDays, label: 'Ended on', value: formatDate(endedAt) });
    return facts;
  }

  // Active with no plan assigned: grandfathered, or full access given
  // by hand.
  if (!paidName) return [{ icon: BadgeCheck, label: 'Plan', value: 'Full access' }];

  const facts: Fact[] = [{ icon: BadgeCheck, label: 'Plan', value: paidName }];
  if (billing?.amount != null) {
    facts.push({
      icon: Wallet,
      label: 'Price',
      value: `${formatMoney(billing.amount, billing.currency)}${intervalSuffix(billing.interval)}`,
    });
  }
  if (billing?.interval) {
    facts.push({
      icon: Repeat,
      label: 'Billing',
      value: billing.interval === 'yearly' ? 'Yearly' : 'Monthly',
    });
  }
  if (billing?.periodEnd) {
    facts.push({ icon: CalendarDays, label: 'Paid until', value: formatDate(billing.periodEnd) });
  }
  return facts;
}

function StatusPill({ status }: { status: SubscriptionState['status'] }) {
  const [label, color] =
    status === 'trialing'
      ? (['Trial', softBadge.amber] as const)
      : status === 'active'
        ? (['Active', softBadge.green] as const)
        : status === 'past_due'
          ? (['Payment due', softBadge.red] as const)
          : status === 'canceled'
            ? (['Canceled', softBadge.red] as const)
            : (['Ended', softBadge.red] as const);
  return <span className={cn(PILL, color)}>{label}</span>;
}

/** Paid / Due pill on an invoice row. */
function InvoiceStatus({ status }: { status: Invoice['status'] }) {
  return (
    <span className={cn(PILL, status === 'paid' ? softBadge.green : softBadge.amber)}>
      {status === 'paid' ? 'Paid' : 'Due'}
    </span>
  );
}

/** Invoices from /api/account/invoices, each opening a printable copy
 *  in a new tab. */
function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/invoices')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setInvoices(data?.invoices ?? []);
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="border-border bg-card rounded-xl border">
      <header className="border-border border-b px-5 py-4">
        <h3 className="text-foreground text-sm font-semibold">Invoices</h3>
      </header>

      {invoices === null ? (
        <div className="text-muted-foreground flex items-center gap-2 px-5 py-6 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading invoices…
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-2 px-5 py-8 text-sm">
          <Receipt className="size-5" />
          No invoices yet
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-foreground truncate text-sm font-medium">
                    {inv.invoiceNumber ?? 'Invoice'}
                  </p>
                  <InvoiceStatus status={inv.status} />
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {formatDate(inv.issuedAt)} · {inv.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="text-foreground text-sm font-medium tabular-nums">
                  {formatMoney(inv.amount, inv.currency)}
                </span>
                <Link
                  href={`/invoices/${inv.id}`}
                  target="_blank"
                  className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
                >
                  View
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Settings → Profile → Plan. Two sections:
 *
 *   - Current plan: a status pill and the upgrade action in its header,
 *     and the plan as one row of facts.
 *   - Invoices.
 *
 * Activation codes are redeemed where a plan is bought — the upgrade
 * dialog and onboarding — not here.
 *
 * No usage meters: limits are enforced where they bite, not tracked
 * here. Plan changes go through the upgrade dialog, not tier cards.
 */
export function PlanSection() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [billing, setBilling] = useState<AccountBilling | null>(null);
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/account/subscription').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/billing/plans').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([subData, planData]) => {
        if (cancelled) return;
        setSub(subData?.subscription ?? null);
        setBilling(subData?.billing ?? null);
        setPlans(planData?.plans ?? []);
      })
      .catch(() => {
        /* leave state null — the section still renders */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // What can this account move to?
  //   • Active on a paid plan → only the tiers priced ABOVE the current
  //     one (a genuine upgrade). Empty ⇒ they're on the top plan, and
  //     there is no button at all.
  //   • Trial / expired / grandfathered (no paid plan) → every plan.
  // Compared by price, so a retired/renamed current plan that no longer
  // appears in the catalog still resolves correctly off billing.amount.
  const sortedPlans = [...(plans ?? [])].sort((a, b) => a.amount - b.amount);
  const isActivePaid = sub?.status === 'active' && !!billing?.planKey;
  const currentAmount = billing?.amount ?? null;
  const choices =
    isActivePaid && currentAmount != null
      ? sortedPlans.filter((p) => p.amount > currentAmount)
      : sortedPlans;
  const paused = !!sub && sub.status !== 'active' && sub.status !== 'trialing';
  const facts = sub ? planFacts(sub, billing) : [];

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-xl border">
        <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground text-sm font-semibold">Current plan</h3>
            {sub && <StatusPill status={sub.status} />}
          </div>
          {!loading && choices.length > 0 && (
            <Button type="button" size="lg" className="px-4" onClick={() => setUpgradeOpen(true)}>
              {isActivePaid ? 'Upgrade' : 'Choose a plan'}
            </Button>
          )}
        </header>

        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 px-5 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading your plan…
          </div>
        ) : (
          <div className="px-5 py-5">
            <dl className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-border">
              {facts.map((f) => (
                <div key={f.label} className="sm:px-5 sm:first:pl-0">
                  <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                    <f.icon className="size-3.5 shrink-0" />
                    {f.label}
                  </dt>
                  <dd className="text-foreground mt-1.5 text-base font-semibold">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Only when the account must act. */}
            {paused && (
              <p className="mt-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
                <TriangleAlert className="size-4 shrink-0 text-amber-600" />
                Sending is paused. Choose a plan to keep going.
              </p>
            )}
          </div>
        )}

      </section>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        plans={choices}
        onUpgraded={() => setReloadKey((k) => k + 1)}
      />

      <Invoices />
    </div>
  );
}
