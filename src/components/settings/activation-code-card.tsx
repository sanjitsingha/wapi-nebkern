'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * Redeem an activation code, which turns a plan on immediately — there
 * is no payment provider in this path.
 *
 * Extracted from <SubscriptionPanel>, which used to sit on Settings →
 * Billing wrapping this card together with a plan summary. The plan
 * summary was a thinner copy of the one on Profile → Plan, so two
 * screens described the same subscription with different levels of
 * detail, on a page whose own name said "Billing". This card is the
 * part that existed nowhere else, so it moved next to the real plan
 * panel and the rest was deleted.
 *
 * `onRedeemed` lets the plan panel beside it refetch, so the new plan
 * appears without a reload.
 */
export function ActivationCodeCard({
  onRedeemed,
}: {
  onRedeemed?: () => void;
}) {
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

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
      const until = body.periodEnd
        ? new Date(body.periodEnd).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : null;
      toast.success(
        until
          ? `${body.planName ?? 'Plan'} activated until ${until}`
          : `${body.planName ?? 'Plan'} activated`,
      );
      setCode('');
      onRedeemed?.();
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <KeyRound className="size-4" />
          <p className="text-xs font-medium">Have an activation code?</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Redeem it to activate its plan instantly. Redeeming another code for
          the same plan extends your current period.
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
          <Button
            onClick={redeem}
            disabled={redeeming}
            className="h-11 border border-white/25 px-5"
          >
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
  );
}
