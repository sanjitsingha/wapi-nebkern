'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, CheckCircle2, Copy, Loader2 } from 'lucide-react';

import { openOAuthTab } from '@/lib/oauth/tab';
import { ZOHO_REGIONS } from '@/lib/zoho/client';
import { Button } from '@/components/ui/button';
import { InfoHint } from '@/components/ui/info-hint';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ZOHO_LOGO = 'https://media.instant.nebkern.com/assets/zoho-crm-logo.svg';

// ============================================================
// Settings → Integrations → Zoho CRM.
//
// Connecting is only half the job here, and the smaller half. Once the
// OAuth handshake is done nothing happens until the admin creates a
// Workflow Rule in Zoho pointed at our receiver URL — so this card's
// real work is showing that URL and saying what to do with it.
//
// That is why it keeps showing setup instructions after connecting,
// where the Shopify and WooCommerce cards go quiet.
// ============================================================

interface ZohoConnection {
  orgName: string | null;
  apiDomain: string;
  isActive: boolean;
  /** Credentials saved, OAuth not yet completed. */
  hasCredentials: boolean;
  connectedAt: string | null;
  lastEventAt: string | null;
  webhookUrl: string | null;
}

interface ZohoEvent {
  id: string;
  event_type: string | null;
  module: string | null;
  matched: boolean;
  skip_reason: string | null;
  created_at: string;
}

/** One numbered step in the right-hand guide. The number is a chip
 *  rather than a list marker so a step can wrap to three lines without
 *  its text sliding under the digit. */
function GuideStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="bg-background border-border text-foreground mt-px flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

export function ZohoConnect() {
  const [status, setStatus] = useState<ZohoConnection | null | undefined>(
    undefined,
  );
  const [events, setEvents] = useState<ZohoEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState('in');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Shown so the admin can paste it into the Zoho console. Read off the
  // browser rather than an env var: it has to be the origin they are
  // actually on, which differs between a tunnel, staging and
  // production, and a mismatch is the single most common way this
  // handshake fails.
  const redirectUri =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/api/integrations/zoho/oauth/callback`;

  const load = useCallback(() => {
    fetch('/api/integrations/zoho/connect', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setStatus(d?.connection ?? null);
        setEvents(d?.recentEvents ?? []);
      })
      .catch(() => setStatus(null));
  }, []);

  useEffect(load, [load]);

  /**
   * Two steps, in one click.
   *
   * The credentials are saved first, then the OAuth tab opens — the
   * start route reads the client id off the stored row rather than a
   * query parameter, so a secret never travels in a URL that ends up in
   * a browser history or a server log.
   */
  const connect = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error('Enter the client ID and client secret from Zoho.');
      return;
    }
    setBusy(true);
    try {
      const save = await fetch('/api/integrations/zoho/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          region,
        }),
      });
      const saved = await save.json().catch(() => ({}));
      if (!save.ok) {
        toast.error(saved.error || 'Could not save the credentials.');
        return;
      }
      // Not kept in component state a moment longer than needed.
      setClientSecret('');

      const outcome = await openOAuthTab(
        '/api/integrations/zoho/oauth/start?tab=1',
        { name: 'zoho-oauth' },
      );

      if (outcome.status === 'blocked') {
        toast.error(
          'Your browser blocked the Zoho window. Allow pop-ups and try again.',
        );
        return;
      }
      if (outcome.status === 'cancelled') return;

      if (outcome.params.error) {
        toast.error(outcome.params.error);
        return;
      }
      toast.success(`Connected to ${outcome.params.org ?? 'Zoho CRM'}`);
      setOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (
      !confirm(
        'Disconnect Zoho? Workflow Rules in Zoho will keep firing at a URL that no longer works.',
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

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 2000);
    } catch {
      toast.error('Could not copy — select the URL and copy it manually.');
    }
  };

  const connected = !!status?.isActive;

  return (
    <>
      <div className="border-border bg-card hover:border-foreground/20 flex flex-col rounded-xl border p-4 transition-colors">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ZOHO_LOGO}
            alt="Zoho CRM"
            className="h-11 w-auto max-w-[150px] object-contain object-left"
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

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        {/* Both views earn the width. The setup form is two columns;
            the connected view carries a long webhook URL, a five-step
            Workflow Rule guide and the recent-events list, all of which
            were being squeezed at max-w-lg. */}
        {/* `*:min-w-0` — DialogContent is a CSS grid; without this a wide
            child (the long webhook URL) keeps its min-content width and
            spills outside the modal's background. */}
        <DialogContent className="sm:max-w-4xl *:min-w-0">
          <DialogHeader>
            {/* Logo-only — the SVG already spells out "Zoho CRM", so a
                text title beside it would just repeat the wordmark. alt
                carries the accessible name for the dialog title. */}
            <DialogTitle className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ZOHO_LOGO} alt="Zoho CRM" className="h-10 w-auto object-contain" />
              <InfoHint label="Zoho CRM setup" docs="/docs/api-and-integrations">
                Read the step-by-step guide: connect Zoho, add the Workflow
                Rule webhook, and build the automation that sends the WhatsApp
                message.
              </InfoHint>
            </DialogTitle>
            <DialogDescription>
              {connected
                ? 'Point a Zoho Workflow Rule at the URL below to start firing automations.'
                : 'Sign in to Zoho and approve read access. Nothing is written to your CRM.'}
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

              {/* The actual setup. Connecting alone does nothing — this
                  URL in a Workflow Rule is what makes events arrive. */}
              <div className="space-y-1.5">
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
                    Set <span className="text-foreground font-medium">Body</span>{' '}
                    → Raw (JSON) and include at least the phone — e.g.{' '}
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
                              ? 'no phone in payload'
                              : 'not matched'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            // Two columns: what to fill in on the left, what to go and do
            // in Zoho on the right. Stacked below `sm` — side by side on
            // a phone would give each half about 160px, which fits
            // neither a client id nor a sentence.
            //
            // The guide stays visible rather than behind a link, because
            // it describes work in ANOTHER tab: someone registering the
            // app in Zoho needs the redirect URI in front of them while
            // they do it.
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* ── Left: the form ── */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-foreground flex items-center gap-1 text-xs">
                    Your Zoho data centre
                    <InfoHint label="Data centre" side="right">
                      Zoho runs separate, unconnected regions. A client
                      registered on <code>zoho.com</code> does not exist on{' '}
                      <code>zoho.in</code>, and signing in with the wrong one
                      fails with an error that does not explain why. Check the
                      address bar when you are signed in to Zoho.
                    </InfoHint>
                  </Label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    disabled={busy}
                    className="border-border bg-muted text-foreground focus:border-primary h-10 w-full rounded-lg border px-3 text-sm outline-none"
                  >
                    {ZOHO_REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs">Client ID</Label>
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="1000.XXXXXXXXXXXX"
                    className="font-mono text-xs"
                    disabled={busy}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-foreground flex items-center gap-1 text-xs">
                    Client Secret
                    <InfoHint label="Client secret" side="right">
                      Encrypted before it is stored, and never sent back to the
                      browser again — the same way every other credential in
                      this app is held. Re-enter it if you ever need to change
                      it.
                    </InfoHint>
                  </Label>
                  <Input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="font-mono text-xs"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void connect();
                    }}
                  />
                </div>
              </div>

              {/* ── Right: what to do in Zoho ── */}
              <div className="border-border bg-muted/30 space-y-2.5 rounded-lg border p-3">
                <p className="text-foreground flex items-center gap-1 text-xs font-medium">
                  Get these from Zoho
                  <InfoHint label="Why your own app?" side="left">
                    Each organisation registers its own Zoho application rather
                    than sharing ours. Zoho is region-partitioned, so one shared
                    client could not serve customers across data centres — and
                    a single registration would put every tenant behind one
                    revocation and one rate limit.
                  </InfoHint>
                </p>

                <ol className="text-muted-foreground space-y-2.5 text-[11px] leading-relaxed">
                  <GuideStep n={1}>
                    Open{' '}
                    <a
                      href="https://api-console.zoho.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      api-console.zoho.com
                    </a>{' '}
                    in the region you picked, then{' '}
                    <span className="text-foreground font-medium">
                      Add Client
                    </span>{' '}
                    →{' '}
                    <span className="text-foreground font-medium">
                      Server-based Applications
                    </span>
                    .
                  </GuideStep>

                  <GuideStep n={2}>
                    Name it anything. For{' '}
                    <span className="text-foreground font-medium">
                      Authorized Redirect URI
                    </span>
                    , paste exactly this — a trailing slash or the wrong host
                    and Zoho refuses the sign-in:
                    <span className="mt-1 flex items-center gap-1">
                      <code className="bg-background border-border text-foreground min-w-0 flex-1 truncate rounded border px-1.5 py-1 font-mono text-[10px]">
                        {redirectUri}
                      </code>
                      <button
                        type="button"
                        onClick={copyRedirect}
                        aria-label="Copy redirect URI"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded transition-colors"
                      >
                        {copiedRedirect ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </span>
                  </GuideStep>

                  <GuideStep n={3}>
                    Copy the{' '}
                    <span className="text-foreground font-medium">
                      Client ID
                    </span>{' '}
                    and{' '}
                    <span className="text-foreground font-medium">
                      Client Secret
                    </span>{' '}
                    it shows you into the fields on the left.
                  </GuideStep>

                  <GuideStep n={4}>
                    Press Continue — you will sign in to Zoho and approve
                    read-only access. Nothing is ever written to your CRM.
                  </GuideStep>
                </ol>
              </div>
            </div>
          )}

          <DialogFooter className={connected ? 'sm:justify-between' : undefined}>
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
                <Button type="button" onClick={connect} disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Continue to Zoho'
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
