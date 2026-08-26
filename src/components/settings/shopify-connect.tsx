'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';

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

  const load = () => {
    fetch('/api/integrations/shopify/connect', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d?.connection ?? null))
      .catch(() => setStatus(null));
  };

  useEffect(load, []);

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
                : 'Create a custom app in Shopify (Settings → Apps → Develop apps) with the read_orders scope, then paste its Admin API access token and API secret key.'}
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
                />
              </Field>
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
                <Button type="button" onClick={connect} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : 'Connect'}
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
