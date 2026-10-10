'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, ArrowUpRight, Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BrandLogo } from '@/components/brand/logo';
import { openOAuthTab } from '@/lib/oauth/tab';
import { ConnectHero, SyncArrows, ToolMark } from './integration-visuals';
import type { Integration } from './integrations-catalog';

// ============================================================
// Google Sheets on its integration page.
//
//   not connected  → the connect hero; "Connect" opens the Authorize
//                    dialog, which sends the admin to Google in a tab
//   connected, no sheet → "Add new sheet" creates one in their Drive
//   connected with a sheet → which sheet, what gets written (toggles),
//                    the last error if writing has started failing
//
// New sheets only, by design: the drive.file scope reaches only files
// Instant created, which is what spares the connection Google's review.
// ============================================================

interface Connection {
  googleEmail: string | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle: string | null;
  syncContacts: boolean;
  syncDeals: boolean;
  syncCampaigns: boolean;
  isActive: boolean;
  lastWrittenAt: string | null;
  lastError: string | null;
}

type SyncKey = 'syncContacts' | 'syncDeals' | 'syncCampaigns';

const SYNC_OPTIONS: { key: SyncKey; label: string; hint: string }[] = [
  {
    key: 'syncContacts',
    label: 'New contacts',
    hint: 'A row on the Contacts tab for every contact added, within a minute or so.',
  },
  {
    key: 'syncDeals',
    label: 'Deal changes',
    hint: 'A row on the Deals tab each time a deal moves to another stage.',
  },
  {
    key: 'syncCampaigns',
    label: 'Campaign results',
    hint: 'A row per recipient on the Campaigns tab, a day after a campaign finishes sending, once reads and replies are in.',
  },
];

export function GoogleSheetsConnect({ item }: { item: Integration }) {
  const [connection, setConnection] = useState<Connection | null | undefined>(undefined);
  const [configured, setConfigured] = useState(true);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(() => {
    fetch('/api/integrations/google-sheets/connect', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setConfigured(d?.configured !== false);
        setConnection(d?.connection ?? null);
      })
      .catch(() => setConnection(null));
  }, []);

  useEffect(load, [load]);

  async function authorize() {
    setAuthorizing(true);
    try {
      const outcome = await openOAuthTab('/api/integrations/google-sheets/oauth/start?tab=1', {
        name: 'gsheets-oauth',
      });
      if (outcome.status === 'blocked') {
        toast.error('Your browser blocked the Google window. Allow pop-ups and try again.');
        return;
      }
      if (outcome.status === 'cancelled') return;
      if (outcome.params.error) {
        toast.error(outcome.params.error);
        return;
      }
      toast.success(`Connected to Google as ${outcome.params.email ?? 'your account'}`);
      setAuthorizeOpen(false);
      load();
    } finally {
      setAuthorizing(false);
    }
  }

  async function addSheet() {
    if (
      connection?.spreadsheetId &&
      !window.confirm(
        'Start writing to a new spreadsheet? The current one stays in your Google Drive, but nothing new will be added to it.',
      )
    ) {
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/integrations/google-sheets/spreadsheet', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? `Could not create the sheet (HTTP ${res.status})`);
        if (body?.code === 'revoked') load();
        return;
      }
      toast.success('Spreadsheet created in your Google Drive');
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggle(key: SyncKey, value: boolean) {
    setConnection((c) => (c ? { ...c, [key]: value } : c));
    const res = await fetch('/api/integrations/google-sheets/connect', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) {
      toast.error('Could not save that change');
      setConnection((c) => (c ? { ...c, [key]: !value } : c));
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        'Disconnect Google Sheets? Instant stops writing to the sheet. The spreadsheet itself stays in your Google Drive.',
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/google-sheets/connect', { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Could not disconnect');
        return;
      }
      toast.success('Google Sheets disconnected');
      load();
    } finally {
      setDisconnecting(false);
    }
  }

  const authorizeDialog = (
    <Dialog open={authorizeOpen} onOpenChange={(v) => !authorizing && setAuthorizeOpen(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Authorize Google Sheets</DialogTitle>
          <DialogDescription className="sr-only">
            Sign in with Google to let Instant create and write to a spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Instant creates a new spreadsheet in the Google Drive of the account
            you authorize. Sign in with the Google account you want it in.
          </span>
        </div>

        <div className="flex items-center justify-center gap-6 py-4">
          <BrandLogo className="h-6" />
          <SyncArrows className="h-7 w-20 shrink-0 text-muted-foreground/60" />
          <div className="flex flex-col items-center gap-1.5">
            <ToolMark item={item} size="sm" />
            <span className="text-sm text-foreground">{item.name}</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          You&rsquo;ll go to Google&rsquo;s sign-in page in a new tab. After you
          grant access you&rsquo;ll come back here to add your sheet. Instant can
          only open spreadsheets it creates itself.
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setAuthorizeOpen(false)}
            disabled={authorizing}
          >
            Cancel
          </Button>
          <Button onClick={authorize} disabled={authorizing}>
            {authorizing && <Loader2 className="size-4 animate-spin" />}
            Authorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Not connected — or the grant has been revoked, which needs the same
  // round trip again.
  if (!connection || !connection.isActive) {
    return (
      <>
        {connection && connection.lastError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{connection.lastError}</span>
          </div>
        )}
        <ConnectHero
          item={item}
          label={connection ? 'Reconnect' : 'Connect'}
          onConnect={() => setAuthorizeOpen(true)}
          loading={connection === undefined}
          disabled={!configured}
          note={
            configured
              ? undefined
              : 'Google Sheets is not set up on this server yet: it needs GOOGLE_CLIENT_SECRET.'
          }
        />
        {authorizeDialog}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
        <ToolMark item={item} size="sm" />
        <div className="min-w-0 flex-1">
          {connection.spreadsheetId ? (
            <a
              href={connection.spreadsheetUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:underline"
            >
              {connection.spreadsheetTitle ?? 'Your spreadsheet'}
              <ArrowUpRight className="size-3.5" />
            </a>
          ) : (
            <p className="text-sm font-semibold text-foreground">No spreadsheet yet</p>
          )}
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connected as {connection.googleEmail ?? 'your Google account'}
            {connection.lastWrittenAt &&
              ` · last written ${new Date(connection.lastWrittenAt).toLocaleString()}`}
          </p>
        </div>
        <Button onClick={addSheet} disabled={creating} className="h-9 px-4">
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {connection.spreadsheetId ? 'New sheet' : 'Add new sheet'}
        </Button>
      </div>

      {connection.lastError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{connection.lastError}</span>
        </div>
      )}

      {connection.spreadsheetId ? (
        <div className="rounded-xl border border-border bg-card">
          <p className="border-b border-border px-5 py-3 text-sm font-medium text-foreground">
            What Instant writes to the sheet
          </p>
          <ul className="divide-y divide-border">
            {SYNC_OPTIONS.map((o) => (
              <li key={o.key} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{o.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{o.hint}</p>
                </div>
                <Switch
                  checked={connection[o.key]}
                  onCheckedChange={(v) => toggle(o.key, v)}
                  aria-label={o.label}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a sheet and Instant starts writing new contacts, deal changes and
          campaign results to it.
        </p>
      )}

      <div>
        <Button
          variant="ghost"
          onClick={disconnect}
          disabled={disconnecting}
          className="h-9 px-3 text-red-600 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          {disconnecting && <Loader2 className="size-4 animate-spin" />}
          Disconnect Google Sheets
        </Button>
      </div>
    </div>
  );
}
