'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  MessageCircle,
  Trash2,
  XCircle,
} from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

interface ConnectedPage {
  id: string;
  name: string | null;
}

interface PickablePage {
  id: string;
  name: string;
}

export function MessengerConfig() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState<ConnectedPage | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Page picker (only when the operator manages more than one Page).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pages, setPages] = useState<PickablePage[] | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/messenger/webhook`
      : '';

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messenger/config');
      const body = await res.json();
      if (body.connected) {
        setConnected(true);
        setPage(body.page ?? null);
        setVerifyToken(body.verify_token ?? null);
        setStatusMessage('');
      } else {
        setConnected(false);
        setPage(null);
        setVerifyToken(null);
        setStatusMessage(body.message || '');
      }
    } catch {
      setConnected(false);
      setStatusMessage('Could not load the Messenger connection status.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPages = useCallback(async () => {
    setPages(null);
    setPickerOpen(true);
    try {
      const res = await fetch('/api/messenger/pages');
      const body = await res.json();
      if (body.expired) {
        setPickerOpen(false);
        toast.error(body.message || 'Your Facebook login session expired.');
        return;
      }
      setPages(body.pages ?? []);
    } catch {
      setPickerOpen(false);
      toast.error('Could not load your Facebook Pages.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // The OAuth callback returns here with ?fb_connected=1&fb_page=…,
  // ?fb_pick=1 (several Pages to choose from), or ?fb_error=… — a full
  // page navigation, not an XHR. Surface it once, then strip the params.
  useEffect(() => {
    const justConnected = searchParams.get('fb_connected');
    const pickPage = searchParams.get('fb_pick');
    const error = searchParams.get('fb_error');
    if (!justConnected && !pickPage && !error) return;

    if (justConnected) {
      const name = searchParams.get('fb_page');
      toast.success(name ? `Connected — ${name}` : 'Messenger connected.');
      loadStatus();
    } else if (pickPage) {
      toast.info('Choose which Facebook Page to connect.');
      loadPages();
    } else if (error) {
      toast.error(error, { duration: 10000 });
    }
    router.replace('/settings/messenger');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleConnect() {
    setConnecting(true);
    window.location.href = '/api/messenger/oauth/start';
  }

  async function handleSelectPage(pageId: string) {
    setSelectingId(pageId);
    try {
      const res = await fetch('/api/messenger/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Could not connect that Page.');
        return;
      }
      toast.success(`Connected — ${body.page?.name ?? 'Page'}`);
      setPickerOpen(false);
      setPages(null);
      loadStatus();
    } finally {
      setSelectingId(null);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        'Disconnect this Facebook Page? Existing conversations stay, but new Messenger messages will stop arriving.',
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/messenger/config', { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Failed to disconnect.');
        return;
      }
      toast.success('Messenger disconnected.');
      setConnected(false);
      setPage(null);
      setPickerOpen(false);
      setPages(null);
      loadStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  function handleCopyVerifyToken() {
    if (!verifyToken) return;
    navigator.clipboard.writeText(verifyToken);
    toast.success('Verify token copied to clipboard');
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Messenger"
          description="Connect a Facebook Page to receive and reply to Messenger conversations from the shared inbox."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-5 duration-200">
      <SettingsPanelHead
        title="Messenger"
        description="Connect a Facebook Page to receive and reply to Messenger conversations from the shared inbox — the same place your WhatsApp and Instagram chats live."
      />

      {!canEdit && (
        <Alert>
          <Lock className="size-4 shrink-0 text-muted-foreground" />
          <AlertDescription>
            You have read-only access. Only admins and owners can connect or
            disconnect Messenger.
          </AlertDescription>
        </Alert>
      )}

      {/* Connect — log in with Facebook, approve, done. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            {connected ? 'Connected Page' : 'Connect your Page'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {connected
              ? 'Messages sent to this Page arrive in your inbox.'
              : 'Log in with Facebook and approve the permission screen — that’s the whole flow. No tokens to copy.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected && page && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {page.name ?? 'Facebook Page'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Page ID {page.id}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleConnect}
              disabled={!canEdit || connecting}
              className="bg-[#0866FF] text-white hover:bg-[#0866FF]/90"
            >
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              {connecting
                ? 'Redirecting…'
                : connected
                  ? 'Reconnect / switch Page'
                  : 'Connect with Facebook'}
            </Button>

            {connected && canEdit && (
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Page picker — only when the login returned more than one Page. */}
      {pickerOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Choose a Page</CardTitle>
            <CardDescription className="text-muted-foreground">
              You manage several Pages. Pick the one whose Messenger inbox this
              workspace should handle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pages === null ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading your Pages…
              </div>
            ) : pages.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No Pages available on that Facebook account.
              </p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {pages.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {p.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{p.id}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={!canEdit || selectingId !== null}
                      onClick={() => handleSelectPage(p.id)}
                    >
                      {selectingId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      Connect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status */}
      <Alert className="border-border bg-card">
        <div className="flex items-center gap-2">
          {connected ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <XCircle className="size-4 text-red-500" />
          )}
          <AlertTitle className="mb-0 text-foreground">
            {connected ? 'Connected' : 'Not connected'}
          </AlertTitle>
        </div>
        <AlertDescription className="text-muted-foreground">
          {connected
            ? 'Your Page token is valid and Meta can see this Page.'
            : statusMessage || 'Use “Connect with Facebook” above to get started.'}
        </AlertDescription>
      </Alert>

      {/* Webhook — the one step that must happen in Meta's dashboard. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Webhook configuration</CardTitle>
          <CardDescription className="text-muted-foreground">
            One-time setup in Meta&apos;s App Dashboard → Webhooks → Messenger:
            register this callback URL and subscribe to the{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">messages</code>{' '}
            field. Connecting above subscribes your Page automatically, but the
            callback URL itself can only be registered in Meta&apos;s dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Webhook callback URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-muted font-mono text-sm text-muted-foreground"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Verify token</Label>
              {verifyToken ? (
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={verifyToken}
                    className="bg-muted font-mono text-sm text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyVerifyToken}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Generated once you connect a Page — paste it into the
                  &ldquo;Verify token&rdquo; field alongside the callback URL.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
