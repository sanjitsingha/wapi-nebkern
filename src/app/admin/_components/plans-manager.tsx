'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Star } from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FormValues {
  name: string;
  tagline: string;
  description: string;
  features: string; // one per line
  amount: string; // major units
  currency: string;
  interval: 'monthly' | 'yearly';
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: string;
  // Limits & feature gates (migration 062). Blank number = unlimited.
  maxUsers: string;
  maxContacts: string;
  storageMb: string;
  maxAutomations: string;
  maxCampaigns: string;
  maxFlows: string;
  allowCalling: boolean;
  allowInstagram: boolean;
  allowAutomations: boolean;
  allowFlows: boolean;
  allowIntegrations: boolean;
}

/** limits jsonb value → form string ('' = unlimited). */
function limitStr(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

function limitBool(v: unknown): boolean {
  return typeof v === 'boolean' ? v : true;
}

function fromPlan(p: BillingPlan): FormValues {
  const l = p.limits ?? {};
  return {
    name: p.name,
    tagline: p.tagline ?? '',
    description: p.description ?? '',
    features: p.features.join('\n'),
    amount: (p.amount / 100).toFixed(2),
    currency: p.currency,
    interval: p.interval,
    isFeatured: p.isFeatured,
    isActive: p.isActive,
    sortOrder: String(p.sortOrder),
    maxUsers: limitStr(l.max_users),
    maxContacts: limitStr(l.max_contacts),
    storageMb: limitStr(l.storage_mb),
    maxAutomations: limitStr(l.max_automations),
    maxCampaigns: limitStr(l.max_campaigns),
    maxFlows: limitStr(l.max_flows),
    allowCalling: limitBool(l.allow_calling),
    allowInstagram: limitBool(l.allow_instagram),
    allowAutomations: limitBool(l.allow_automations),
    allowFlows: limitBool(l.allow_flows),
    allowIntegrations: limitBool(l.allow_integrations),
  };
}

const EMPTY: FormValues = {
  name: '',
  tagline: '',
  description: '',
  features: '',
  amount: '0',
  currency: 'INR',
  interval: 'monthly',
  isFeatured: false,
  isActive: true,
  sortOrder: '0',
  maxUsers: '',
  maxContacts: '',
  storageMb: '',
  maxAutomations: '',
  maxCampaigns: '',
  maxFlows: '',
  allowCalling: true,
  allowInstagram: true,
  allowAutomations: true,
  allowFlows: true,
  allowIntegrations: true,
};

/** Form limit string → number | null (blank / invalid = unlimited). */
function limitNum(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Form values → API payload (amount to minor units, features to array). */
function buildPayload(v: FormValues) {
  const major = Number(v.amount);
  const order = parseInt(v.sortOrder, 10);
  return {
    name: v.name.trim(),
    tagline: v.tagline.trim() || null,
    description: v.description.trim() || null,
    features: v.features
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    amount: Math.round((Number.isFinite(major) ? major : 0) * 100),
    currency: v.currency.toUpperCase(),
    interval: v.interval,
    is_featured: v.isFeatured,
    is_active: v.isActive,
    sort_order: Number.isFinite(order) ? order : 0,
    limits: {
      max_users: limitNum(v.maxUsers),
      max_contacts: limitNum(v.maxContacts),
      storage_mb: limitNum(v.storageMb),
      max_automations: limitNum(v.maxAutomations),
      max_campaigns: limitNum(v.maxCampaigns),
      max_flows: limitNum(v.maxFlows),
      allow_calling: v.allowCalling,
      allow_instagram: v.allowInstagram,
      allow_automations: v.allowAutomations,
      allow_flows: v.allowFlows,
      allow_integrations: v.allowIntegrations,
    },
  };
}

export function PlansManager({ plans }: { plans: BillingPlan[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setCreating(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          New plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No plans yet. Create your first plan.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      )}

      <CreatePlanDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

/** All the editable fields, shared by the card and the create dialog. */
function PlanFields({
  values,
  set,
  disabled,
}: {
  values: FormValues;
  set: (patch: Partial<FormValues>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-foreground">Name</Label>
        <Input
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          disabled={disabled}
          className="border-border bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">Tagline</Label>
        <Input
          value={values.tagline}
          onChange={(e) => set({ tagline: e.target.value })}
          placeholder="For growing teams"
          disabled={disabled}
          className="border-border bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">Description</Label>
        <Input
          value={values.description}
          onChange={(e) => set({ description: e.target.value })}
          disabled={disabled}
          className="border-border bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">Features (one per line)</Label>
        <textarea
          value={values.features}
          onChange={(e) => set({ features: e.target.value })}
          rows={4}
          placeholder={'Shared team inbox\nUp to 1,000 contacts\nBroadcast campaigns'}
          disabled={disabled}
          className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-foreground">Price</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.amount}
            onChange={(e) => set({ amount: e.target.value })}
            disabled={disabled}
            className="border-border bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Currency</Label>
          <Input
            value={values.currency}
            onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
            maxLength={3}
            disabled={disabled}
            className="border-border bg-muted uppercase"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-foreground">Interval</Label>
          <Select
            value={values.interval}
            onValueChange={(v) => v && set({ interval: v as 'monthly' | 'yearly' })}
          >
            <SelectTrigger className="h-10 w-full border-border bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Sort order</Label>
          <Input
            type="number"
            value={values.sortOrder}
            onChange={(e) => set({ sortOrder: e.target.value })}
            disabled={disabled}
            className="border-border bg-muted"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => set({ isActive: e.target.checked })}
            className="size-3.5 accent-[var(--primary)]"
          />
          Active
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={values.isFeatured}
            onChange={(e) => set({ isFeatured: e.target.checked })}
            className="size-3.5 accent-[var(--primary)]"
          />
          Featured
        </label>
      </div>

      {/* ---- Limits & feature gates (enforced in the tenant app) ---- */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Limits &amp; features
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Users</Label>
            <Input
              type="number"
              min="0"
              value={values.maxUsers}
              onChange={(e) => set({ maxUsers: e.target.value })}
              placeholder="∞"
              disabled={disabled}
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Contacts</Label>
            <Input
              type="number"
              min="0"
              value={values.maxContacts}
              onChange={(e) => set({ maxContacts: e.target.value })}
              placeholder="∞"
              disabled={disabled}
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Storage (MB)</Label>
            <Input
              type="number"
              min="0"
              value={values.storageMb}
              onChange={(e) => set({ storageMb: e.target.value })}
              placeholder="∞"
              disabled={disabled}
              className="border-border bg-muted"
            />
          </div>
        </div>

        {/* How many of each the account may create. Separate from the
            toggles below: the toggle decides whether the builder is
            available at all, this decides how much they get. A toggle
            that's off wins regardless of the number here. */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Automations</Label>
            <Input
              type="number"
              min="0"
              value={values.maxAutomations}
              onChange={(e) => set({ maxAutomations: e.target.value })}
              placeholder="∞"
              disabled={disabled}
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Campaigns</Label>
            <Input
              type="number"
              min="0"
              value={values.maxCampaigns}
              onChange={(e) => set({ maxCampaigns: e.target.value })}
              placeholder="∞"
              disabled={disabled}
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Flows</Label>
            <Input
              type="number"
              min="0"
              value={values.maxFlows}
              onChange={(e) => set({ maxFlows: e.target.value })}
              placeholder="∞"
              disabled={disabled}
              className="border-border bg-muted"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Leave a field blank for unlimited. 0 blocks creation entirely.
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {(
            [
              ['allowCalling', 'WhatsApp calling'],
              ['allowInstagram', 'Instagram DMs'],
              ['allowAutomations', 'Automations'],
              ['allowFlows', 'Flows (chatbots)'],
              ['allowIntegrations', 'API & webhooks'],
            ] as const
          ).map(([field, label]) => (
            <label
              key={field}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <input
                type="checkbox"
                checked={values[field]}
                onChange={(e) => set({ [field]: e.target.checked })}
                disabled={disabled}
                className="size-3.5 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: BillingPlan }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(fromPlan(plan));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (patch: Partial<FormValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  async function save() {
    if (!values.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/admin/api/plans/${plan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(values)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }
      toast.success(`${values.name} updated`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm(`Delete the "${plan.name}" plan? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/admin/api/plans/${plan.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Delete failed');
        return;
      }
      toast.success('Plan deleted');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {plan.isFeatured && <Star className="size-3 text-amber-500" />}
          {plan.key}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={deleting}
          onClick={del}
          className="size-8 text-destructive hover:bg-destructive/10"
          aria-label="Delete plan"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </div>

      <PlanFields values={values} set={set} disabled={saving} />

      <Button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}

function CreatePlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FormValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  function reset() {
    setKey('');
    setValues(EMPTY);
  }

  async function create() {
    if (!/^[a-z0-9-]+$/.test(key.trim())) {
      toast.error('Key must be a slug (lowercase, numbers, hyphens)');
      return;
    }
    if (!values.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/admin/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim().toLowerCase(), ...buildPayload(values) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create plan');
        return;
      }
      toast.success('Plan created');
      onOpenChange(false);
      router.refresh();
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
          <DialogTitle>New plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-foreground">Key (slug — permanent id)</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder="growth"
              disabled={saving}
              className="border-border bg-muted"
            />
          </div>
          <PlanFields values={values} set={set} disabled={saving} />
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
            onClick={create}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Create plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
