'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  Send,
  Eye,
  Copy,
  Webhook as WebhookIcon,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WEBHOOK_EVENTS } from '@/lib/webhooks/events';

interface Endpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface Delivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  response_status: number | null;
  error: string | null;
  created_at: string;
}

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  WEBHOOK_EVENTS.map((e) => [e.type, e.label]),
);

export function WebhooksPanel() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [epRes, dRes] = await Promise.all([
      fetch('/api/webhooks', { cache: 'no-store' }),
      fetch('/api/webhooks/deliveries', { cache: 'no-store' }),
    ]);
    const ep = await epRes.json().catch(() => ({}));
    const d = await dRes.json().catch(() => ({}));
    setEndpoints(ep.endpoints ?? []);
    setDeliveries(d.deliveries ?? []);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function toggle(ep: Endpoint) {
    setBusyId(ep.id);
    try {
      const res = await fetch(`/api/webhooks/${ep.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !ep.is_active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Update failed');
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(ep: Endpoint) {
    if (!confirm(`Delete webhook "${ep.name}"?`)) return;
    setBusyId(ep.id);
    try {
      const res = await fetch(`/api/webhooks/${ep.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Delete failed');
        return;
      }
      toast.success('Webhook deleted');
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function sendTest(ep: Endpoint) {
    setBusyId(ep.id);
    try {
      const res = await fetch(`/api/webhooks/${ep.id}/test`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (data.ok) toast.success(`Test delivered (HTTP ${data.status})`);
      else toast.error(`Test failed: ${data.error ?? 'no response'}`);
    } finally {
      setBusyId(null);
    }
  }

  async function revealSecret(ep: Endpoint) {
    const res = await fetch(`/api/webhooks/${ep.id}/secret`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? 'Could not reveal secret');
      return;
    }
    await navigator.clipboard.writeText(data.secret).catch(() => {});
    toast.success('Signing secret copied to clipboard');
  }

  if (loading) {
    return (
      <div className="border-border bg-card flex h-48 items-center justify-center rounded-xl border">
        <Loader2 className="text-primary h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-full p-2">
              <WebhookIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-foreground text-lg font-semibold">Webhooks</h2>
              <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                Get a signed HTTP callback when things happen in your workspace —
                connect Zapier, Make, n8n, or your own backend. Each request is
                signed with the endpoint&apos;s secret (header{' '}
                <code className="text-xs">X-Wacrm-Signature: sha256=…</code>).
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            Add endpoint
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {endpoints.length === 0 ? (
            <div className="border-border rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-sm">
                No endpoints yet. Add one to start receiving events.
              </p>
            </div>
          ) : (
            endpoints.map((ep) => {
              const busy = busyId === ep.id;
              return (
                <div
                  key={ep.id}
                  className="border-border rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-foreground truncate text-sm font-semibold">
                          {ep.name}
                        </p>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            ep.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {ep.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {ep.url}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ep.events.map((e) => (
                          <span
                            key={e}
                            className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]"
                          >
                            {EVENT_LABEL[e] ?? e}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={ep.is_active}
                        onCheckedChange={() => toggle(ep)}
                        disabled={busy}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => sendTest(ep)}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revealSecret(ep)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Copy secret
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => remove(ep)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Delivery log */}
      <Card className="p-6">
        <h3 className="text-foreground text-sm font-semibold">Recent deliveries</h3>
        {deliveries.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">No deliveries yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <DeliveryIcon status={d.status} />
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm">{d.event_type}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(d.created_at).toLocaleString()}
                      {d.attempts > 1 ? ` · ${d.attempts} attempts` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {d.status === 'failed'
                    ? (d.error ?? 'failed')
                    : d.response_status
                      ? `HTTP ${d.response_status}`
                      : d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </div>
  );
}

function DeliveryIcon({ status }: { status: Delivery['status'] }) {
  if (status === 'success')
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === 'failed')
    return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
  return <Clock className="text-muted-foreground h-4 w-4 shrink-0" />;
}

function CreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  function reset() {
    setName('');
    setUrl('');
    setEvents([]);
    setSecret(null);
  }

  function toggleEvent(type: string) {
    setEvents((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function create() {
    if (!url.trim()) {
      toast.error('Enter a URL');
      return;
    }
    if (events.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, url: url.trim(), events }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create');
        return;
      }
      await onCreated();
      setSecret(data.secret ?? null); // show the secret once
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
          <DialogTitle>{secret ? 'Webhook created' : 'Add webhook endpoint'}</DialogTitle>
        </DialogHeader>

        {secret ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Save this signing secret now — it&apos;s shown in full only once
              (you can copy it again later, but keep it safe). Use it to verify
              the <code className="text-xs">X-Wacrm-Signature</code> header.
            </p>
            <div className="border-border flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <code className="min-w-0 flex-1 truncate text-xs">{secret}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(secret);
                  toast.success('Copied');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Zapier hook"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Payload URL (https)</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/…"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-1.5">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label
                    key={ev.type}
                    className="border-border flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(ev.type)}
                      onChange={() => toggleEvent(ev.type)}
                      disabled={saving}
                      className="mt-0.5 size-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block text-sm font-medium">
                        {ev.label}{' '}
                        <code className="text-muted-foreground text-xs font-normal">
                          {ev.type}
                        </code>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {ev.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={create} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
