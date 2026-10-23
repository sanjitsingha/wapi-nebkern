'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================
// Settings → Integrations → Zoho CRM, once connected.
//
// Modelled on Periskope's page: the account with its actions, a few
// settings (all on by default — sync needs no setting up), and the
// permissions granted. Nothing else: no per-record lines, no event
// lists. A loading bar shows while records are on their way to Zoho,
// and a prompt shows when only the admin can fix something.
// ============================================================

/** The four-square mark — see ZOHO_LOGO in zoho-connect.tsx. */
const ZOHO_LOGO = '/images/integrations/zoho-crm.png';

export interface ZohoConnection {
  orgName: string | null;
  orgId: string | null;
  apiDomain: string;
  isActive: boolean;
  /** Connected under the old per-account-application design. */
  usesOwnApp: boolean;
  connectedAt: string | null;
  lastEventAt: string | null;
  webhookUrl: string | null;
  crmUrl: string | null;
}

/** Sync as the page sees it: only what is happening, or needs action. */
export interface SyncStatus {
  active: boolean;
  /** Records on their way to Zoho, and how many are already there. */
  pending: number;
  synced: number;
  /** Zoho lacks a permission; only reconnecting grants it. */
  needsReconnect: boolean;
  /** Why Zoho cannot send events automatically (e.g. its edition). */
  unavailable: string | null;
}

export interface ZohoSettings {
  createContacts: boolean;
  chatModule: 'Leads' | 'Contacts';
  logChats: boolean;
}

/** One setting: a switch with a one-line description, and anything
 *  that belongs to it underneath while it is on. */
export function SettingRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 px-5 py-4">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={title}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
        {checked && children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}

export function ZohoManage({
  connection,
  sync,
  settings: initialSettings,
  permissions,
  busy,
  onReconnect,
  onDisconnect,
  onChanged,
}: {
  connection: ZohoConnection;
  sync: SyncStatus | null;
  settings: ZohoSettings | null;
  permissions: string[];
  /** Connecting or disconnecting is in progress. */
  busy: boolean;
  onReconnect: () => void;
  onDisconnect: () => void;
  /** Re-read the connection after a change. */
  onChanged: () => Promise<unknown>;
}) {
  const [settings, setSettings] = useState<ZohoSettings | null>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Follow the server's copy whenever it is re-read.
  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const save = async (patch: Partial<ZohoSettings>) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    try {
      const res = await fetch('/api/integrations/zoho/connect', {
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
      const res = await fetch('/api/integrations/zoho/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resync' }),
      });
      if (!res.ok) toast.error('Could not resync with Zoho.');
      else toast.success('Resyncing with Zoho');
      await onChanged();
    } catch {
      toast.error('Could not resync with Zoho.');
    } finally {
      setResyncing(false);
    }
  };

  const copyUrl = async () => {
    if (!connection.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(connection.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the URL and copy it manually.');
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
          <img src={ZOHO_LOGO} alt="" className="mt-0.5 h-5 w-auto shrink-0 object-contain" />
          <div className="min-w-0 text-sm">
            <p className="text-foreground font-semibold">
              Account: {connection.orgName ?? 'Zoho CRM'}
            </p>
            {connection.orgId && (
              <p className="text-muted-foreground mt-0.5">Org ID: {connection.orgId}</p>
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
              Open Zoho CRM
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>

        {/* Only what is happening, or what needs the admin. */}
        {sync?.needsReconnect ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <span className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
              <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              Reconnect Zoho to keep syncing.
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
              Syncing with Zoho…
            </span>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* A Zoho that cannot send events on its own (an edition without
            notifications): a Workflow Rule is then the only way in, and
            the admin needs the URL for it. Nobody else sees this. */}
        {sync?.unavailable && connection.webhookUrl && (
          <div className="mt-4 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              This Zoho can&apos;t send updates to Dripo on its own. In Zoho, add a
              Workflow Rule with a webhook to this URL.
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-background border-border min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-[11px]">
                {connection.webhookUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyUrl}
                aria-label="Copy webhook URL"
                className="size-9 shrink-0"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Only for a connection made before the shared application. */}
        {connection.usesOwnApp && (
          <p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
            Connected through your own Zoho application. Delete and connect again to
            move to Dripo&apos;s.
          </p>
        )}
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
              title="Create contacts and leads in Zoho"
              description="New people in Dripo are added to Zoho automatically."
              checked={settings.createContacts}
              disabled={saving}
              onChange={(v) => void save({ createContacts: v })}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">People who message you become</span>
                <Select
                  value={settings.chatModule}
                  onValueChange={(v) =>
                    (v === 'Leads' || v === 'Contacts') && void save({ chatModule: v })
                  }
                >
                  <SelectTrigger className="border-border h-8 w-32" disabled={saving}>
                    <SelectValue>
                      {(v: string) => (v === 'Contacts' ? 'Contact' : 'Lead')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Leads">Lead</SelectItem>
                    <SelectItem value="Contacts">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </SettingRow>
            <SettingRow
              title="Log WhatsApp chats in Zoho"
              description="Conversations are saved as notes on the person's Lead or Contact."
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
