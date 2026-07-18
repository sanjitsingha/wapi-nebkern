'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  BadgeCheck,
  ArrowUpRight,
  Receipt,
  Users,
  Contact,
  HardDrive,
  Check,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatMoney } from '@/lib/billing/plans';
import { type Invoice } from '@/lib/billing/invoice';
import { TRIAL_DAYS, type SubscriptionState } from '@/lib/billing/subscription';
import { useEntitlements } from '@/hooks/use-entitlements';

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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function intervalSuffix(interval: 'monthly' | 'yearly' | null): string {
  if (interval === 'yearly') return '/yr';
  if (interval === 'monthly') return '/mo';
  return '';
}

/** Placeholder until Razorpay checkout lands — records intent, no charge. */
function requestUpgrade() {
  toast.info(
    'Self-serve upgrade is coming soon. Contact us and we’ll switch your plan.',
  );
}

/**
 * The current subscription block — reflects the plan the admin assigned
 * (name, price, billing period) plus trial/expiry state. Rendered as a
 * plain bordered block (PlanSection is itself a Card, so nesting Cards
 * would read as a box-in-a-box).
 */
function CurrentPlan({
  sub,
  billing,
}: {
  sub: SubscriptionState;
  billing: AccountBilling | null;
}) {
  // Trial — show progress + end date.
  if (sub.status === 'trialing') {
    const elapsed = Math.min(
      100,
      Math.max(0, ((TRIAL_DAYS - sub.trialDaysLeft) / TRIAL_DAYS) * 100),
    );
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Free trial</p>
              <p className="text-xs text-muted-foreground">
                Full access to every feature
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            {sub.trialDaysLeft > 0
              ? `${sub.trialDaysLeft} day${sub.trialDaysLeft === 1 ? '' : 's'} left`
              : 'Ends today'}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
            style={{ width: `${elapsed}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Your trial ends on {formatDate(sub.trialEndsAt)}. Upgrade to a plan
          before then to keep sending without interruption.
        </p>
      </div>
    );
  }

  // Expired / past due / canceled — access is paused.
  if (sub.status !== 'active') {
    const title =
      sub.status === 'expired'
        ? 'Your free trial has ended'
        : sub.status === 'past_due'
          ? 'Your payment is past due'
          : 'Your subscription is canceled';
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          Sending messages and broadcasts is paused. Upgrade to resume.
        </AlertDescription>
      </Alert>
    );
  }

  // Active with a plan the admin assigned — show name, price, renewal.
  if (billing && (billing.planName || billing.planKey)) {
    const priceLabel =
      billing.amount != null
        ? `${formatMoney(billing.amount, billing.currency)}${intervalSuffix(
            billing.interval,
          )}`
        : null;
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BadgeCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground capitalize">
                {billing.planName ?? billing.planKey} plan
              </p>
              <p className="text-xs text-muted-foreground">
                {billing.interval === 'yearly'
                  ? 'Billed yearly'
                  : 'Billed monthly'}
              </p>
            </div>
          </div>
          {priceLabel && (
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              {priceLabel}
            </span>
          )}
        </div>
        {billing.periodEnd && (
          <p className="mt-3 text-xs text-muted-foreground">
            Current period ends on {formatDate(billing.periodEnd)}.
          </p>
        )}
      </div>
    );
  }

  // Active but no billing assigned (grandfathered / manual full access).
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <BadgeCheck className="size-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">Full access</p>
        <p className="text-xs text-muted-foreground">
          Your account is active with full access.
        </p>
      </div>
    </div>
  );
}

/** One usage meter row — mirrors the trial bar's idiom above. */
function UsageMeter({
  icon: Icon,
  label,
  used,
  limit,
  format = (n: number) => n.toLocaleString(),
}: {
  icon: typeof Users;
  label: string;
  used: number;
  limit: number | null;
  format?: (n: number) => string;
}) {
  const pct = limit === null ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const tone =
    limit !== null && used >= limit
      ? 'bg-destructive'
      : pct >= 90
        ? 'bg-amber-500'
        : 'bg-primary';
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Icon className="size-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {format(used)}
          {limit !== null ? ` / ${format(limit)}` : ' · Unlimited'}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', tone)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Plan usage — live meters for seats / contacts / storage plus which
 * features the current plan includes. Hidden entirely when the account
 * has no plan limits (trial / grandfathered / everything unlimited with
 * all features on), where meters would just be noise.
 */
function UsageSection() {
  const { snapshot } = useEntitlements();
  if (!snapshot) return null;

  const { entitlements: ent, usage } = snapshot;
  const hasAnyLimit =
    ent.maxUsers !== null || ent.maxContacts !== null || ent.storageMb !== null;
  const features: { label: string; on: boolean }[] = [
    { label: 'WhatsApp calling', on: ent.allowCalling },
    { label: 'Instagram DMs', on: ent.allowInstagram },
    { label: 'Automations', on: ent.allowAutomations },
    { label: 'Flows', on: ent.allowFlows },
    { label: 'API & webhooks', on: ent.allowIntegrations },
  ];
  const hasAnyGate = features.some((f) => !f.on);
  if (!hasAnyLimit && !hasAnyGate) return null;

  const usedMb = usage.storageBytes / (1024 * 1024);
  const fmtMb = (n: number) =>
    n >= 1024 ? `${(n / 1024).toFixed(1)} GB` : `${Math.round(n)} MB`;

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">Usage</p>
      <div className="space-y-4 rounded-xl border border-border p-4">
        <UsageMeter icon={Users} label="Team members" used={usage.users} limit={ent.maxUsers} />
        <UsageMeter icon={Contact} label="Contacts" used={usage.contacts} limit={ent.maxContacts} />
        <UsageMeter
          icon={HardDrive}
          label="Media storage"
          used={usedMb}
          limit={ent.storageMb}
          format={fmtMb}
        />

        <div className="border-t border-border pt-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {features.map((f) => (
              <span
                key={f.label}
                className={cn(
                  'inline-flex items-center gap-1 text-xs',
                  f.on ? 'text-foreground' : 'text-muted-foreground line-through',
                )}
              >
                {f.on ? (
                  <Check className="size-3 text-primary" />
                ) : (
                  <X className="size-3" />
                )}
                {f.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        status === 'paid'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      )}
    >
      {status === 'paid' ? 'Paid' : 'Due'}
    </span>
  );
}

/**
 * Invoices / billing history — fetched from /api/account/invoices. Each
 * row links to a printable copy (opens in a new tab). Empty state until a
 * payment is recorded by the admin.
 */
function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/invoices')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setInvoices(data?.invoices ?? []);
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">Invoices</p>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading invoices…
        </div>
      ) : invoices && invoices.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {inv.invoiceNumber ?? 'Invoice'}
                  </p>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(inv.issuedAt)} · {inv.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {formatMoney(inv.amount, inv.currency)}
                </span>
                <Link
                  href={`/invoices/${inv.id}`}
                  target="_blank"
                  className="text-xs font-medium text-primary hover:text-primary/80"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Receipt className="size-4.5" />
          </span>
          <p className="mt-3 text-sm font-medium text-foreground">
            No invoices yet
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Your invoices will appear here once a payment is recorded on your
            account.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Plan & subscription block on the Profile settings page. Reflects the
 * plan the admin assigned, offers an upgrade action, and lists invoices.
 * The old "available plans" grid was removed — plan changes are handled
 * via upgrade/contact, not self-serve tier cards.
 */
export function PlanSection() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [billing, setBilling] = useState<AccountBilling | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setSub(data?.subscription ?? null);
        setBilling(data?.billing ?? null);
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
  }, []);

  const canUpgrade = !sub || sub.status !== 'active' || !billing;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="space-y-5 px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your current subscription and invoices.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={canUpgrade ? 'default' : 'outline'}
            onClick={requestUpgrade}
            className="shrink-0"
          >
            {canUpgrade ? 'Upgrade' : 'Change plan'}
            <ArrowUpRight className="size-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading your plan…
          </div>
        ) : (
          <>
            {sub && <CurrentPlan sub={sub} billing={billing} />}
            <UsageSection />
            <Invoices />
          </>
        )}
      </CardContent>
    </Card>
  );
}
