'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, ShoppingCart } from 'lucide-react';

import { cn } from '@/lib/utils';
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

interface ConnectionStatus {
  storeUrl: string;
  isActive: boolean;
  connectedAt: string | null;
  lastEventAt: string | null;
}

/**
 * The WooCommerce card in the integrations grid — a native connect flow
 * rather than a "via Zapier" link. Reads its status, opens a dialog to
 * paste the store URL + REST API key/secret, and connects (which verifies
 * the creds and auto-registers the order webhooks server-side).
 */
export function WooCommerceConnect() {
  const [status, setStatus] = useState<ConnectionStatus | null | undefined>(
    undefined,
  );
  const [open, setOpen] = useState(false);

  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch('/api/integrations/woocommerce/connect', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d?.connection ?? null))
      .catch(() => setStatus(null));
  };

  useEffect(load, []);

  const connect = async () => {
    if (!storeUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      toast.error('Store URL, consumer key and secret are all required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/woocommerce/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeUrl: storeUrl.trim(),
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not connect the store.');
        return;
      }
      toast.success('WooCommerce connected');
      setConsumerKey('');
      setConsumerSecret('');
      setOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect WooCommerce? Its order webhooks will be removed.'))
      return;
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/woocommerce/connect', {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Could not disconnect.');
        return;
      }
      toast.success('WooCommerce disconnected');
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
          <span className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ShoppingCart className="size-5" />
          </span>
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Connected
            </span>
          )}
        </div>
        <h4 className="mt-3 text-sm font-semibold text-foreground">WooCommerce</h4>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
          {connected && status
            ? `Orders from ${new URL(status.storeUrl).host} create contacts and can trigger automations.`
            : 'Connect your store so new orders create contacts and fire a "WooCommerce order" automation.'}
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
            <DialogTitle>
              {connected ? 'WooCommerce' : 'Connect WooCommerce'}
            </DialogTitle>
            <DialogDescription>
              {connected
                ? 'Your store is connected. New orders sync as contacts and trigger automations.'
                : 'Paste your store URL and a REST API key (WooCommerce → Settings → Advanced → REST API → Add key, with Read/Write access).'}
            </DialogDescription>
          </DialogHeader>

          {connected && status ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Store</span>
                  <span className="font-medium text-foreground">
                    {new URL(status.storeUrl).host}
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
                <span className="font-medium text-foreground">
                  WooCommerce Order
                </span>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Store URL">
                <Input
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://mystore.com"
                  disabled={busy}
                />
              </Field>
              <Field label="Consumer key">
                <Input
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="ck_xxxxxxxxxxxx"
                  className="font-mono"
                  disabled={busy}
                />
              </Field>
              <Field label="Consumer secret">
                <Input
                  type="password"
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="cs_xxxxxxxxxxxx"
                  className="font-mono"
                  disabled={busy}
                />
              </Field>
            </div>
          )}

          <DialogFooter className={cn(connected && 'sm:justify-between')}>
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
