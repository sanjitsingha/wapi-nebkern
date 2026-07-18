'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, ExternalLink, CheckCircle2, Ban, Trash2 } from 'lucide-react';

import { formatMoney } from '@/lib/billing/plans';
import {
  PAYMENT_METHODS,
  paymentMethodLabel,
  type Invoice,
  type InvoiceStatus,
} from '@/lib/billing/invoice';
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
import { fmtDate } from '../_lib/format';

export interface InvoiceDefaults {
  planKey: string | null;
  planName: string | null;
  amount: number | null;
  currency: string;
  interval: 'monthly' | 'yearly' | null;
  periodStart: string | null;
  periodEnd: string | null;
}

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

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  due: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  void: 'bg-muted text-muted-foreground line-through',
};

export function InvoicesManager({
  accountId,
  invoices,
  defaults,
}: {
  accountId: string;
  invoices: Invoice[];
  defaults: InvoiceDefaults;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function invoiceAction(inv: Invoice, body: Record<string, unknown>, msg: string) {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/admin/api/invoices/${inv.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Update failed');
        return;
      }
      toast.success(msg);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function del(inv: Invoice) {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/admin/api/invoices/${inv.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Delete failed');
        return;
      }
      toast.success('Invoice deleted');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">
          Invoices ({invoices.length})
        </h2>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          New invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {invoices.map((inv) => {
            const busy = busyId === inv.id;
            return (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {inv.invoiceNumber ?? 'Invoice'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtDate(inv.issuedAt)} · {inv.description}
                    {inv.status === 'paid' && inv.paymentMethod
                      ? ` · ${paymentMethodLabel(inv.paymentMethod)}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatMoney(inv.amount, inv.currency)}
                  </span>
                  <a
                    href={`/invoices/${inv.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="View invoice"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                  {inv.status === 'due' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => invoiceAction(inv, { status: 'paid' }, 'Marked paid')}
                      className="border-border"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      Mark paid
                    </Button>
                  )}
                  {inv.status !== 'void' && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => invoiceAction(inv, { status: 'void' }, 'Invoice voided')}
                      className="size-8 text-muted-foreground"
                      aria-label="Void invoice"
                    >
                      <Ban className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => del(inv)}
                    className="size-8 text-destructive hover:bg-destructive/10"
                    aria-label="Delete invoice"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NewInvoiceDialog
        accountId={accountId}
        defaults={defaults}
        open={open}
        onOpenChange={setOpen}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

function NewInvoiceDialog({
  accountId,
  defaults,
  open,
  onOpenChange,
  onCreated,
}: {
  accountId: string;
  defaults: InvoiceDefaults;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const planLabel = defaults.planName ?? defaults.planKey ?? '';
  const defaultDescription = planLabel
    ? `${planLabel} plan — ${defaults.interval === 'yearly' ? 'yearly' : 'monthly'}`
    : '';

  const [description, setDescription] = useState(defaultDescription);
  const [amount, setAmount] = useState(
    defaults.amount != null ? (defaults.amount / 100).toFixed(2) : '',
  );
  const [currency, setCurrency] = useState(defaults.currency || 'INR');
  const [status, setStatus] = useState<InvoiceStatus>('paid');
  const [method, setMethod] = useState<string>('bank_transfer');
  const [reference, setReference] = useState('');
  const [periodStart, setPeriodStart] = useState(toLocalInput(defaults.periodStart));
  const [periodEnd, setPeriodEnd] = useState(toLocalInput(defaults.periodEnd));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-seed from the account's billing each time the dialog opens.
  function reset() {
    setDescription(defaultDescription);
    setAmount(defaults.amount != null ? (defaults.amount / 100).toFixed(2) : '');
    setCurrency(defaults.currency || 'INR');
    setStatus('paid');
    setMethod('bank_transfer');
    setReference('');
    setPeriodStart(toLocalInput(defaults.periodStart));
    setPeriodEnd(toLocalInput(defaults.periodEnd));
    setNotes('');
  }

  async function submit() {
    const major = Number(amount);
    if (!description.trim()) {
      toast.error('Enter a description');
      return;
    }
    if (!Number.isFinite(major) || major < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/admin/api/accounts/${accountId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount: Math.round(major * 100),
          currency,
          status,
          plan_key: defaults.planKey ?? undefined,
          payment_method: status === 'paid' ? method : undefined,
          payment_reference: reference.trim() || undefined,
          period_start: periodStart ? new Date(periodStart).toISOString() : undefined,
          period_end: periodEnd ? new Date(periodEnd).toISOString() : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create invoice');
        return;
      }
      toast.success('Invoice created');
      onOpenChange(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pro plan — monthly"
              disabled={saving}
              className="border-border bg-muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={saving}
                className="border-border bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                disabled={saving}
                className="border-border bg-muted uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as InvoiceStatus)}>
                <SelectTrigger className="h-10 w-full border-border bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="due">Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status === 'paid' && (
              <div className="space-y-2">
                <Label className="text-foreground">Method</Label>
                <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                  <SelectTrigger className="h-10 w-full border-border bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {status === 'paid' && (
            <div className="space-y-2">
              <Label className="text-foreground">Payment reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Txn id / UPI ref / cheque no."
                disabled={saving}
                className="border-border bg-muted"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">Period start</Label>
              <Input
                type="datetime-local"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                disabled={saving}
                className="border-border bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Period end</Label>
              <Input
                type="datetime-local"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                disabled={saving}
                className="border-border bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              className="border-border bg-muted"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-border"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
