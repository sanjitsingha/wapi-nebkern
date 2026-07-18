'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CalendarClock } from 'lucide-react';

import type { BillingPlan } from '@/lib/billing/plans';
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

/**
 * Assign an account's paid plan, price, and current billing period
 * (manual billing — no provider yet). Writes go through the admin API
 * (service role); an admin isn't a tenant member, so a direct client
 * write would be rejected by RLS.
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
    billingInterval ?? 'monthly',
  );
  const [start, setStart] = useState(toLocalInput(periodStart));
  const [end, setEnd] = useState(toLocalInput(periodEnd));
  const [saving, setSaving] = useState(false);

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

  // Fill the period as [now, now + interval] for the quick-set button.
  function fillPeriod() {
    const now = new Date();
    const endDate = new Date(now);
    if (interval === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);
    setStart(toLocalInput(now.toISOString()));
    setEnd(toLocalInput(endDate.toISOString()));
  }

  async function save() {
    const major = amount.trim() === '' ? null : Number(amount);
    if (major !== null && (!Number.isFinite(major) || major < 0)) {
      toast.error('Enter a valid price');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/admin/api/accounts/${accountId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_plan_key: planKey === NONE ? null : planKey,
          billing_amount: major === null ? null : Math.round(major * 100),
          billing_currency: currency,
          billing_interval: planKey === NONE ? null : interval,
          current_period_start: start ? new Date(start).toISOString() : null,
          current_period_end: end ? new Date(end).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }
      toast.success('Billing updated');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">Billing (manual)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Assign a paid plan, price, and current period. Payments are recorded
        outside the app for now.
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground">Plan</Label>
          <Select value={planKey} onValueChange={(v) => v && onPlanChange(v)}>
            <SelectTrigger className="h-10 w-full border-border bg-muted">
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
              disabled={saving || planKey === NONE}
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
              disabled={saving || planKey === NONE}
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
                className="h-10 w-full border-border bg-muted"
                disabled={saving || planKey === NONE}
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

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save billing
          </Button>
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
