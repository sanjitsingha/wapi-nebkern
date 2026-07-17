'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CalendarClock } from 'lucide-react';

import type { SubscriptionStatus } from '@/lib/billing/subscription';
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

const STATUS_OPTIONS: SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
];

/** Local `Date` → `YYYY-MM-DDTHH:mm` for a datetime-local input. */
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

/**
 * Edit an account's subscription. Writes go through the admin API
 * (service role), never the browser Supabase client — an admin isn't a
 * member of the tenant account, so RLS would (correctly) reject a direct
 * write.
 */
export function SubscriptionEditor({
  accountId,
  plan: initialPlan,
  status: initialStatus,
  trialEndsAt,
  trialDaysLeft,
}: {
  accountId: string;
  plan: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [status, setStatus] = useState<SubscriptionStatus>(initialStatus);
  const [trial, setTrial] = useState<string>(toLocalInput(trialEndsAt));
  const [saving, setSaving] = useState(false);

  async function post(payload: Record<string, unknown>, successMsg: string) {
    setSaving(true);
    try {
      const res = await fetch(`/admin/api/accounts/${accountId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Update failed');
        return;
      }
      toast.success(successMsg);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const save = () =>
    post(
      {
        plan,
        subscription_status: status,
        trial_ends_at: trial ? new Date(trial).toISOString() : null,
      },
      'Subscription updated',
    );

  const extendTrial = () => {
    // Extend from the later of "now" and the current end, so an already-
    // expired trial jumps forward from today.
    const base = Math.max(
      Date.now(),
      trialEndsAt ? Date.parse(trialEndsAt) || Date.now() : Date.now(),
    );
    const next = new Date(base + 14 * 24 * 60 * 60 * 1000).toISOString();
    post(
      { subscription_status: 'trialing', trial_ends_at: next },
      'Trial extended 14 days',
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">Subscription</h2>
      {trialDaysLeft !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left in trial.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="plan" className="text-foreground">
              Plan
            </Label>
            <Input
              id="plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              disabled={saving}
              className="border-border bg-muted text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => v && setStatus(v as SubscriptionStatus)}
            >
              <SelectTrigger className="h-10 w-full border-border bg-muted">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="trial-ends" className="text-foreground">
            Trial ends
          </Label>
          <Input
            id="trial-ends"
            type="datetime-local"
            value={trial}
            onChange={(e) => setTrial(e.target.value)}
            disabled={saving}
            className="border-border bg-muted text-foreground"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={extendTrial}
            disabled={saving}
            className="border-border text-foreground"
          >
            <CalendarClock className="size-4" />
            Extend trial 14d
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => post({ subscription_status: 'active' }, 'Marked active')}
            disabled={saving}
            className="border-border text-foreground"
          >
            Mark active
          </Button>
        </div>
      </div>
    </div>
  );
}
