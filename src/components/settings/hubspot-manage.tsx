'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  Check,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { LIFECYCLE_STAGES, type LifecycleStage } from '@/lib/hubspot/lifecycle';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingRow } from './zoho-manage';

// ============================================================
// Settings → Integrations → HubSpot, once connected.
//
// The same page as Zoho's: the account with its actions, a few
// settings (all on by default — sync needs no setting up), and the
// permissions granted. A loading bar while records are on their way to
// HubSpot; a prompt only when the admin has to reconnect.
// ============================================================

export const HUBSPOT_MARK = '/images/integrations/hubspot-mark.png';

export interface HubSpotConnection {
  portalId: string | null;
  hubDomain: string | null;
  isActive: boolean;
  connectedAt: string | null;
  lastEventAt: string | null;
  crmUrl: string | null;
}

export interface HubSpotSyncStatus {
  pending: number;
  synced: number;
  needsReconnect: boolean;
}

export interface HubSpotSettings {
  createContacts: boolean;
  lifecycle: LifecycleStage;
  logChats: boolean;
}

export function HubSpotManage({
  connection,
  sync,
  settings: initialSettings,
  permissions,
  busy,
  onReconnect,
  onDisconnect,
  onChanged,
}: {
  connection: HubSpotConnection;
  sync: HubSpotSyncStatus | null;
  settings: HubSpotSettings | null;
  permissions: string[];
  busy: boolean;
  onReconnect: () => void;
  onDisconnect: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [settings, setSettings] = useState<HubSpotSettings | null>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // Follow the server's copy whenever it is re-read.
  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const save = async (patch: Partial<HubSpotSettings>) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    try {
      const res = await fetch('/api/integrations/hubspot/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSettings(previous);
        toast.error(data.error || 'Could not save the setting.');
        return;
      }
      await onChanged();
    } catch {
      setSettings(previous);
      toast.error('Could not save the setting.');
    } finally {
      setSaving(false);
    }
  };

  const resync = async () => {
    setResyncing(true);
    try {
      const res = await fetch('/api/integrations/hubspot/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resync' }),
      });
      if (!res.ok) toast.error('Could not resync with HubSpot.');
      else toast.success('Resyncing with HubSpot');
      await onChanged();
    } catch {
      toast.error('Could not resync with HubSpot.');
    } finally {
      setResyncing(false);
    }
  };

  const progress = sync
    ? Math.max(4, Math.round((sync.synced / Math.max(1, sync.synced + sync.pending)) * 100))
    : 0;

  return (
    <div className="space-y-5">
      {/* ── The account ── */}
      <section className="border-border bg-card rounded-xl border p-5">
        <div className="flex items-start gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HUBSPOT_MARK} alt="" className="mt-0.5 h-5 w-auto shrink-0 object-contain" />
          <div className="min-w-0 text-sm">
            <p className="text-foreground font-semibold">
              Account: {connection.hubDomain ?? 'HubSpot'}
            </p>
            {connection.portalId && (
              <p className="text-muted-foreground mt-0.5">Account ID: {connection.portalId}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void resync()}
            disabled={resyncing || busy}
          >
            <RefreshCw className={cn('size-3.5', resyncing && 'animate-spin')} />
            Resync
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            disabled={busy}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 className="size-3.5" />
            Delete this integration
          </Button>
          {connection.crmUrl && (
            <a
              href={connection.crmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Open HubSpot
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>

        {/* Only what is happening, or what needs the admin. */}
        {sync?.needsReconnect ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <span className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
              <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              Reconnect HubSpot to keep syncing.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 text-xs"
              onClick={onReconnect}
              disabled={busy}
            >
              Reconnect
            </Button>
          </div>
        ) : sync && sync.pending > 0 ? (
          <div className="mt-4 space-y-2">
            <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
              <Loader2 className="size-3.5 animate-spin" />
              Syncing with HubSpot…
            </span>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Additional settings ── */}
      {settings && (
        <section className="border-border bg-card rounded-xl border">
          <header className="border-border flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-foreground text-sm font-semibold">Additional settings</h3>
            <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md">
              <Settings2 className="size-4" />
            </span>
          </header>
          <div className="divide-border divide-y">
            <SettingRow
              title="Create contacts in HubSpot"
              description="New people in Instant are added to HubSpot automatically."
              checked={settings.createContacts}
              disabled={saving}
              onChange={(v) => void save({ createContacts: v })}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">People who message you become</span>
                <Select
                  value={settings.lifecycle}
                  onValueChange={(v) => {
                    const stage = LIFECYCLE_STAGES.find((s) => s.value === v);
                    if (stage) void save({ lifecycle: stage.value });
                  }}
                >
                  <SelectTrigger className="border-border h-8 w-52" disabled={saving}>
                    <SelectValue>
                      {(v: string) => LIFECYCLE_STAGES.find((s) => s.value === v)?.label ?? 'Lead'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LIFECYCLE_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SettingRow>
            <SettingRow
              title="Log chats in HubSpot"
              description="Conversations appear on the person's HubSpot timeline — WhatsApp chats as WhatsApp messages."
              checked={settings.logChats}
              disabled={saving}
              onChange={(v) => void save({ logChats: v })}
            />
          </div>
        </section>
      )}

      {/* ── Granted permissions ── */}
      {permissions.length > 0 && (
        <section className="border-border bg-card rounded-xl border">
          <header className="border-border flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-foreground text-sm font-semibold">Granted permissions</h3>
            <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md">
              <ShieldCheck className="size-4" />
            </span>
          </header>
          <ul className="grid gap-x-6 gap-y-2.5 px-5 py-4 sm:grid-cols-2">
            {permissions.map((p) => (
              <li key={p} className="text-foreground flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
