'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { openOAuthTab } from '@/lib/oauth/tab';
import { Button } from '@/components/ui/button';
import { InfoHint } from '@/components/ui/info-hint';
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  // What the server will actually send to Zoho. Read from the API
  // rather than built from window.location, because a ZOHO_REDIRECT_URI
  // override is invisible to the browser and showing a value that
  // merely resembles the real one is worse than showing none.
  const [redirectUri, setRedirectUri] = useState('');

  const load = useCallback(() => {
    fetch('/api/integrations/zoho/connect', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setStatus(d?.connection ?? null);
        setEvents(d?.recentEvents ?? []);
        if (typeof d?.configured === 'boolean') setConfigured(d.configured);
        if (typeof d?.redirectUri === 'string') setRedirectUri(d.redirectUri);
      })
      .catch(() => setStatus(null));
  }, []);

  useEffect(load, [load]);

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
      if (outcome.status === 'cancelled') return;

      if (outcome.params.error) {
        toast.error(outcome.params.error);
        return;
      }
      toast.success(`Connected to ${outcome.params.org ?? 'Zoho CRM'}`);
      load();
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

  const copyRedirect = async () => {
    if (!redirectUri) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 2000);
    } catch {
      toast.error('Could not copy — select the URL and copy it manually.');
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

  const connected = !!status?.isActive;

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
              <InfoHint
                label="Zoho CRM setup"
                docs="/docs/api-and-integrations"
              >
                Read the step-by-step guide: connect Zoho, add the Workflow Rule
                webhook, and build the automation that sends the WhatsApp
                message.
              </InfoHint>
            </DialogTitle>
            <DialogDescription>
              {connected
                ? 'Point a Zoho Workflow Rule at the URL below to start firing automations.'
                : 'Sign in to Zoho and approve access. Nothing is ever written to your CRM.'}
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
            <div className="space-y-5">
              {/* The two products and the direction data moves. Same
                  lockup the integration page's connect hero uses, so
                  arriving here from there is continuous. */}
              <div className="flex items-center justify-center gap-5 py-2 sm:gap-8">
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
                    title="View your Zoho organisation's name"
                  >
                    <p>
                      The name and ID only, shown in Settings so you can tell
                      which Zoho is connected. This is the single permission
                      Instant asks for —{' '}
                      <code className="text-foreground">ZohoCRM.org.READ</code>.
                      Your contacts, deals and leads are never read, and nothing
                      is ever written to your CRM.
                    </p>
                  </Permission>

                  <Permission
                    icon={MessageSquareText}
                    title="Send WhatsApp messages when Zoho events fire"
                  >
                    <p>
                      A Workflow Rule in Zoho posts the event to Instant — a
                      deal stage change, a new lead, an overdue invoice — and
                      Instant matches the phone number in it to a contact and
                      runs your automation. Zoho pushes to us; we never pull
                      from Zoho, which is why the one permission above covers
                      it.
                    </p>
                  </Permission>
                </ul>
              </section>

              {/* The exact string Zoho must have on file.

                  Zoho compares this byte for byte against the Authorized
                  Redirect URI in the API console, and when it does not
                  match it says so without printing either value — so
                  there is nothing to compare and no way to tell whether
                  the difference is the scheme, the port or a slash.
                  Showing the real one, copyable, is the only way to make
                  that failure diagnosable.

                  It is origin-derived, so it differs between localhost,
                  a tunnel and production — each needs its own entry in
                  the console, and Zoho accepts several. */}
              {redirectUri && (
                <section className="border-border space-y-2 border-t pt-4">
                  <h3 className="text-foreground text-sm font-medium">
                    Before you connect
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    This exact URL must be listed under{' '}
                    <span className="text-foreground font-medium">
                      Authorized Redirect URIs
                    </span>{' '}
                    in your Zoho API console. Zoho matches it character for
                    character.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted/50 border-border min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-[11px]">
                      {redirectUri}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyRedirect}
                      aria-label="Copy redirect URI"
                      className="size-9 shrink-0"
                    >
                      {copiedRedirect ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </section>
              )}

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
                    sends you straight back. If it says{' '}
                    <span className="text-foreground font-medium">
                      Invalid Redirect Uri
                    </span>{' '}
                    instead, the URL above is not in your console yet.
                  </GuideStep>
                  <GuideStep n={3}>
                    Copy the webhook URL we then show you into a Zoho Workflow
                    Rule. That step is what makes events actually arrive, so the
                    instructions stay on this page afterwards.
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
