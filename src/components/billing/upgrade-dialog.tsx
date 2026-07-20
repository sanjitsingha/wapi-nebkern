'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Check, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/billing/plans';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { payForPlan } from './razorpay-checkout';

interface PlanOption {
  key: string;
  name: string;
  tagline: string | null;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  isFeatured: boolean;
}

/**
 * Self-serve upgrade — lists the active plan catalog and takes payment
 * through Razorpay Standard Checkout. On success the plan is already
 * active server-side; `onUpgraded` lets the parent refresh its
 * subscription state.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  currentPlanKey,
  onUpgraded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanKey?: string | null;
  onUpgraded?: () => void;
}) {
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [payingKey, setPayingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || plans !== null) return;
    let cancelled = false;
    fetch('/api/billing/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setPlans(data?.plans ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, plans]);

  const pay = async (plan: PlanOption) => {
    setPayingKey(plan.key);
    try {
      const result = await payForPlan(plan.key);
      if (result === null) return; // user closed the modal — no charge
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
      setPayingKey(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a plan</DialogTitle>
        </DialogHeader>

        {plans === null ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading plans…
          </div>
        ) : plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No plans are available right now — please contact support.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.key === currentPlanKey;
              return (
                <div
                  key={plan.key}
                  className={cn(
                    'flex flex-col rounded-xl border border-border p-4',
                    plan.isFeatured && 'border-primary/40 ring-1 ring-primary/20',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{plan.name}</p>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <BadgeCheck className="size-3" />
                        Current
                      </span>
                    )}
                  </div>
                  {plan.tagline && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {plan.tagline}
                    </p>
                  )}
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight">
                      {formatMoney(plan.amount, plan.currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      /{plan.interval === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs">
                        <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    variant={plan.isFeatured ? 'default' : 'outline'}
                    className="mt-4"
                    disabled={payingKey !== null}
                    onClick={() => pay(plan)}
                  >
                    {payingKey === plan.key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isCurrent ? (
                      'Extend plan'
                    ) : (
                      `Pay ${formatMoney(plan.amount, plan.currency)}`
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Payments are processed securely by Razorpay. Paying for your current
          plan extends the existing period.
        </p>
      </DialogContent>
    </Dialog>
  );
}
