'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Upload,
  Zap,
  MessageSquareText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { openOAuthTab } from '@/lib/oauth/tab';
import { ZOHO_WATCH_EVENTS } from '@/lib/zoho/watch-events';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BrandLogo } from '@/components/brand/logo';
import { SyncArrows } from './integration-visuals';
import type { ReactNode } from 'react';
import type { ConnectCardArgs } from './integrations-catalog';

// The four-square mark. Note it is the mark ALONE, where the media
// host carries the full lockup with the word ZOHO in it — so anywhere
// this is drawn now needs the name in text beside it.
const ZOHO_LOGO = '/images/integrations/zoho-crm.png';

// ============================================================
// Settings → Integrations → Zoho CRM.
//
// ── Connecting is one click ──
//
// It used to be a form. Each account registered its own Zoho
// server-based application at api-console.zoho.com, pasted a client id
// and secret in here, and picked its data centre from a dropdown,
// because a Zoho client registered on .com is unknown to .in.
//
// All of that is gone. The application belongs to this deployment, and
// Zoho's multi-DC support resolves the data centre by itself — the
// consent flow starts at accounts.zoho.com and Zoho forwards the user
// to their own. What is left is a button.
//
// ── Connecting is still only half the job ──
//
// That part has NOT changed, and this dialog is honest about it. Once
// OAuth is done nothing happens until a Workflow Rule in Zoho is
// pointed at our receiver URL, so the dialog keeps showing setup
// instructions after connecting, where the Shopify and WooCommerce
// cards go quiet.
//
// ── Deferred: automatic webhook setup ──
//
// Competitors create the webhook for you at connect time and offer a
// "Skip automatic two-way sync" checkbox to opt out of it (needed on
// free Zoho editions, which have no webhooks at all). This dialog does
// not, and that is a decision rather than an omission — revisit it
// before adding the checkbox, because the checkbox is the easy half.
//
// The mechanism would be Zoho's Notification API,
// `POST {api_domain}/crm/v5/actions/watch`. Two costs come with it:
//
//   1. A channel expires after SEVEN DAYS at most, and defaults to one
//      hour if channel_expiry is unset. It has to be renewed on a
//      schedule. `npm run cron` exists but nothing has been pinging it
//      since the VPS move — the same reason scheduled campaigns stopped
//      firing. Without that renewal the integration goes dead a week
//      after each customer connects, silently, which is worse than
//      asking them to add one Workflow Rule that never expires.
//
//   2. It needs `ZohoCRM.notifications.ALL` on the consent screen, on
//      top of the single read-only scope asked for today. See
//      ZOHO_SCOPES in lib/zoho/client.ts, which is deliberately as
//      narrow as it is.
//
// Weighed and deferred on 2026-10-10. The blocker is the scheduler,
// not the Zoho side.
// ============================================================

interface ZohoConnection {
  orgName: string | null;
  apiDomain: string;
  isActive: boolean;
  /** Connected under the old per-account-application design. */
  usesOwnApp: boolean;
  connectedAt: string | null;
  lastEventAt: string | null;
  webhookUrl: string | null;
}

interface PushStatus {
  contacts: boolean;
  deals: boolean;
  linkedContacts: number;
  linkedDeals: number;
  pending: number;
  failed: number;
  recent: {
    id: string;
    entity: 'contact' | 'deal';
    name: string;
    status: 'pending' | 'done' | 'failed' | 'skipped';
    message: string;
    at: string;
  }[];
}

interface AutoSync {
  enabled: boolean;
  /** Zoho watch keys, e.g. Leads.create. */
  events: string[];
  /** A channel is subscribed in Zoho right now. */
  active: boolean;
  expiresAt: string | null;
  error: string | null;
}

interface ZohoEvent {
  id: string;
  event_type: string | null;
  module: string | null;
  matched: boolean;
  skip_reason: string | null;
  created_at: string;
}

/** One numbered step. The number is a chip rather than a list marker so
 *  a step can wrap to three lines without its text sliding under the
 *  digit. */
function GuideStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="bg-background border-border text-foreground mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

/**
 * One line of the consent summary: what Zoho is being asked for, and
 * what it actually means in plain words.
 *
 * This exists so the dialog says the same thing Zoho's own consent
 * screen will a moment later. Someone who reads "required" here and
 * then sees a different list at Zoho has every reason to back out.
 */
function Permission({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">
          {title}{' '}
          <span className="text-muted-foreground font-normal">(required)</span>
        </p>
        <div className="text-muted-foreground mt-1 space-y-1 text-xs leading-relaxed">
          {children}
        </div>
      </div>
    </li>
  );
}

export function ZohoConnect({
  renderCard,
}: {
  /** Draw this card instead of the grid card; see ConnectCardArgs. */
  renderCard?: (card: ConnectCardArgs) => ReactNode;
} = {}) {
  const [status, setStatus] = useState<ZohoConnection | null | undefined>(
    undefined
  );
  // Whether this server has a Zoho application at all. Starts true so
  // the dialog does not flash a "not configured" warning during the
  // first load.
  const [configured, setConfigured] = useState(true);
  const [events, setEvents] = useState<ZohoEvent[]>([]);
  const [autoSync, setAutoSync] = useState<AutoSync | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [savingSync, setSavingSync] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Fetch the connection; resolves to it (null when there is none). */
  const load = useCallback(
    (): Promise<ZohoConnection | null> =>
      fetch('/api/integrations/zoho/connect', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const connection: ZohoConnection | null = d?.connection ?? null;
          setStatus(connection);
          setEvents(d?.recentEvents ?? []);
          setAutoSync(d?.autoSync ?? null);
          setPush(d?.push ?? null);
          if (typeof d?.configured === 'boolean') setConfigured(d.configured);
          return connection;
        })
        .catch(() => {
          setStatus(null);
          return null;
        }),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const connected = !!status?.isActive;

  // Safety net for a connect whose outcome message never arrived (the
  // Zoho tab can lose its link to this one — see lib/oauth/tab.ts).
  // While the dialog is open and not yet connected, re-check whenever
  // the admin comes back to this page, and announce the connection if
  // it landed.
  useEffect(() => {
    if (!open || connected) return;
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      void load().then((c) => {
        if (c?.isActive) {
          toast.success(`Connected to ${c.orgName ?? 'Zoho CRM'}`, { id: 'zoho-connected' });
        }
      });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [open, connected, load]);

  /**
   * The whole of connecting: one trip to Zoho and back.
   *
   * No credentials are saved first — the start route owns the row it
   * needs, and the application is this deployment's.
   */
  const connect = async () => {
    setBusy(true);
    try {
      const outcome = await openOAuthTab(
        '/api/integrations/zoho/oauth/start?tab=1',
        { name: 'zoho-oauth' }
      );

      if (outcome.status === 'blocked') {
        toast.error(
          'Your browser blocked the Zoho window. Allow pop-ups and try again.'
        );
        return;
      }
      if (outcome.status === 'cancelled') {
        // "Cancelled" only means no message reached us. The connection
        // may still have been made, so check before staying quiet.
        const c = await load();
        if (c?.isActive) {
          toast.success(`Connected to ${c.orgName ?? 'Zoho CRM'}`, { id: 'zoho-connected' });
        }
        return;
      }

      if (outcome.params.error) {
        toast.error(outcome.params.error);
        return;
      }
      toast.success(`Connected to ${outcome.params.org ?? 'Zoho CRM'}`, { id: 'zoho-connected' });
      if (outcome.params.autosync === 'error') {
        toast.warning(
          'Connected, but automatic sync could not be set up. See the dialog for why.'
        );
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (
      !confirm(
        'Disconnect Zoho? Workflow Rules in Zoho will keep firing at a URL that no longer works.'
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/zoho/connect', {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Could not disconnect.');
        return;
      }
      toast.success('Zoho disconnected');
      setStatus(null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  /** Switch automatic sync or change its events; the server re-syncs
   *  the Zoho channel before answering, so the reload shows the result. */
  const saveSync = async (patch: { enabled?: boolean; events?: string[] }) => {
    if (!autoSync) return;
    setSavingSync(true);
    setAutoSync({ ...autoSync, ...patch });
    try {
      const res = await fetch('/api/integrations/zoho/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        autoSync?: { state: string; error?: string };
      };
      if (!res.ok) toast.error(data.error || 'Could not update automatic sync.');
      else if (data.autoSync?.state === 'error') {
        toast.error(data.autoSync.error || 'Zoho refused automatic sync.');
      }
    } catch {
      toast.error('Could not update automatic sync.');
    } finally {
      await load();
      setSavingSync(false);
    }
  };

  /** Instant → Zoho: a switch, or one of the one-off actions. */
  const savePush = async (
    patch: { pushContacts?: boolean; pushDeals?: boolean; action?: 'backfill' | 'retry' },
  ) => {
    if (patch.action === 'backfill' &&
      !confirm('Send every existing contact and deal to Zoho? People already in Zoho are matched by phone and linked, not duplicated.')) {
      return;
    }
    setPushBusy(true);
    if (push && patch.pushContacts !== undefined) setPush({ ...push, contacts: patch.pushContacts });
    if (push && patch.pushDeals !== undefined) setPush({ ...push, deals: patch.pushDeals });
    try {
      const res = await fetch('/api/integrations/zoho/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; queued?: number };
      if (!res.ok) toast.error(data.error || 'Could not update Zoho sync.');
      else if (patch.action === 'backfill') {
        toast.success(
          `${data.queued ?? 0} records queued. They reach Zoho over the next few minutes.`,
        );
      } else if (patch.action === 'retry') toast.success('Retrying failed records.');
    } catch {
      toast.error('Could not update Zoho sync.');
    } finally {
      await load();
      setPushBusy(false);
    }
  };

  const toggleWatchEvent = (key: string) => {
    if (!autoSync) return;
    const next = autoSync.events.includes(key)
      ? autoSync.events.filter((e) => e !== key)
      : [...autoSync.events, key];
    void saveSync({ events: next });
  };

  const copyUrl = async () => {
    if (!status?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(status.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the URL and copy it manually.');
    }
  };

  return (
    <>
      {/* The integration page draws its own card (a connect hero, or a
          status card) and keeps this component for its dialog and its
          connection state. The grid uses the card below. */}
      {renderCard ? (
        renderCard({
          connected,
          loading: status === undefined,
          open: () => setOpen(true),
        })
      ) : (
        <div className="border-border bg-card hover:border-foreground/20 flex flex-col rounded-xl border p-4 transition-colors">
          <div className="flex items-start justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ZOHO_LOGO}
              alt="Zoho CRM"
              className="h-8 w-auto max-w-[150px] object-contain object-left"
            />
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                Connected
              </span>
            )}
          </div>
          <h4 className="text-foreground mt-3 text-sm font-semibold">
            Zoho CRM
          </h4>
          <p className="text-muted-foreground mt-1 flex-1 text-xs leading-relaxed">
            {connected && status
              ? `${status.orgName ?? 'Your Zoho org'} — CRM events can trigger WhatsApp messages.`
              : 'Let Zoho events send WhatsApp messages — a deal stage change, a new lead, an overdue invoice.'}
          </p>

          <Button
            type="button"
            size="sm"
            variant={connected ? 'outline' : 'default'}
            className="mt-4 w-full"
            onClick={() => setOpen(true)}
          >
            {status === undefined ? (
              <Loader2 className="size-4 animate-spin" />
            ) : connected ? (
              'Manage'
            ) : (
              'Connect'
            )}
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        {/* The connected view carries a long webhook URL, a five-step
            Workflow Rule guide and the recent-events list, which were
            being squeezed at max-w-lg. The pre-connect view is a single
            readable column and is capped narrower from the inside.

            `*:min-w-0` — DialogContent is a CSS grid; without this a
            wide child (the long webhook URL) keeps its min-content
            width and spills outside the modal's background. */}
        <DialogContent
          className={
            connected ? '*:min-w-0 sm:max-w-4xl' : '*:min-w-0 sm:max-w-xl'
          }
        >
          <DialogHeader>
            {/* The title is TEXT. It was the logo alone while ZOHO_LOGO
                was the wordmark, which spelled the name itself; the mark
                that replaced it spells nothing, and a dialog whose
                heading is four coloured squares has no heading.

                alt is empty — the text carries the name, and repeating
                it would have screen readers say it twice. */}
            <DialogTitle className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ZOHO_LOGO}
                alt=""
                className="h-5 w-auto object-contain"
              />
              <span>{connected ? 'Zoho CRM' : 'Connect to Zoho CRM'}</span>
            </DialogTitle>
            {/* Before connecting the description is for screen readers
                only — the dialog body already explains the sign-in. */}
            <DialogDescription className={connected ? undefined : 'sr-only'}>
              {connected
                ? 'Zoho events reach Instant automatically, or through a Workflow Rule you point at the URL below.'
                : 'Sign in to Zoho and approve access to connect Zoho CRM.'}
            </DialogDescription>
          </DialogHeader>

          {connected && status ? (
            <div className="space-y-4">
              <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Organisation</span>
                  <span className="text-foreground font-medium">
                    {status.orgName ?? 'Zoho CRM'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-muted-foreground">Last event</span>
                  <span className="text-foreground">
                    {status.lastEventAt
                      ? new Date(status.lastEventAt).toLocaleString()
                      : 'None yet'}
                  </span>
                </div>
              </div>

              {/* Only ever true for a connection made before the shared
                  application existed. Said plainly because it is a
                  liability those accounts carry and nobody else does:
                  if that Zoho app is deleted in their API console, this
                  connection dies and no amount of reconnecting here
                  fixes it. */}
              {status.usesOwnApp && (
                <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-[11px] leading-relaxed">
                  This connection uses a Zoho application registered in your own
                  API console, from before Instant had a shared one. It keeps
                  working as it is. To hand that over to us instead, disconnect
                  and connect again — you will not be asked for a client ID or a
                  data centre.
                </p>
              )}

              {autoSync && (
                <section className="border-border space-y-3 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-2.5">
                      <Zap className="text-primary mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-foreground text-sm font-medium">
                          Automatic sync
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                          {!autoSync.enabled
                            ? 'Off. Events only arrive through a Workflow Rule you set up below.'
                            : autoSync.active
                              ? `On. Zoho sends the events below to Instant directly — no Workflow Rule needed. Renews automatically${
                                  autoSync.expiresAt
                                    ? ` (current channel until ${new Date(autoSync.expiresAt).toLocaleDateString()})`
                                    : ''
                                }.`
                              : autoSync.events.length === 0
                                ? 'Pick at least one event to start.'
                                : 'Not running yet.'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={autoSync.enabled}
                      disabled={savingSync}
                      onCheckedChange={(v) => void saveSync({ enabled: v })}
                      aria-label="Automatic sync"
                    />
                  </div>

                  {autoSync.enabled && autoSync.error && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                        {autoSync.error}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {/scope|reconnect/i.test(autoSync.error) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={connect}
                              disabled={busy}
                            >
                              Reconnect Zoho
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => void saveSync({})}
                              disabled={savingSync}
                            >
                              <RefreshCw className="mr-1.5 size-3" />
                              Try again
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {autoSync.enabled && (
                    <div>
                      <p className="text-muted-foreground mb-1.5 text-[11px]">
                        Send these to Instant
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ZOHO_WATCH_EVENTS.map((e) => {
                          const on = autoSync.events.includes(e.key);
                          return (
                            <button
                              key={e.key}
                              type="button"
                              disabled={savingSync}
                              aria-pressed={on}
                              onClick={() => toggleWatchEvent(e.key)}
                              className={
                                on
                                  ? 'border-primary/40 bg-primary-soft text-primary rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60'
                                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60'
                              }
                            >
                              {e.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
                        Then build an automation with the{' '}
                        <span className="text-foreground font-medium">
                          Zoho CRM Event
                        </span>{' '}
                        trigger. Updates fire on every edit, so leave them off
                        unless an automation needs them.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {push && (
                <section className="border-border space-y-3 rounded-lg border p-3">
                  <div className="flex gap-2.5">
                    <Upload className="text-primary mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-medium">
                        Send Instant to Zoho
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        Matched by phone, so nobody is created twice. Nothing in
                        Zoho is ever deleted.
                      </p>
                    </div>
                  </div>

                  <div className="divide-border border-border divide-y rounded-md border">
                    <label className="flex items-start justify-between gap-3 p-2.5">
                      <span className="min-w-0">
                        <span className="text-foreground block text-xs font-medium">
                          Contacts and leads
                        </span>
                        <span className="text-muted-foreground block text-[11px] leading-relaxed">
                          New people who message you become Leads. Contacts you
                          add or import become Contacts. Edits keep them in step.
                        </span>
                      </span>
                      <Switch
                        checked={push.contacts}
                        disabled={pushBusy}
                        onCheckedChange={(v) => void savePush({ pushContacts: v })}
                        aria-label="Send contacts and leads to Zoho"
                      />
                    </label>
                    <label className="flex items-start justify-between gap-3 p-2.5">
                      <span className="min-w-0">
                        <span className="text-foreground block text-xs font-medium">
                          Deals
                        </span>
                        <span className="text-muted-foreground block text-[11px] leading-relaxed">
                          New deals, stage moves, won and lost. A deal for a
                          Lead converts it into a Contact in Zoho.
                        </span>
                      </span>
                      <Switch
                        checked={push.deals}
                        disabled={pushBusy}
                        onCheckedChange={(v) => void savePush({ pushDeals: v })}
                        aria-label="Send deals to Zoho"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted-foreground text-[11px]">
                      {push.linkedContacts} contacts · {push.linkedDeals} deals in
                      sync
                      {push.pending > 0 && ` · ${push.pending} waiting`}
                      {push.failed > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {' '}· {push.failed} failed
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      {push.failed > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={pushBusy}
                          onClick={() => void savePush({ action: 'retry' })}
                        >
                          <RefreshCw className="mr-1.5 size-3" />
                          Retry failed
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={pushBusy || (!push.contacts && !push.deals)}
                        onClick={() => void savePush({ action: 'backfill' })}
                      >
                        Sync existing records
                      </Button>
                    </div>
                  </div>

                  {push.recent.some((r) => /scope|permission|OAUTH/i.test(r.message)) && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
                      <span>Zoho needs one more permission to receive deals.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={connect}
                        disabled={busy}
                      >
                        Reconnect Zoho
                      </Button>
                    </div>
                  )}

                  {push.recent.length > 0 && (
                    <ul className="border-border divide-border divide-y overflow-hidden rounded-md border text-[11px]">
                      {push.recent.map((r) => (
                        <li key={r.id} className="flex items-start gap-2 px-2.5 py-1.5">
                          <span
                            className={
                              r.status === 'failed'
                                ? 'mt-1 size-1.5 shrink-0 rounded-full bg-red-500'
                                : r.status === 'pending'
                                  ? 'mt-1 size-1.5 shrink-0 rounded-full bg-amber-500'
                                  : 'mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500'
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-foreground font-medium">{r.name}</span>
                            <span className="text-muted-foreground"> — {r.message}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* Manual setup. Still how custom events (an overdue
                  invoice, a field change on another module) reach us,
                  so it stays — folded away when automatic sync runs. */}
              <details
                className="group space-y-1.5"
                open={!autoSync?.enabled || !autoSync?.active}
              >
                <summary className="text-foreground cursor-pointer list-none text-xs font-medium">
                  <span className="text-muted-foreground mr-1 inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>
                  {autoSync?.enabled && autoSync?.active
                    ? 'Custom events with a Workflow Rule (optional)'
                    : 'Set up with a Workflow Rule'}
                </summary>
              <div className="mt-2 space-y-1.5">
                <Label className="text-foreground text-xs">
                  Webhook URL for your Zoho Workflow Rules
                </Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted/50 border-border min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-[11px]">
                    {status.webhookUrl ?? '—'}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyUrl}
                    aria-label="Copy webhook URL"
                    className="size-9 shrink-0"
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
                <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-[11px] leading-relaxed">
                  <li>
                    In Zoho: Setup → Automation →{' '}
                    <span className="text-foreground font-medium">
                      Workflow Rules
                    </span>{' '}
                    → Create Rule.
                  </li>
                  <li>
                    Pick the module and when it fires — e.g. Deals, on a Stage
                    change.
                  </li>
                  <li>
                    Add an instant action →{' '}
                    <span className="text-foreground font-medium">Webhook</span>{' '}
                    → paste this URL, method POST.
                  </li>
                  <li>
                    Set{' '}
                    <span className="text-foreground font-medium">Body</span> →
                    Raw (JSON) and include at least the phone — e.g.{' '}
                    <code className="text-foreground">
                      {'{ "phone": "${Leads.Phone}" }'}
                    </code>{' '}
                    — inserting fields with Zoho&apos;s picker. Without a phone
                    we cannot tell who to message.
                  </li>
                  <li>
                    Then build an automation here with the{' '}
                    <span className="text-foreground font-medium">
                      Zoho CRM Event
                    </span>{' '}
                    trigger.
                  </li>
                </ol>
              </div>
              </details>

              {events.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs">
                    Recent events
                  </Label>
                  <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border text-[11px]">
                    {events.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                      >
                        <span className="text-foreground truncate">
                          {e.event_type || e.module || 'Event'}
                        </span>
                        <span
                          className={
                            e.matched
                              ? 'shrink-0 text-emerald-600 dark:text-emerald-400'
                              : 'shrink-0 text-amber-600 dark:text-amber-400'
                          }
                        >
                          {e.matched
                            ? 'matched'
                            : e.skip_reason === 'no_phone'
                              ? 'no phone on record'
                              : e.skip_reason === 'deleted'
                                ? 'deleted in Zoho'
                                : 'not matched'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* The two products and the direction data moves. Same
                  lockup the integration page's connect hero uses, so
                  arriving here from there is continuous. */}
              <div className="flex items-center justify-center gap-5 py-6 sm:gap-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-8 items-center">
                    <BrandLogo className="h-6" />
                  </div>
                  <span className="text-foreground text-xs font-medium">
                    Instant
                  </span>
                </div>
                <SyncArrows className="text-muted-foreground/60 h-7 w-20 shrink-0" />
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-8 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ZOHO_LOGO}
                      alt=""
                      className="h-6 w-auto object-contain"
                    />
                  </div>
                  <span className="text-foreground text-xs font-medium">
                    Zoho CRM
                  </span>
                </div>
              </div>

              {/* Flat, not collapsed.

                  This was two accordion panels. It is the wrong control
                  for the content: this is what someone is about to
                  grant a third party against their CRM, and a summary
                  you have to click to open is one most people approve
                  without reading. The cost of showing it is a taller
                  dialog, which is cheap; the cost of hiding it is
                  uninformed consent, which is not.

                  Kept short instead — one sentence per permission,
                  three steps, no second paragraphs. */}
              <section className="border-border space-y-3.5 border-t pt-4">
                <h3 className="text-foreground text-sm font-medium">
                  What this integration can do
                </h3>
                <ul className="space-y-3.5">
                  <Permission
                    icon={ShieldCheck}
                    title="Read and update your leads, contacts and deals"
                  >
                    <p>
                      To keep both sides in step: Zoho events come into
                      Instant, and the people and deals you work on in Instant
                      go to Zoho. Matched by phone, never duplicated, never
                      deleted. Notes can only be added, and no other module is
                      touched.
                    </p>
                  </Permission>

                  <Permission
                    icon={Zap}
                    title="Get notified when records change"
                  >
                    <p>
                      Instant subscribes to the events you choose — new leads
                      and contacts by default — so they arrive without you
                      building a Workflow Rule. You can switch this off.
                    </p>
                  </Permission>

                  <Permission
                    icon={MessageSquareText}
                    title="Send WhatsApp messages when Zoho events fire"
                  >
                    <p>
                      Each event is matched to a contact by phone number and
                      runs your Zoho CRM Event automations.
                    </p>
                  </Permission>
                </ul>
              </section>

              <section className="border-border space-y-3 border-t pt-4">
                <h3 className="text-foreground text-sm font-medium">
                  How it works
                </h3>
                <ol className="text-muted-foreground space-y-2.5 text-xs leading-relaxed">
                  <GuideStep n={1}>
                    Press{' '}
                    <span className="text-foreground font-medium">
                      Connect to Zoho CRM
                    </span>{' '}
                    below. Zoho opens in a new window.
                  </GuideStep>
                  <GuideStep n={2}>
                    Sign in and approve the access above. No client ID, no
                    secret, no data centre to pick — Zoho knows your region and
                    sends you straight back.
                  </GuideStep>
                  <GuideStep n={3}>
                    Instant sets up sync for you. Choose which events to send,
                    then build an automation with the Zoho CRM Event trigger.
                  </GuideStep>
                </ol>
              </section>

              {/* Nothing to connect THROUGH. Shown instead of letting
                  someone press a button that walks them into a Zoho
                  error page they cannot act on. */}
              {!configured && (
                <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                    Zoho is not configured on this server yet. An administrator
                    needs to register the Instant application at{' '}
                    <a
                      href="https://api-console.zoho.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline underline-offset-2"
                    >
                      api-console.zoho.com
                    </a>{' '}
                    and set <code className="font-mono">ZOHO_CLIENT_ID</code>{' '}
                    and <code className="font-mono">ZOHO_CLIENT_SECRET</code>.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter
            className={connected ? 'sm:justify-between' : undefined}
          >
            {connected ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={disconnect}
                  disabled={busy}
                  className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                >
                  Disconnect
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={connect}
                  disabled={busy || !configured}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Connect to Zoho CRM'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
