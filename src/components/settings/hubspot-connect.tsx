'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  CheckCircle2,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import { openOAuthTab } from '@/lib/oauth/tab';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { GuideStep, Permission } from './zoho-connect';
import {
  HUBSPOT_MARK,
  HubSpotManage,
  type HubSpotConnection,
  type HubSpotSettings,
  type HubSpotSyncStatus,
} from './hubspot-manage';

const HUBSPOT_WORDMARK = '/images/integrations/hubspot.png';

// ============================================================
// Settings → Integrations → HubSpot.
//
// One click, like Zoho: the app is Dripo's, so there is nothing to
// fill in — approve at HubSpot and it syncs both ways from then on,
// with nothing to set. The dialog says what is being granted before
// the admin goes; the page shows the connection once it is made.
// ============================================================

function announce(c: HubSpotConnection | null, name?: string | null) {
  toast.success(`Connected to ${name ?? c?.hubDomain ?? 'HubSpot'}`, { id: 'hubspot-connected' });
}

export function HubSpotConnect({ page }: { page?: Integration } = {}) {
  const [status, setStatus] = useState<HubSpotConnection | null | undefined>(undefined);
  // Starts true so the dialog does not flash "not configured".
  const [configured, setConfigured] = useState(true);
  const [sync, setSync] = useState<HubSpotSyncStatus | null>(null);
  const [settings, setSettings] = useState<HubSpotSettings | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (): Promise<HubSpotConnection | null> =>
      fetch('/api/integrations/hubspot/connect', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const connection: HubSpotConnection | null = d?.connection ?? null;
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
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const connected = !!status?.isActive;

  // Safety net for a connect whose outcome message never arrived (the
  // HubSpot tab can lose its link to this one — see lib/oauth/tab.ts).
  useEffect(() => {
    if (!open || connected) return;
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      void load().then((c) => {
        if (c?.isActive) {
          announce(c);
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

  const connect = async () => {
    setBusy(true);
    try {
      const outcome = await openOAuthTab('/api/integrations/hubspot/oauth/start?tab=1', {
        name: 'hubspot-oauth',
      });
      if (outcome.status === 'blocked') {
        toast.error('Your browser blocked the HubSpot window. Allow pop-ups and try again.');
        return;
      }
      if (outcome.status === 'cancelled') {
        // No message reached us; the connection may still have landed.
        const c = await load();
        if (c?.isActive) {
          announce(c);
          setOpen(false);
        }
        return;
      }
      if (outcome.params.error) {
        toast.error(outcome.params.error);
        return;
      }
      announce(null, outcome.params.org);
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect HubSpot? Dripo and HubSpot will stop syncing.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/hubspot/connect', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Could not disconnect.');
        return;
      }
      toast.success('HubSpot disconnected');
      setStatus(null);
      setSync(null);
      setSettings(null);
    } finally {
      setBusy(false);
    }
  };

  // Keep the loading bar moving while records are on their way.
  const syncing = !!page && connected && (sync?.pending ?? 0) > 0;
  useEffect(() => {
    if (!syncing) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [syncing, load]);

  const connectDialog = (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogContent className="*:min-w-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HUBSPOT_MARK} alt="" className="h-5 w-auto object-contain" />
            <span>Connect to HubSpot</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Sign in to HubSpot and approve access to connect it to Dripo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-center gap-5 py-6 sm:gap-8">
            <div className="flex h-8 items-center">
              <BrandLogo className="h-6" />
            </div>
            <SyncArrows className="text-muted-foreground/60 h-7 w-20 shrink-0" />
            <div className="flex h-8 items-center">
              {/* The wordmark spells the name; dark mode gets the mark
                  and the name in text, since the wordmark is navy. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HUBSPOT_WORDMARK} alt="HubSpot" className="h-6 w-auto object-contain dark:hidden" />
              <span className="hidden items-center gap-2 dark:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={HUBSPOT_MARK} alt="" className="h-6 w-auto object-contain" />
                <span className="text-foreground text-sm font-semibold">HubSpot</span>
              </span>
            </div>
          </div>

          <section className="border-border space-y-3.5 border-t pt-4">
            <h3 className="text-foreground text-sm font-medium">What this integration can do</h3>
            <ul className="space-y-3.5">
              <Permission icon={ShieldCheck} title="Read and update your contacts and deals">
                <p>
                  To keep both sides in step: the people and deals you work on in Dripo go to
                  HubSpot, with their chats on the contact&apos;s timeline. Matched by phone and
                  email, never duplicated, never deleted.
                </p>
              </Permission>
              <Permission icon={Zap} title="Get notified when records change">
                <p>
                  New contacts, lifecycle and lead status changes, new deals and deal stage changes
                  reach Dripo on their own.
                </p>
              </Permission>
              <Permission icon={MessageSquareText} title="Send WhatsApp messages when HubSpot events fire">
                <p>Each event is matched to a contact by phone number and runs your HubSpot Event automations.</p>
              </Permission>
            </ul>
          </section>

          <section className="border-border space-y-3 border-t pt-4">
            <h3 className="text-foreground text-sm font-medium">How it works</h3>
            <ol className="text-muted-foreground space-y-2.5 text-xs leading-relaxed">
              <GuideStep n={1}>
                Press <span className="text-foreground font-medium">Connect to HubSpot</span> below.
                HubSpot opens in a new window.
              </GuideStep>
              <GuideStep n={2}>Sign in, pick your HubSpot account and approve the access above.</GuideStep>
              <GuideStep n={3}>
                That&apos;s it — Dripo and HubSpot stay in sync from then on, both ways.
              </GuideStep>
            </ol>
          </section>

          {!configured && (
            <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                HubSpot is not configured on this server yet. An administrator needs to create the
                Dripo app in a HubSpot developer account and set{' '}
                <code className="font-mono">HUBSPOT_CLIENT_ID</code> and{' '}
                <code className="font-mono">HUBSPOT_CLIENT_SECRET</code>.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={connect} disabled={busy || !configured}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Connect to HubSpot'}
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
          subtitle={connected ? 'Manage your HubSpot connection' : undefined}
        />
        {status === undefined ? (
          <div className="flex justify-center py-16">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : connected && status ? (
          <HubSpotManage
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

  // The grid card. Managing happens on the page.
  return (
    <>
      <div className="border-border bg-card hover:border-foreground/20 flex flex-col rounded-xl border p-4 transition-colors">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HUBSPOT_MARK} alt="HubSpot" className="size-8 object-contain object-left" />
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Connected
            </span>
          )}
        </div>
        <h4 className="text-foreground mt-3 text-sm font-semibold">HubSpot</h4>
        <p className="text-muted-foreground mt-1 flex-1 text-xs leading-relaxed">
          {connected && status
            ? `${status.hubDomain ?? 'Your HubSpot account'} — synced with Dripo.`
            : 'Keep HubSpot and Dripo in sync, both ways.'}
        </p>
        {connected ? (
          <Link
            href={integrationHref('hubspot')}
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
