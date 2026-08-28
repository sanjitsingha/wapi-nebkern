'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { openOAuthTab } from '@/lib/oauth/tab';
import { Button } from '@/components/ui/button';
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

const SHOPIFY_LOGO = 'https://media.instant.nebkern.com/assets/shopify-logo.png';

/**
 * Start on the access-token form rather than "Sign in with Shopify".
 *
 * OAuth is built and works (src/app/api/integrations/shopify/oauth/),
 * but it needs a Partner app, and Shopify gates app creation behind a
 * $19 one-time App Store registration. Until that exists, the OAuth
 * button would send a merchant to a start route that can only answer
 * "Shopify is not configured on this server".
 *
 * So: token paste leads, OAuth is one click away for anyone who has
 * set the credentials up. Set this to `false` once SHOPIFY_CLIENT_ID
 * and SHOPIFY_CLIENT_SECRET are live and the flow becomes the default.
 */
const DEFAULT_MANUAL = true;

interface ConnectionStatus {
  shopDomain: string;
  isActive: boolean;
  connectedAt: string | null;
  lastEventAt: string | null;
}

/**
 * WooCommerce's sibling — a native Shopify connect. Reads status, and a
 * dialog collects the store domain + a custom app's Admin API access token
 * and API secret. Connect verifies the token and auto-registers the order
 * webhooks server-side.
 */
export function ShopifyConnect() {
  const [status, setStatus] = useState<ConnectionStatus | null | undefined>(
    undefined,
  );
  const [open, setOpen] = useState(false);

  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [busy, setBusy] = useState(false);
  /**
   * Which connect method the dialog is showing.
   *
   * Token paste is the default, and OAuth is the opt-in — the reverse
   * of what the UX argues for, and deliberate. "Sign in with Shopify"
   * needs a client id and secret from a Partner app, and creating one
   * is gated behind Shopify's $19 App Store registration. Until that is
   * paid for, the OAuth button can only fail, so it is not what a
   * merchant should meet first.
   *
   * Flip DEFAULT_MANUAL to false the day SHOPIFY_CLIENT_ID is set on
   * the server — that is the whole change.
   */
  const [manual, setManual] = useState(DEFAULT_MANUAL);

  const load = () => {
    fetch('/api/integrations/shopify/connect', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d?.connection ?? null))
      .catch(() => setStatus(null));
  };

  useEffect(load, []);

  /**
   * The normal path: hand the merchant to Shopify, let them sign in and
   * approve, and take the token from the callback.
   *
   * Opens in a tab rather than navigating, so a half-filled settings
   * page is still here when they come back — the same contract the Meta
   * channels use (src/lib/oauth/tab.ts).
   */
  const install = async () => {
    if (!shopDomain.trim()) {
      toast.error('Enter your .myshopify.com store domain.');
      return;
    }
    setBusy(true);
    try {
      const outcome = await openOAuthTab(
        `/api/integrations/shopify/oauth/start?tab=1&shop=${encodeURIComponent(
          shopDomain.trim(),
        )}`,
        { name: 'shopify-oauth' },
      );

      if (outcome.status === 'blocked') {
        toast.error('Your browser blocked the Shopify window. Allow pop-ups and try again.');
        return;
      }
      // Closed without reporting — they backed out at Shopify's screen.
      if (outcome.status === 'cancelled') return;

      if (outcome.params.error) {
        toast.error(outcome.params.error);
        return;
      }
      toast.success('Shopify connected');
      setOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!shopDomain.trim() || !accessToken.trim() || !apiSecret.trim()) {
      toast.error('Store domain, access token and API secret are all required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/shopify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopDomain: shopDomain.trim(),
          accessToken: accessToken.trim(),
          apiSecret: apiSecret.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not connect the store.');
        return;
      }
      toast.success('Shopify connected');
      setAccessToken('');
      setApiSecret('');
      setOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Shopify? Its order webhooks will be removed.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/shopify/connect', {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Could not disconnect.');
        return;
      }
      toast.success('Shopify disconnected');
      setStatus(null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const connected = !!status?.isActive;

  return (
    <>
      <div className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SHOPIFY_LOGO}
            alt="Shopify"
            className="h-11 w-auto object-contain"
          />
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Connected
            </span>
          )}
        </div>
        <h4 className="mt-3 text-sm font-semibold text-foreground">Shopify</h4>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
          {connected && status
            ? `Orders from ${status.shopDomain} create contacts and can trigger automations.`
            : 'Connect your store so new orders create contacts and fire a "Shopify order" automation.'}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SHOPIFY_LOGO} alt="" className="size-6 object-contain" />
              {connected ? 'Shopify' : 'Connect Shopify'}
            </DialogTitle>
            <DialogDescription>
              {connected
                ? 'Your store is connected. New orders sync as contacts and trigger automations.'
                : manual
                  ? 'Create a custom app in your Shopify admin and paste its credentials — the steps are below.'
                  : 'Enter your store domain — you’ll sign in at Shopify and approve read access to your orders. No keys to copy.'}
            </DialogDescription>
          </DialogHeader>

          {connected && status ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Store</span>
                  <span className="font-medium text-foreground">
                    {status.shopDomain}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-muted-foreground">Last order event</span>
                  <span className="text-foreground">
                    {status.lastEventAt
                      ? new Date(status.lastEventAt).toLocaleString()
                      : 'None yet'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Build what happens on a new order under{' '}
                <span className="font-medium text-foreground">Automations</span>{' '}
                → trigger{' '}
                <span className="font-medium text-foreground">Shopify Order</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Store domain">
                <Input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="mystore.myshopify.com"
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !manual) void install();
                  }}
                />
              </Field>

              {/* The manual half stays available, but folded away. It is
                  the fallback for a store that cannot install a public
                  app, and the escape hatch while SHOPIFY_CLIENT_ID is
                  not yet set on the server — not the path a merchant
                  should meet first. */}
              {manual && (
                <>
                  <Field label="Admin API access token">
                    <Input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="shpat_xxxxxxxxxxxx"
                      className="font-mono"
                      disabled={busy}
                    />
                  </Field>
                  <Field label="API secret key">
                    <Input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="shpss_ / secret"
                      className="font-mono"
                      disabled={busy}
                    />
                  </Field>
                  {/* Numbered, because this is the part people get
                      wrong: the two secrets sit on DIFFERENT tabs of
                      the same app, and the access token is shown once
                      and never again. */}
                  <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                    <li>
                      In Shopify admin: Settings → Apps and sales channels →{' '}
                      <span className="font-medium text-foreground">
                        Develop apps
                      </span>{' '}
                      → Create an app.
                    </li>
                    <li>
                      Configuration → Admin API scopes → tick{' '}
                      <code className="text-foreground">read_orders</code> and{' '}
                      <code className="text-foreground">read_customers</code> →
                      Save.
                    </li>
                    <li>
                      API credentials → Install app. Copy the{' '}
                      <span className="font-medium text-foreground">
                        Admin API access token
                      </span>{' '}
                      — Shopify shows it once.
                    </li>
                    <li>
                      On the same page, reveal and copy the{' '}
                      <span className="font-medium text-foreground">
                        API secret key
                      </span>
                      . It signs the order webhooks.
                    </li>
                  </ol>
                </>
              )}

              <button
                type="button"
                onClick={() => setManual((v) => !v)}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {manual
                  ? 'Sign in with Shopify instead'
                  : 'Use an access token instead'}
              </button>
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
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
                  onClick={manual ? connect : install}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : manual ? (
                    'Connect'
                  ) : (
                    'Continue to Shopify'
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-foreground">{label}</Label>
      {children}
    </div>
  );
}
