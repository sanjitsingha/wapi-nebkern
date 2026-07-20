'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Ban,
  Check,
  Copy,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface AdminActivationCode {
  id: string;
  code: string;
  plan_key: string;
  duration_days: number;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  plan: { name: string } | null;
  redemptions: {
    redeemed_at: string;
    account: { name: string } | null;
  }[];
}

interface PlanOption {
  key: string;
  name: string;
  isActive: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ code, now }: { code: AdminActivationCode; now: number }) {
  const expired =
    code.expires_at != null && Date.parse(code.expires_at) <= now;
  const exhausted = code.use_count >= code.max_uses;
  const label = !code.is_active
    ? 'Disabled'
    : expired
      ? 'Expired'
      : exhausted
        ? 'Used up'
        : 'Active';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        label === 'Active'
          ? 'bg-primary-soft text-primary'
          : label === 'Used up'
            ? 'bg-sky-500/10 text-sky-700'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

export function ActivationCodesManager({
  codes,
  plans,
}: {
  codes: AdminActivationCode[];
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Captured once — expiry badges don't need to tick live.
  const [now] = useState(() => Date.now());

  // Create form
  const [planKey, setPlanKey] = useState(plans.find((p) => p.isActive)?.key ?? '');
  const [duration, setDuration] = useState('30');
  const [quantity, setQuantity] = useState('1');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [minted, setMinted] = useState<string[]>([]);

  const copy = async (text: string, what = 'Code') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const create = async () => {
    if (!planKey) {
      toast.error('Pick a plan');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/admin/api/activation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_key: planKey,
          duration_days: parseInt(duration, 10),
          quantity: parseInt(quantity, 10),
          max_uses: parseInt(maxUses, 10),
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          note: note || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? 'Could not generate codes');
        return;
      }
      const created: string[] = (body.codes ?? []).map(
        (c: { code: string }) => c.code,
      );
      setMinted(created);
      toast.success(
        created.length === 1
          ? 'Code generated'
          : `${created.length} codes generated`,
      );
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, payload: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/admin/api/activation-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Update failed');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/admin/api/activation-codes/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Delete failed');
        return;
      }
      toast.success('Code deleted');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const resetDialog = () => {
    setMinted([]);
    setExpiresAt('');
    setNote('');
    setQuantity('1');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            resetDialog();
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Generate codes
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-190 text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Uses</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No codes yet — generate the first batch.
                </td>
              </tr>
            )}
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => copy(c.code)}
                    title="Copy code"
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground hover:text-primary"
                  >
                    {c.code}
                    <Copy className="size-3 opacity-50" />
                  </button>
                  {c.redemptions.length > 0 && (
                    <p className="mt-1 max-w-56 truncate text-[11px] text-muted-foreground">
                      Redeemed by{' '}
                      {c.redemptions
                        .map((r) => r.account?.name ?? 'unknown')
                        .join(', ')}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">{c.plan?.name ?? c.plan_key}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.duration_days} days
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {c.use_count}/{c.max_uses}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {fmtDate(c.expires_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge code={c} now={now} />
                </td>
                <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">
                  {c.note ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {busyId === c.id ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title={c.is_active ? 'Disable code' : 'Re-enable code'}
                          onClick={() => patch(c.id, { is_active: !c.is_active })}
                        >
                          {c.is_active ? (
                            <Ban className="size-4" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                        </Button>
                        {c.use_count === 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Delete unused code"
                            onClick={() => remove(c.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate activation codes</DialogTitle>
          </DialogHeader>

          {minted.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copy these now — they&apos;re also listed in the table.
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
                {minted.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => copy(code)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 font-mono text-xs font-semibold hover:bg-muted"
                  >
                    {code}
                    <Copy className="size-3 opacity-50" />
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => copy(minted.join('\n'), 'All codes')}
                >
                  <Copy className="size-4" />
                  Copy all
                </Button>
                <Button onClick={() => setOpen(false)}>
                  <Check className="size-4" />
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select
                  value={planKey}
                  onValueChange={(v) => setPlanKey(v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.name}
                        {!p.isActive && ' (inactive)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ac-duration">Duration (days)</Label>
                  <Input
                    id="ac-duration"
                    type="number"
                    min={1}
                    max={3650}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-quantity">How many codes</Label>
                  <Input
                    id="ac-quantity"
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-max-uses">Max uses per code</Label>
                  <Input
                    id="ac-max-uses"
                    type="number"
                    min={1}
                    max={10000}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Different accounts only — one account can never redeem the
                    same code twice.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-expires">Redeem before (optional)</Label>
                  <Input
                    id="ac-expires"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ac-note">Note (optional)</Label>
                <Input
                  id="ac-note"
                  placeholder="e.g. Diwali promo, Client X onboarding"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={create} disabled={creating}>
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Generate
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
