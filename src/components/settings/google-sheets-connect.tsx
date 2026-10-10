'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Pause,
  Play,
  Trash2,
  UserRound,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BrandLogo } from '@/components/brand/logo';
import { openOAuthTab } from '@/lib/oauth/tab';
import {
  SHEET_EVENT_TYPES,
  eventMeta,
  type SheetEventType,
} from '@/lib/google-sheets/rows';
import { ConnectHero, IntegrationHeader, SyncArrows, ToolMark } from './integration-visuals';
import type { Integration } from './integrations-catalog';

// ============================================================
// Google Sheets on its integration page.
//
//   no Google account yet → the connect hero; Connect → Authorize
//   otherwise → "Connected Google Sheets": a table of every sheet, its
//   one kind of entry, the Google account it writes through, its status,
//   and per-row actions (test row, pause/resume, delete).
//
//   "Add New Sheet" (header) → Step 1: pick an authorised Google account
//   or add another → Step 2: subscribe the sheet to ONE kind of entry →
//   the spreadsheet is created in that account's Drive.
//
// New spreadsheets only, by design: the drive.file scope reaches only
// files Instant created, which is what spares the connection Google's
// app review.
// ============================================================

interface GoogleAccount {
  id: string;
  email: string;
  isActive: boolean;
  lastError: string | null;
  sheetCount: number;
}

interface Sheet {
  id: string;
  email: string | null;
  accountActive: boolean;
  eventType: SheetEventType;
  url: string;
  title: string;
  isActive: boolean;
  lastWrittenAt: string | null;
  lastError: string | null;
}

/** Open Google's consent screen in a tab; resolves to the new account's id. */
async function authorizeGoogle(): Promise<string | null> {
  const outcome = await openOAuthTab('/api/integrations/google-sheets/oauth/start?tab=1', {
    name: 'gsheets-oauth',
  });
  if (outcome.status === 'blocked') {
    toast.error('Your browser blocked the Google window. Allow pop-ups and try again.');
    return null;
  }
  if (outcome.status === 'cancelled') return null;
  if (outcome.params.error) {
    toast.error(outcome.params.error);
    return null;
  }
  toast.success(`Connected ${outcome.params.email ?? 'your Google account'}`);
  return outcome.params.accountId ?? null;
}

function StatusBadge({ sheet }: { sheet: Sheet }) {
  const [label, tone] = !sheet.accountActive
    ? ['Reconnect account', 'bg-amber-500/10 text-amber-700 dark:text-amber-300']
    : !sheet.isActive
      ? ['Paused', 'bg-muted text-muted-foreground']
      : sheet.lastError
        ? ['Error', 'bg-red-500/10 text-red-600 dark:text-red-400']
        : ['Active', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'];
  return (
    <span
      title={sheet.lastError ?? undefined}
      className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', tone)}
    >
      {label}
    </span>
  );
}

export function GoogleSheetsConnect({ item }: { item: Integration }) {
  const [accounts, setAccounts] = useState<GoogleAccount[] | undefined>(undefined);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [configured, setConfigured] = useState(true);

  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // Add-sheet dialog state.
  const [step, setStep] = useState<1 | 2>(1);
  const [chosenAccount, setChosenAccount] = useState<string>('');
  const [justConnected, setJustConnected] = useState(false);
  const [eventType, setEventType] = useState<SheetEventType | ''>('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/google-sheets', { cache: 'no-store' });
      const d = res.ok ? await res.json() : null;
      setConfigured(d?.configured !== false);
      setAccounts(d?.accounts ?? []);
      setSheets(d?.sheets ?? []);
      return (d?.accounts ?? []) as GoogleAccount[];
    } catch {
      setAccounts([]);
      return [];
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeAccounts = (accounts ?? []).filter((a) => a.isActive);

  function openAddSheet(preselect?: string, connected = false) {
    setStep(1);
    setChosenAccount(preselect ?? activeAccounts[0]?.id ?? '');
    setJustConnected(connected);
    setEventType('');
    setTitle('');
    setAddOpen(true);
  }

  /** Header button: straight to the dialog, or to Authorize if there is
   *  no Google account to choose from yet. */
  function onAddNewSheet() {
    if (activeAccounts.length === 0) setAuthorizeOpen(true);
    else openAddSheet();
  }

  async function onAuthorize() {
    setAuthorizing(true);
    try {
      const id = await authorizeGoogle();
      if (!id) return;
      setAuthorizeOpen(false);
      await load();
      openAddSheet(id, true);
    } finally {
      setAuthorizing(false);
    }
  }

  async function onAddAnotherAccount() {
    setAuthorizing(true);
    try {
      const id = await authorizeGoogle();
      if (!id) return;
      await load();
      setChosenAccount(id);
      setJustConnected(true);
    } finally {
      setAuthorizing(false);
    }
  }

  async function onSubscribe() {
    if (!chosenAccount || !eventType) return;
    setCreating(true);
    try {
      const res = await fetch('/api/integrations/google-sheets/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleAccountId: chosenAccount, eventType, title }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? `Could not create the sheet (HTTP ${res.status})`);
        if (body?.code === 'revoked') load();
        return;
      }
      toast.success(`“${body.sheet?.title ?? 'Your sheet'}” created in Google Drive`);
      setAddOpen(false);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function rowAction(sheet: Sheet, action: 'test' | 'toggle' | 'delete') {
    if (
      action === 'delete' &&
      !window.confirm(
        `Stop writing to “${sheet.title}” and remove it from this list? The spreadsheet itself stays in Google Drive.`,
      )
    ) {
      return;
    }
    setBusyRow(sheet.id);
    try {
      const url = `/api/integrations/google-sheets/sheets/${sheet.id}${action === 'test' ? '/test' : ''}`;
      const res = await fetch(url, {
        method: action === 'test' ? 'POST' : action === 'toggle' ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'toggle' ? JSON.stringify({ isActive: !sheet.isActive }) : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? 'That didn’t work. Try again.');
      } else {
        toast.success(
          action === 'test'
            ? 'Test row written — open the sheet to see it'
            : action === 'toggle'
              ? sheet.isActive
                ? 'Sheet paused'
                : 'Sheet resumed'
              : 'Sheet removed',
        );
      }
      load();
    } finally {
      setBusyRow(null);
    }
  }

  async function removeAccount(account: GoogleAccount) {
    const sheetsNote =
      account.sheetCount > 0
        ? ` Its ${account.sheetCount} sheet${account.sheetCount === 1 ? '' : 's'} will stop receiving data and be removed from the list.`
        : '';
    if (!window.confirm(`Remove ${account.email}?${sheetsNote} The spreadsheets stay in Google Drive.`)) {
      return;
    }
    setBusyRow(account.id);
    try {
      const res = await fetch(`/api/integrations/google-sheets/accounts/${account.id}`, { method: 'DELETE' });
      if (!res.ok) toast.error('Could not remove that account');
      else toast.success(`${account.email} removed`);
      load();
    } finally {
      setBusyRow(null);
    }
  }

  const header = (
    <IntegrationHeader
      item={item}
      actions={
        <Button onClick={onAddNewSheet} disabled={!configured || accounts === undefined} className="h-9 px-3">
          Add New Sheet
        </Button>
      }
    />
  );

  // ── Dialogs ─────────────────────────────────────────────────────

  const authorizeDialog = (
    <Dialog open={authorizeOpen} onOpenChange={(v) => !authorizing && setAuthorizeOpen(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Authorize Google Sheets</DialogTitle>
          <DialogDescription className="sr-only">
            Sign in with Google to let Instant create and write to spreadsheets.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Instant creates new spreadsheets in the Google Drive of the account you
            authorize. Sign in with the Google account you want them in.
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
          You&rsquo;ll go to Google&rsquo;s sign-in page in a new tab. After you grant
          access you&rsquo;ll come back here to set up your sheet.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAuthorizeOpen(false)} disabled={authorizing}>
            Cancel
          </Button>
          <Button onClick={onAuthorize} disabled={authorizing}>
            {authorizing && <Loader2 className="size-4 animate-spin" />}
            Authorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const addDialog = (
    <Dialog open={addOpen} onOpenChange={(v) => !creating && !authorizing && setAddOpen(v)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-normal text-muted-foreground">
            Connect Google Sheets — Step {step}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose a Google account, then the kind of entries this sheet receives.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Step 1: Select a Google account or add one
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Email</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddAnotherAccount}
                  disabled={authorizing}
                  className="h-8"
                >
                  {authorizing ? <Loader2 className="size-3.5 animate-spin" /> : <UserRound className="size-3.5" />}
                  Add another account
                </Button>
              </div>
              <Select value={chosenAccount} onValueChange={(v) => setChosenAccount(v ?? '')}>
                <SelectTrigger className="w-full data-[size=default]:h-10">
                  <SelectValue placeholder="Select an account">
                    {(accounts ?? []).find((a) => a.id === chosenAccount)?.email ?? 'Select an account'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id} disabled={!a.isActive}>
                      {a.email}
                      {!a.isActive && ' — reconnect in Manage Accounts'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={() => setStep(2)} disabled={!chosenAccount}>
                Next
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {justConnected && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                Instant connected to your Google account successfully
              </span>
            )}
            <div>
              <h3 className="text-lg font-semibold text-foreground">Step 2: Subscribe to events</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose what Instant writes to this sheet. One kind of entry per sheet —
                add another sheet for anything else.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Event type</Label>
              <div role="radiogroup" className="divide-y divide-border rounded-lg border border-border">
                {SHEET_EVENT_TYPES.map((e) => (
                  <label
                    key={e.type}
                    className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 hover:bg-muted/40"
                  >
                    <input
                      type="radio"
                      name="gsheets-event-type"
                      value={e.type}
                      checked={eventType === e.type}
                      onChange={() => setEventType(e.type)}
                      className="mt-1 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{e.label}</span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">
                        {e.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gsheets-title">Sheet name</Label>
              <Input
                id="gsheets-title"
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                placeholder={eventType ? `Instant — ${eventMeta(eventType).label}` : 'Instant — …'}
                maxLength={100}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={creating}>
                Back
              </Button>
              <Button onClick={onSubscribe} disabled={!eventType || creating}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                Subscribe
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const manageDialog = (
    <Dialog open={manageOpen} onOpenChange={setManageOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Google accounts</DialogTitle>
          <DialogDescription>
            The Google accounts Instant writes through. A sheet stops if its account is
            disconnected or its access is revoked; reconnect it here.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(accounts ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.email}</p>
                <p className="text-xs text-muted-foreground">
                  {a.isActive ? 'Connected' : 'Needs reconnecting'} · {a.sheetCount} sheet
                  {a.sheetCount === 1 ? '' : 's'}
                </p>
                {!a.isActive && a.lastError && (
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{a.lastError}</p>
                )}
              </div>
              {!a.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setAuthorizing(true);
                    try {
                      if (await authorizeGoogle()) load();
                    } finally {
                      setAuthorizing(false);
                    }
                  }}
                  disabled={authorizing}
                >
                  Reconnect
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeAccount(a)}
                disabled={busyRow === a.id}
                className="text-red-600 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={async () => {
              setAuthorizing(true);
              try {
                if (await authorizeGoogle()) load();
              } finally {
                setAuthorizing(false);
              }
            }}
            disabled={authorizing}
          >
            {authorizing ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}
            Add another account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Page ────────────────────────────────────────────────────────

  if (accounts === undefined) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <ConnectHero
          item={item}
          label="Connect"
          onConnect={() => setAuthorizeOpen(true)}
          disabled={!configured}
          note={
            configured
              ? undefined
              : 'Google Sheets is not set up on this server yet: it needs GOOGLE_CLIENT_SECRET.'
          }
        />
        {authorizeDialog}
        {addDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Connected Google Sheets</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Not receiving data?
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} className="h-8">
            Manage Accounts
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Sheet</th>
              <th className="px-4 py-2.5 font-medium">Events</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sheets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No sheets yet. Click <span className="font-medium text-foreground">Add New Sheet</span>{' '}
                  to start receiving data.
                </td>
              </tr>
            ) : (
              sheets.map((s) => (
                <tr key={s.id} className="align-middle">
                  <td className="max-w-[260px] px-4 py-3">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.url}
                      className="inline-flex max-w-full items-center gap-1 text-foreground hover:underline"
                    >
                      <span className="truncate">{s.title}</span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                      {eventMeta(s.eventType).label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge sheet={s} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Send a test row"
                        aria-label="Send a test row"
                        onClick={() => rowAction(s, 'test')}
                        disabled={busyRow === s.id || !s.accountActive}
                      >
                        {busyRow === s.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileCheck2 className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={s.isActive ? 'Pause' : 'Resume'}
                        aria-label={s.isActive ? 'Pause' : 'Resume'}
                        onClick={() => rowAction(s, 'toggle')}
                        disabled={busyRow === s.id}
                      >
                        {s.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove"
                        aria-label="Remove"
                        onClick={() => rowAction(s, 'delete')}
                        disabled={busyRow === s.id}
                        className="text-red-600 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {authorizeDialog}
      {addDialog}
      {manageDialog}
    </div>
  );
}
