'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CalendarClock } from 'lucide-react';

import type { BillingPlan } from '@/lib/billing/plans';
import { PAYMENT_METHODS } from '@/lib/billing/invoice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NONE = '__none__';

type PaymentStatus = 'paid' | 'due' | 'complimentary';

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'due', label: 'Not paid yet (due)' },
  { value: 'complimentary', label: 'Complimentary (free)' },
];

// Razorpay records itself through its own verify route. Offering it here
// would let a manual entry pose as a gateway payment it never was.
const MANUAL_METHODS = PAYMENT_METHODS.filter((m) => m.value !== 'razorpay');

const LENGTH_OPTIONS = [1, 3, 6, 12];

/** ISO → `YYYY-MM-DDTHH:mm` for a datetime-local input. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function toMajor(minor: number | null): string {
  return minor == null ? '' : (minor / 100).toFixed(2);
}

/** Mirrors cyclesBetween in the billing route, for the preview line. */
function cyclesBetween(
  start: Date,
  end: Date,
  interval: 'monthly' | 'yearly'
): number {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    (end.getUTCDate() - start.getUTCDate()) / 30;
  const cycles = interval === 'yearly' ? months / 12 : months;
  return Math.max(1, Math.round(cycles));
}

function formatMoney(major: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/**
 * Assign an account's paid plan, price, and billing period by hand.
 *
 * Saving a plan with a period ACTIVATES it (plan + active status, the
 * paywall opened) and writes the invoice for that period — the same
 * outcome as a Razorpay payment. Before, this form only stored the price
 * and left the account on its trial with no invoice. Writes go through
 * the admin API (service role); an admin isn't a tenant member, so a
 * direct client write would be rejected by RLS.
 */
export function BillingEditor({
  accountId,
  plans,
  billingPlanKey,
  billingAmount,
  billingCurrency,
  billingInterval,
  periodStart,
  periodEnd,
}: {
  accountId: string;
  plans: BillingPlan[];
  billingPlanKey: string | null;
  billingAmount: number | null;
  billingCurrency: string;
  billingInterval: 'monthly' | 'yearly' | null;
  periodStart: string | null;
  periodEnd: string | null;
}) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState(billingPlanKey ?? NONE);
  const [amount, setAmount] = useState(toMajor(billingAmount));
  const [currency, setCurrency] = useState(billingCurrency || 'INR');
  const [interval, setInterval] = useState<'monthly' | 'yearly'>(
    billingInterval ?? 'monthly'
  );
  const [start, setStart] = useState(toLocalInput(periodStart));
  const [end, setEnd] = useState(toLocalInput(periodEnd));
  const [length, setLength] = useState(1);
  // No default on purpose. Whether money changed hands is exactly the
  // thing this form must not guess — a wrong default here becomes a
  // wrong invoice.
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const hasPlan = planKey !== NONE;
  const plan = plans.find((p) => p.key === planKey);

  // Selecting a plan pre-fills price/currency/interval from the catalog
  // (still editable — the account can be given a custom price).
  function onPlanChange(key: string) {
    setPlanKey(key);
    const p = plans.find((pl) => pl.key === key);
    if (p) {
      setAmount(toMajor(p.amount));
      setCurrency(p.currency);
      setInterval(p.interval);
    }
  }

  // Fill the period as [now, now + length × interval].
  function fillPeriod() {
    const now = new Date();
    const endDate = new Date(now);
    if (interval === 'yearly') endDate.setFullYear(endDate.getFullYear() + length);
    else endDate.setMonth(endDate.getMonth() + length);
    setStart(toLocalInput(now.toISOString()));
    setEnd(toLocalInput(endDate.toISOString()));
  }

  // What saving will invoice, shown before the click rather than
  // discovered after it.
  const preview = (() => {
    if (!hasPlan || !start || !end || !paymentStatus) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) {
      return null;
    }
    const cycles = cyclesBetween(s, e, interval);
    const unit = interval === 'yearly' ? 'year' : 'month';
    const price = Number(amount) || 0;
    const total = paymentStatus === 'complimentary' ? 0 : price * cycles;
    const state =
      paymentStatus === 'due'
        ? 'due'
        : paymentStatus === 'complimentary'
          ? 'complimentary'
          : 'paid';
    return `${plan?.name ?? planKey} plan — ${cycles} ${unit}${
      cycles === 1 ? '' : 's'
    } · ${formatMoney(total, currency)} · ${state}`;
  })();

  async function save() {
    const major = amount.trim() === '' ? null : Number(amount);
    if (major !== null && (!Number.isFinite(major) || major < 0)) {
      toast.error('Enter a valid price');
      return;
    }
    if (hasPlan) {
      if (!start || !end) {
        toast.error('Set the period — a plan is activated for a period');
        return;
      }
      if (new Date(end) <= new Date(start)) {
        toast.error('Period end must be after period start');
        return;
      }
      if (!paymentStatus) {
        toast.error('Choose whether this is paid, due, or complimentary');
        return;
      }
      if (paymentStatus === 'paid' && !paymentMethod) {
        toast.error('Choose how it was paid');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/admin/api/accounts/${accountId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_plan_key: hasPlan ? planKey : null,
          billing_amount: major === null ? null : Math.round(major * 100),
          billing_currency: currency,
          billing_interval: hasPlan ? interval : null,
          current_period_start: start ? new Date(start).toISOString() : null,
          current_period_end: end ? new Date(end).toISOString() : null,
          ...(hasPlan && paymentStatus
            ? {
                payment: {
                  status: paymentStatus,
                  method: paymentStatus === 'paid' ? paymentMethod : undefined,
                  reference:
                    paymentStatus === 'paid' ? reference.trim() : undefined,
                },
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        // The route can activate the plan and still fail the invoice.
        // Refresh so the page shows the part that did land.
        if (data.account) router.refresh();
        return;
      }
      const number: string | undefined = data.invoice?.invoice_number;
      if (number) {
        toast.success(
          data.invoiceExisted
            ? `Billing updated — ${number} already covers this period`
            : `Plan activated — invoice ${number} created`
        );
      } else {
        toast.success('Billing updated');
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <h2 className="text-foreground text-sm font-medium">Billing (manual)</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Assigning a plan activates it for the period and records an invoice,
        the same as an online payment.
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground">Plan</Label>
          <Select value={planKey} onValueChange={(v) => v && onPlanChange(v)}>
            <SelectTrigger className="border-border bg-muted h-10 w-full">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None (trial / free)</SelectItem>
              {plans.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-foreground">Price</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving || !hasPlan}
              placeholder="0.00"
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              disabled={saving || !hasPlan}
              className="border-border bg-muted uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Interval</Label>
            <Select
              value={interval}
              onValueChange={(v) => v && setInterval(v as 'monthly' | 'yearly')}
            >
              <SelectTrigger
                className="border-border bg-muted h-10 w-full"
                disabled={saving || !hasPlan}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="period-start" className="text-foreground">
              Period start
            </Label>
            <Input
              id="period-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={saving}
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-end" className="text-foreground">
              Period end
            </Label>
            <Input
              id="period-end"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={saving}
              className="border-border bg-muted"
            />
          </div>
        </div>

        {hasPlan && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-foreground">Payment</Label>
              <Select
                value={paymentStatus}
                onValueChange={(v) => v && setPaymentStatus(v as PaymentStatus)}
              >
                <SelectTrigger
                  className="border-border bg-muted h-10 w-full"
                  disabled={saving}
                >
                  <SelectValue placeholder="Paid, due or free?" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentStatus === 'paid' && (
              <>
                <div className="space-y-2">
                  <Label className="text-foreground">Paid by</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => v && setPaymentMethod(v)}
                  >
                    <SelectTrigger
                      className="border-border bg-muted h-10 w-full"
                      disabled={saving}
                    >
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-ref" className="text-foreground">
                    Reference
                  </Label>
                  <Input
                    id="payment-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="UTR / txn id (optional)"
                    maxLength={120}
                    disabled={saving}
                    className="border-border bg-muted"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {preview && (
          <p className="text-muted-foreground text-xs">
            On save: activates the plan and invoices{' '}
            <span className="text-foreground">{preview}</span>
          </p>
        )}

        <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save billing
          </Button>
          <Select
            value={String(length)}
            onValueChange={(v) => v && setLength(Number(v))}
          >
            <SelectTrigger
              className="border-border h-9 w-32"
              disabled={saving}
              aria-label="Period length"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTH_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {interval === 'yearly' ? 'year' : 'month'}
                  {n === 1 ? '' : 's'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={fillPeriod}
            disabled={saving}
            className="border-border text-foreground"
          >
            <CalendarClock className="size-4" />
            Set period from now
          </Button>
        </div>
      </div>
    </div>
  );
}
