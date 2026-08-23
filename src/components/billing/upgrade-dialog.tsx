'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';

import { formatMoney } from '@/lib/billing/plans';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { payForPlan } from './razorpay-checkout';

export interface PlanOption {
  key: string;
  name: string;
  tagline: string | null;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  isFeatured: boolean;
}

function priceLabel(plan: PlanOption): string {
  return `${formatMoney(plan.amount, plan.currency)}/${
    plan.interval === 'yearly' ? 'yr' : 'mo'
  }`;
}

/**
 * Self-serve plan change. The parent decides WHICH plans to offer (only
 * the tiers above the current one for a paid account; every plan for a
 * trial/expired one) and passes them in — this dialog just lets the user
 * pick one from a dropdown and pay for it through Razorpay Standard
 * Checkout. On success the plan is already active server-side, so
 * `onUpgraded` lets the parent refresh.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  plans,
  onUpgraded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plans the user may switch to, cheapest first. */
  plans: PlanOption[];
  onUpgraded?: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // Default the dropdown to the featured plan (else the first offered)
  // each time the dialog opens or the choices change; keep a still-valid
  // prior choice.
  useEffect(() => {
    if (!open) return;
    if (plans.length === 0) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) =>
      prev && plans.some((p) => p.key === prev)
        ? prev
        : (plans.find((p) => p.isFeatured)?.key ?? plans[0].key),
    );
  }, [open, plans]);

  const selected = useMemo(
    () => plans.find((p) => p.key === selectedKey) ?? null,
    [plans, selectedKey],
  );

  const pay = async () => {
    if (!selected) return;
    setPaying(true);
    try {
      const result = await payForPlan(selected.key);
      if (result === null) return; // user closed the Razorpay modal — no charge
      toast.success(
        `${result.planName} plan is active${
          result.periodEnd
            ? ` until ${new Date(result.periodEnd).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}`
            : ''
        }`,
      );
      onOpenChange(false);
      onUpgraded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            Choose a plan and continue to secure payment.
          </DialogDescription>
        </DialogHeader>

        {plans.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No other plans are available right now.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="plan-select"
                className="text-sm font-medium text-foreground"
              >
                Plan
              </label>
              <Select
                value={selectedKey ?? undefined}
                onValueChange={(v) => setSelectedKey(v)}
              >
                <SelectTrigger id="plan-select" className="w-full">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name} — {priceLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {selected.name}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatMoney(selected.amount, selected.currency)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{selected.interval === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </p>
                </div>
                {selected.tagline && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selected.tagline}
                  </p>
                )}
                {selected.features.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {selected.features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs">
                        <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={paying}
          >
            Cancel
          </Button>
          <Button type="button" onClick={pay} disabled={!selected || paying}>
            {paying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : selected ? (
              `Continue — ${formatMoney(selected.amount, selected.currency)}`
            ) : (
              'Continue'
            )}
          </Button>
        </DialogFooter>

        <p className="text-center text-[11px] text-muted-foreground">
          Payments are processed securely by Razorpay.
        </p>
      </DialogContent>
    </Dialog>
  );
}
