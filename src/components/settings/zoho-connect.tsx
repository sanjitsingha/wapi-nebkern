'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  CheckCircle2,
  Loader2,
  Zap,
  MessageSquareText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { openOAuthTab } from '@/lib/oauth/tab';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BrandLogo } from '@/components/brand/logo';
import { ConnectHero, IntegrationHeader, SyncArrows } from './integration-visuals';
import { integrationHref, type Integration } from './integrations-catalog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ZohoManage,
  type SyncStatus,
  type ZohoConnection,
  type ZohoSettings,
} from './zoho-manage';
import type { ReactNode } from 'react';

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
// ── Then it syncs, with nothing to set ──
//
// Connecting subscribes a Zoho notification channel (Zoho → Instant)
// and queues everything already in Instant (Instant → Zoho); both run
// from then on, for every lead, contact and deal. There are no
// switches, event pickers or buttons, deliberately — the zoho cron
// renews the channel, retries failures and trims the log. This dialog
// shows only what is in progress (a loading bar) or needs the admin
// (a reconnect). Workflow Rules still work against the webhook URL,
// but the URL is shown only to a Zoho that cannot send events on its
// own — the one case that needs one.
// ============================================================

/** One numbered step. The number is a chip rather than a list marker so
 *  a step can wrap to three lines without its text sliding under the
 *  digit. */
export function GuideStep({ n, children }: { n: number; children: ReactNode }) {
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
export function Permission({
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
  page,
}: {
  /** Render the integration's own page (header, then the connect hero
   *  or — once connected — the management view) instead of the grid
   *  card. */
  page?: Integration;
} = {}) {
  const [status, setStatus] = useState<ZohoConnection | null | undefined>(
    undefined
  );
  // Whether this server has a Zoho application at all. Starts true so
  // the dialog does not flash a "not configured" warning during the
  // first load.
  const [configured, setConfigured] = useState(true);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [settings, setSettings] = useState<ZohoSettings | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Fetch the connection; resolves to it (null when there is none). */
  const load = useCallback(
    (): Promise<ZohoConnection | null> =>
      fetch('/api/integrations/zoho/connect', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const connection: ZohoConnection | null = d?.connection ?? null;
          setStatus(connection);
          setSync(d?.sync ?? null);
          setSettings(d?.settings ?? null);
          setPermissions(d?.permissions ?? []);
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
          setOpen(false);
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
          setOpen(false);
        }
        return;
      }

      if (outcome.params.error) {
        toast.error(outcome.params.error);
        return;
      }
      toast.success(`Connected to ${outcome.params.org ?? 'Zoho CRM'}`, { id: 'zoho-connected' });
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (
      !confirm(
        'Disconnect Zoho? Instant and Zoho will stop syncing.'
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
      setSync(null);
      setSettings(null);
    } finally {
      setBusy(false);
    }
  };

  // Keep the page's loading bar moving: re-read every few seconds while
  // records are still on their way to Zoho.
  const syncing = !!page && connected && (sync?.pending ?? 0) > 0;
  useEffect(() => {
    if (!syncing) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [syncing, load]);

  /** Connecting only: managing a connection happens on the page. */
  const connectDialog = (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      {/* `*:min-w-0` — DialogContent is a CSS grid; without it a wide
          child keeps its min-content width and spills outside the
          modal's background. */}
      <DialogContent className="*:min-w-0 sm:max-w-xl">
        <DialogHeader>
          {/* The title is TEXT beside the mark: the four squares spell
              nothing. alt is empty — the text carries the name. */}
          <DialogTitle className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ZOHO_LOGO} alt="" className="h-5 w-auto object-contain" />
            <span>Connect to Zoho CRM</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Sign in to Zoho and approve access to connect Zoho CRM.
          </DialogDescription>
        </DialogHeader>

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
                  go to Zoho, with their WhatsApp chats saved as notes.
                  Matched by phone, never duplicated, never deleted, and no
                  other module is touched.
                </p>
              </Permission>

              <Permission
                icon={Zap}
                title="Get notified when records change"
              >
                <p>
                  So new and changed leads, contacts and deals reach
                  Instant on their own.
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
                That&apos;s it — Instant and Zoho stay in sync from then
                on, both ways.
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={connect} disabled={busy || !configured}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Connect to Zoho CRM'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // The integration's own page.
  if (page) {
    return (
      <div className="space-y-6">
        <IntegrationHeader
          item={page}
          subtitle={connected ? 'Manage your Zoho CRM connection' : undefined}
        />
        {status === undefined ? (
          <div className="flex justify-center py-16">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : connected && status ? (
          <ZohoManage
            connection={status}
            sync={sync}
            settings={settings}
            permissions={permissions}
            busy={busy}
            onReconnect={() => void connect()}
            onDisconnect={() => void disconnect()}
            onChanged={load}
          />
        ) : (
          <ConnectHero item={page} label="Connect" onConnect={() => setOpen(true)} />
        )}
        {connectDialog}
      </div>
    );
  }

  // The grid card. Managing happens on the page, so a connected card
  // links there instead of opening anything.
  return (
    <>
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
        <h4 className="text-foreground mt-3 text-sm font-semibold">Zoho CRM</h4>
        <p className="text-muted-foreground mt-1 flex-1 text-xs leading-relaxed">
          {connected && status
            ? `${status.orgName ?? 'Your Zoho org'} — synced with Instant.`
            : 'Keep Zoho CRM and Instant in sync, both ways.'}
        </p>

        {connected ? (
          <Link
            href={integrationHref('zoho-crm')}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4 w-full')}
          >
            Manage
          </Link>
        ) : (
          <Button
            type="button"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setOpen(true)}
            disabled={status === undefined}
          >
            {status === undefined ? <Loader2 className="size-4 animate-spin" /> : 'Connect'}
          </Button>
        )}
      </div>
      {connectDialog}
    </>
  );
}
