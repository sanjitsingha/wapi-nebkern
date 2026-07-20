'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, KeyRound, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { SubscriptionState } from '@/lib/billing/subscription';
import { formatMoney } from '@/lib/billing/plans';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UpgradeDialog } from '@/components/billing/upgrade-dialog';

interface BillingInfo {
  planKey: string | null;
  planName: string | null;
  amount: number | null;
  currency: string;
  interval: 'monthly' | 'yearly' | null;
  periodStart: string | null;
  periodEnd: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  expired: 'Expired',
};

/**
 * Current wacrm plan + activation-code redemption. Sits at the top of
 * Settings → Billing, above the Meta usage panel. Owners/admins redeem a
 * code here; the plan activates immediately (no payment provider).
 */
export function SubscriptionPanel() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/subscription');
      if (!res.ok) return;
      const body = await res.json();
      setSub(body.subscription ?? null);
      setBilling(body.billing ?? null);
    } catch {
      // Leave the panel in its previous state on a network hiccup.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error('Enter an activation code');
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch('/api/account/activation-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? 'Could not redeem the code');
        return;
      }
      toast.success(
        `${body.planName ?? 'Plan'} activated until ${fmtDate(body.periodEnd)}`,
      );
      setCode('');
      load();
    } finally {
      setRedeeming(false);
    }
  };

  const planLabel =
    billing?.planName ??
    billing?.planKey ??
    (sub ? (sub.plan === 'trial' ? 'Free trial' : sub.plan) : null);

  return (
    <div className="mb-6 space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  sub?.hasAccess
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {sub?.isTrial ? (
                  <Sparkles className="size-4" />
                ) : (
                  <BadgeCheck className="size-4" />
                )}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {planLabel ? `Plan: ${planLabel}` : 'Loading your plan…'}
                  {sub && (
                    <span
                      className={cn(
                        'ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        sub.hasAccess
                          ? 'bg-primary-soft text-primary'
                          : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {STATUS_LABEL[sub.status] ?? sub.status}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {sub?.isTrial
                    ? sub.trialDaysLeft > 0
                      ? `${sub.trialDaysLeft} day${sub.trialDaysLeft === 1 ? '' : 's'} left in your trial`
                      : 'Your trial ends today'
                    : billing?.periodEnd
                      ? `Current period ends ${fmtDate(billing.periodEnd)}`
                      : 'No paid plan assigned yet'}
                  {billing?.amount != null && billing.interval && (
                    <>
                      {' · '}
                      {formatMoney(billing.amount, billing.currency)}/
                      {billing.interval === 'yearly' ? 'yr' : 'mo'}
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={sub?.hasAccess && billing?.planKey ? 'outline' : 'default'}
              onClick={() => setUpgradeOpen(true)}
              className="shrink-0"
            >
              {sub?.hasAccess && billing?.planKey ? 'Change plan' : 'Upgrade'}
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlanKey={billing?.planKey}
        onUpgraded={load}
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <KeyRound className="size-4" />
            <p className="text-xs font-medium">Have an activation code?</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Redeem it to activate its plan instantly. Redeeming another code
            for the same plan extends your current period.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WAPI-XXXX-XXXX-XXXX"
              maxLength={40}
              className="font-mono sm:max-w-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') redeem();
              }}
            />
            <Button onClick={redeem} disabled={redeeming}>
              {redeeming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Redeem
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
