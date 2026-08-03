'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Lock,
  Trash2,
  XCircle,
} from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { invalidateConnectedChannels } from '@/hooks/use-connected-channels';
import { InstagramLogo, MessengerLogo } from '@/components/inbox/channel-icons';
import { openOAuthTab } from '@/lib/oauth/tab';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

// ============================================================
// Instagram & Messenger — one connect for both.
//
// Both channels come out of a single Facebook Login for Business
// consent: Meta hands back the Page (Messenger) and the Instagram
// professional account linked to it, sharing one Page access token. So
// this panel deliberately has ONE primary button, and treats the two
// channels as two readouts of one connection rather than two setups.
// ============================================================

interface ChannelStatus {
  connected: boolean;
  pageId: string | null;
  pageName: string | null;
  username?: string | null;
  instagramBusinessAccountId?: string | null;
  verifyToken: string | null;
  connectMethod: string | null;
}

interface MetaStatusResponse {
  messenger: ChannelStatus;
  instagram: ChannelStatus;
  pickPending: boolean;
  instagram_needs_reconnect: boolean;
  allow_instagram: boolean;
  token_error: string | null;
}

interface PickableAsset {
  page_id: string;
  page_name: string;
  instagram: { id: string; username: string | null } | null;
}

/** The two channels, named the way their API routes are. */
type Channel = 'messenger' | 'instagram';

/** Why the Instagram half didn't connect, in the operator's language. */
const IG_SKIPPED_COPY: Record<string, string> = {
  not_linked:
    'Messenger is connected. That Page has no Instagram professional account linked to it — link one in Meta Business Suite, then connect again to add Instagram DMs.',
  plan: 'Messenger is connected. Instagram DMs are not included in your current plan — upgrade to switch them on.',
  claimed:
    'Messenger is connected. That Instagram account is already connected to another workspace on this instance.',
  failed: 'Messenger is connected, but Instagram could not be saved. Try connecting again.',
};

export function MetaChannelsConfig() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  /** Which single channel has an action in flight, if any. */
  const [busyChannel, setBusyChannel] = useState<Channel | null>(null);

  const [status, setStatus] = useState<MetaStatusResponse | null>(null);
  const [loadError, setLoadError] = useState('');

  // Asset picker — only when the login returned more than one Page.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assets, setAssets] = useState<PickableAsset[] | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      // Every connect and disconnect ends here, so this is the one place
      // that has to tell the inbox its channel tabs may have changed —
      // that hook caches per page load and would otherwise keep showing
      // a channel as unconnected until a full reload.
      invalidateConnectedChannels();

      const res = await fetch('/api/meta/status');
      if (!res.ok) throw new Error('status');
      setStatus(await res.json());
      setLoadError('');
    } catch {
      setStatus(null);
      setLoadError('Could not load the Facebook and Instagram connection status.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssets = useCallback(async () => {
    setAssets(null);
    setPickerOpen(true);
    try {
      const res = await fetch('/api/meta/assets');
      const body = await res.json();
      if (body.expired) {
        setPickerOpen(false);
        toast.error(body.message || 'Your Facebook login session expired.');
        return;
      }
      setAssets(body.assets ?? []);
    } catch {
      setPickerOpen(false);
      toast.error('Could not load your Facebook Pages.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /**
   * The one place an OAuth outcome is turned into UI. Both endings feed
   * it: the login tab's postMessage payload, and the ?meta_* query params of
   * the redirect fallback — same keys, same handling, so the two paths
   * can never drift into telling the user different things.
   */
  const applyOutcome = useCallback(
    (params: Record<string, string>) => {
      if (params.error) {
        toast.error(params.error, { duration: 10000 });
        return;
      }
      if (params.pick) {
        toast.info('Choose which Facebook Page to connect.');
        loadAssets();
        return;
      }
      if (!params.connected) return;

      const { page, ig, ig_skipped: skipped } = params;
      if (ig) {
        toast.success(`Connected — ${page ?? 'your Page'} and @${ig}`);
      } else if (skipped) {
        toast.warning(IG_SKIPPED_COPY[skipped] ?? IG_SKIPPED_COPY.failed, {
          duration: 10000,
        });
      } else {
        toast.success(page ? `Connected — ${page}` : 'Connected.');
      }
      loadStatus();
    },
    [loadAssets, loadStatus],
  );

  // Redirect fallback only — the login-tab path never touches the URL.
  // Kept because a blocked tab falls back to a full-page navigation, and
  // because the callback still redirects for anyone arriving without one.
  useEffect(() => {
    const params: Record<string, string> = {};
    for (const key of ['connected', 'pick', 'error', 'page', 'ig', 'ig_skipped']) {
      const value = searchParams.get(`meta_${key}`);
      if (value) params[key] = value;
    }
    if (Object.keys(params).length === 0) return;

    applyOutcome(params);
    // Strip the params so a refresh doesn't replay the toast.
    router.replace('/settings/meta');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const outcome = await openOAuthTab('/api/meta/oauth/start?tab=1', {
        name: 'wacrm-meta-connect',
      });

      if (outcome.status === 'blocked') {
        // Not worth an error: the full-page flow still works, and the
        // callback's redirect ending is there precisely for this.
        toast.info('Your browser blocked the new tab — continuing here instead.');
        window.location.href = '/api/meta/oauth/start';
        return;
      }
      if (outcome.status === 'cancelled') return;

      applyOutcome(outcome.params);
    } finally {
      setConnecting(false);
    }
  }

  async function handleSelectAsset(pageId: string) {
    setSelectingId(pageId);
    try {
      const res = await fetch('/api/meta/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Could not connect that Page.');
        return;
      }
      if (body.instagram_username) {
        toast.success(`Connected — ${body.page?.name ?? 'Page'} and @${body.instagram_username}`);
      } else if (body.instagram_skipped) {
        toast.warning(
          IG_SKIPPED_COPY[body.instagram_skipped] ?? IG_SKIPPED_COPY.failed,
          { duration: 10000 },
        );
      } else {
        toast.success(`Connected — ${body.page?.name ?? 'Page'}`);
      }
      setPickerOpen(false);
      setAssets(null);
      loadStatus();
    } finally {
      setSelectingId(null);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        'Disconnect Messenger and Instagram? Both share one Facebook connection, so they go together. Existing conversations stay, but new messages will stop arriving.',
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/meta/connect', { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Failed to disconnect.');
        return;
      }
      toast.success('Messenger and Instagram disconnected.');
      setPickerOpen(false);
      setAssets(null);
      loadStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  /* ── One channel at a time ──
     The combined button above is the short path; these two run each
     channel's own OAuth flow, so a workspace can add Messenger today and
     Instagram next month, or replace one without touching the other.
     Same login-tab treatment — nobody should lose this page mid-setup. */

  async function handleConnectOne(channel: Channel) {
    setBusyChannel(channel);
    try {
      const outcome = await openOAuthTab(`/api/${channel}/oauth/start?tab=1`, {
        name: `wacrm-${channel}-connect`,
      });

      if (outcome.status === 'blocked') {
        toast.info('Your browser blocked the new tab — continuing here instead.');
        window.location.href = `/api/${channel}/oauth/start`;
        return;
      }
      if (outcome.status === 'cancelled') return;

      const params = outcome.params;
      if (params.error) {
        toast.error(params.error, { duration: 10000 });
        return;
      }
      // Messenger only: several Pages came back and the choice has to be
      // made against messenger_config alone. This page's picker connects
      // BOTH channels, so sending someone to it here would quietly do
      // more than they asked — the channel's own page owns that choice.
      if (params.pick) {
        toast.info('You manage several Pages — choose one on the Messenger page.');
        router.push('/settings/messenger');
        return;
      }
      if (!params.connected) return;

      const who = params.page ?? (params.username ? `@${params.username}` : null);
      toast.success(who ? `Connected — ${who}` : 'Connected.');
      loadStatus();
    } finally {
      setBusyChannel(null);
    }
  }

  async function handleDisconnectOne(channel: Channel) {
    const label = channel === 'messenger' ? 'Messenger' : 'Instagram';
    if (
      !confirm(
        `Disconnect ${label}? The other channel stays connected. Existing conversations stay, but new ${label} messages will stop arriving.`,
      )
    ) {
      return;
    }
    setBusyChannel(channel);
    try {
      const res = await fetch(`/api/${channel}/config`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || `Failed to disconnect ${label}.`);
        return;
      }
      toast.success(`${label} disconnected.`);
      loadStatus();
    } finally {
      setBusyChannel(null);
    }
  }

  const head = (
    <SettingsPanelHead
      title="Instagram & Messenger"
      description="One Facebook login connects both inboxes. As an approved Meta Tech Provider we ask for Page and Instagram messaging permissions in a single approval — no tokens to copy, no second setup."
    />
  );

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        {head}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  const messenger = status?.messenger;
  const instagram = status?.instagram;
  const anyConnected = Boolean(messenger?.connected || instagram?.connected);

  return (
    <section className="animate-in fade-in-50 space-y-5 duration-200">
      {head}

      {!canEdit && (
        <Alert>
          <Lock className="size-4 shrink-0 text-muted-foreground" />
          <AlertDescription>
            You have read-only access. Only admins and owners can connect or
            disconnect these channels.
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive">
          <XCircle className="size-4 shrink-0" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* The one button. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            {anyConnected ? 'Connected channels' : 'Connect both channels'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {anyConnected
              ? 'Messages sent to this Page and its Instagram account arrive in your shared inbox.'
              : 'Log in with Facebook and approve one permission screen. We pick up the Page for Messenger and the Instagram professional account linked to it, in the same step.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ChannelRow
              icon={<MessengerLogo className="size-9" />}
              label="Messenger"
              connected={Boolean(messenger?.connected)}
              primary={messenger?.pageName ?? 'Facebook Page'}
              secondary={
                messenger?.connected && messenger.pageId
                  ? `Page ID ${messenger.pageId}`
                  : 'Not connected'
              }
              canEdit={canEdit}
              busy={busyChannel === 'messenger'}
              anyBusy={busyChannel !== null}
              onConnect={() => handleConnectOne('messenger')}
              onDisconnect={() => handleDisconnectOne('messenger')}
              settingsHref="/settings/messenger"
            />
            <ChannelRow
              icon={<InstagramLogo className="size-9" />}
              label="Instagram DMs"
              connected={Boolean(instagram?.connected)}
              primary={
                instagram?.username
                  ? `@${instagram.username}`
                  : (instagram?.pageName ?? 'Instagram account')
              }
              secondary={
                instagram?.connected && instagram.instagramBusinessAccountId
                  ? `Account ID ${instagram.instagramBusinessAccountId}`
                  : status?.allow_instagram === false
                    ? 'Not included in your plan'
                    : 'Not connected'
              }
              canEdit={canEdit && status?.allow_instagram !== false}
              busy={busyChannel === 'instagram'}
              anyBusy={busyChannel !== null}
              onConnect={() => handleConnectOne('instagram')}
              onDisconnect={() => handleDisconnectOne('instagram')}
              settingsHref="/settings/instagram"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleConnect}
              disabled={!canEdit || connecting}
              className="bg-[#0866FF] text-white hover:bg-[#0866FF]/90"
            >
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BadgeCheck className="size-4" />
              )}
              {connecting
                ? 'Waiting for Facebook…'
                : anyConnected
                  ? 'Reconnect / switch Page'
                  : 'Connect Facebook & Instagram'}
            </Button>

            {anyConnected && canEdit && (
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
                Disconnect both
              </Button>
            )}
          </div>

          {status?.pickPending && !pickerOpen && (
            <Button variant="outline" size="sm" onClick={loadAssets} disabled={!canEdit}>
              Finish choosing a Page
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Picker — only when the login returned more than one Page. */}
      {pickerOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Choose a Page</CardTitle>
            <CardDescription className="text-muted-foreground">
              You manage several Pages. Pick the one this workspace should
              handle — its Instagram account comes with it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assets === null ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading your Pages…
              </div>
            ) : assets.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No Pages available on that Facebook account.
              </p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {assets.map((a) => (
                  <div
                    key={a.page_id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.page_name}
                      </p>
                      {/* Text, not the brand mark: channel-icons.tsx
                          uses static gradient ids, so it is only safe to
                          render each logo once per page — the two channel
                          rows above already spend that budget. */}
                      <p className="truncate text-xs text-muted-foreground">
                        {a.instagram
                          ? `Instagram ${a.instagram.username ? `@${a.instagram.username}` : 'linked'} · Messenger`
                          : 'Messenger only — no Instagram linked'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={!canEdit || selectingId !== null}
                      onClick={() => handleSelectAsset(a.page_id)}
                    >
                      {selectingId === a.page_id ? (
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
          {status?.token_error ? (
            <AlertTriangle className="size-4 text-amber-500" />
          ) : anyConnected ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <XCircle className="size-4 text-red-500" />
          )}
          <AlertTitle className="mb-0 text-foreground">
            {status?.token_error
              ? 'Needs attention'
              : anyConnected
                ? 'Connected'
                : 'Not connected'}
          </AlertTitle>
        </div>
        <AlertDescription className="text-muted-foreground">
          {status?.token_error
            ? status.token_error
            : anyConnected
              ? 'Your Page token is valid and Meta can see this Page.'
              : 'Use “Connect Facebook & Instagram” above to get started.'}
        </AlertDescription>
      </Alert>

      {/* A row left over from the old Instagram-only login can't send on
          the endpoint this app uses — say so instead of showing a tick. */}
      {status?.instagram_needs_reconnect && (
        <Alert>
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          <AlertTitle className="text-foreground">
            Reconnect Instagram
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            This Instagram account was connected with the older
            Instagram-only login, which cannot send on the current API.
            Click “Connect Facebook & Instagram” to relink it through your
            Page — nothing else changes.
          </AlertDescription>
        </Alert>
      )}

      {/* No webhook panel here on purpose: the callback URLs are
          registered once per Meta app by whoever runs this instance, not
          once per workspace, and connecting already subscribes the Page
          automatically. The admin who does need them finds them behind
          "Full setup", next to manual credential entry. */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Webhook callback URLs and verify tokens live on each channel&apos;s own
        page under <strong className="font-semibold">Full setup</strong>, along
        with manual credential entry. They are registered once per Meta app
        rather than per workspace — connecting here already subscribes your
        Page to them.
      </p>
    </section>
  );
}

/* ─── Bits ────────────────────────────────────────────────────────── */

/**
 * One channel: what it is, whether it's on, and its own controls.
 *
 * The per-channel buttons are not a duplicate of the combined one — they
 * run that channel's own OAuth flow, so a workspace can add or replace a
 * single inbox without re-approving the other.
 */
function ChannelRow({
  icon,
  label,
  connected,
  primary,
  secondary,
  canEdit,
  busy,
  anyBusy,
  onConnect,
  onDisconnect,
  settingsHref,
}: {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  primary: string;
  secondary: string;
  canEdit: boolean;
  busy: boolean;
  /** Any channel mid-action — locks the others so two OAuth logins can't
   *  race for the same parked session. */
  anyBusy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  settingsHref: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        {/* The brand mark carries its own colour, so a disconnected
            channel is desaturated rather than swapped for a different
            glyph — same shape either way, so the row doesn't jump when
            it connects. */}
        <span className={connected ? 'shrink-0' : 'shrink-0 opacity-40 grayscale'}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {label}
            {connected && <CheckCircle2 className="size-3 text-primary" />}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {connected ? primary : '—'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{secondary}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onConnect}
          disabled={!canEdit || anyBusy}
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {connected ? 'Reconnect' : 'Connect'}
        </Button>
        {connected && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDisconnect}
            disabled={!canEdit || anyBusy}
            className="text-muted-foreground hover:text-foreground"
          >
            Disconnect
          </Button>
        )}
        <Link
          href={settingsHref}
          className="ml-auto text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Full setup
        </Link>
      </div>
    </div>
  );
}

