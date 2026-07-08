'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RotateCcw,
  XCircle,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import { createClient } from '@/lib/supabase/client';
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
import type { InstagramConfig as InstagramConfigRow } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

export function InstagramConfig() {
  const supabase = createClient();
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [config, setConfig] = useState<InstagramConfigRow | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [needsReset, setNeedsReset] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [pageId, setPageId] = useState('');
  const [igBusinessAccountId, setIgBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/instagram/webhook`
      : '';

  const fetchConfig = useCallback(
    async (acctId: string) => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('instagram_config')
          .select('*')
          .eq('account_id', acctId)
          .maybeSingle();

        if (data) {
          setConfig(data as InstagramConfigRow);
          setPageId(data.page_id || '');
          setIgBusinessAccountId(data.instagram_business_account_id || '');
          setAccessToken(MASKED_TOKEN);
          setVerifyToken('');
          setTokenEdited(false);
        } else {
          setConfig(null);
          setPageId('');
          setIgBusinessAccountId('');
          setAccessToken('');
          setVerifyToken('');
          setTokenEdited(false);
        }

        if (data) {
          const res = await fetch('/api/instagram/config');
          const payload = await res.json();
          if (payload.connected) {
            setConnectionStatus('connected');
            setNeedsReset(false);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setNeedsReset(Boolean(payload.needs_reset));
            setStatusMessage(payload.message || '');
          }
        } else {
          setConnectionStatus('disconnected');
          setNeedsReset(false);
          setStatusMessage('');
        }
      } catch (err) {
        console.error('fetchConfig error:', err);
        toast.error('Failed to load Instagram configuration');
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      setLoading(false);
      return;
    }
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  async function handleSave() {
    if (!pageId.trim() || !igBusinessAccountId.trim()) {
      toast.error('Page ID and Instagram Business Account ID are required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        page_id: pageId.trim(),
        instagram_business_account_id: igBusinessAccountId.trim(),
        verify_token: verifyToken.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        toast.error('Please re-enter the Access Token to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/instagram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      toast.success(
        data.account_info?.username
          ? `Connected — @${data.account_info.username}`
          : 'Instagram connected.',
      );

      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/instagram/config');
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setNeedsReset(false);
        setStatusMessage('');
        toast.success(
          payload.account_info?.username
            ? `Connected to @${payload.account_info.username}`
            : 'API connection successful',
        );
      } else {
        setConnectionStatus('disconnected');
        setNeedsReset(Boolean(payload.needs_reset));
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current Instagram config so you can re-enter it. Continue?')) {
      return;
    }
    try {
      setResetting(true);
      const res = await fetch('/api/instagram/config', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }
      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setConfig(null);
      setPageId('');
      setIgBusinessAccountId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setNeedsReset(false);
      setStatusMessage('');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Instagram"
          description="Connect an Instagram Professional account to receive and reply to DMs from the inbox."
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
        title="Instagram"
        description="Connect an Instagram Professional account to receive and reply to DMs from the inbox. Text and image/video only for now — no templates or bots on this channel yet."
      />

      {!canEdit && (
        <Alert>
          <Lock className="size-4 shrink-0 text-muted-foreground" />
          <AlertDescription>
            You have read-only access. Only admins and owners can connect or
            edit the Instagram configuration.
          </AlertDescription>
        </Alert>
      )}

      {/* Setup steps — the manual-entry flow has real prerequisites in
          Meta's dashboard that aren't obvious from a bare form. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Before you connect</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              Add the Instagram product to your Meta App and link a Facebook
              Page to an Instagram Professional (Business/Creator) account.
            </li>
            <li>
              Generate a Page Access Token with the{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                instagram_basic
              </code>{' '}
              and{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                instagram_manage_messages
              </code>{' '}
              permissions.
            </li>
            <li>
              In Meta&apos;s App Dashboard → Webhooks, register the callback
              URL shown below against the Page/Instagram webhook product and
              subscribe to the{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                messages
              </code>{' '}
              field — this step happens in Meta&apos;s dashboard and can&apos;t
              be done for you from here.
            </li>
            <li>Paste the credentials below and save.</li>
          </ol>
        </CardContent>
      </Card>

      {needsReset && (
        <Alert className="border-amber-600/40 bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <AlertTitle className="mb-1 text-amber-200">
                Stored token can&apos;t be decrypted
              </AlertTitle>
              <AlertDescription className="text-sm text-amber-100/80">
                {statusMessage}
              </AlertDescription>
              {canEdit && (
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 text-white hover:bg-amber-700"
                >
                  {resetting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Reset Configuration
                </Button>
              )}
            </div>
          </div>
        </Alert>
      )}

      <Alert className="border-border bg-card">
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <XCircle className="size-4 text-red-500" />
          )}
          <AlertTitle className="mb-0 text-foreground">
            {connectionStatus === 'connected' ? 'Connected' : 'Not connected'}
          </AlertTitle>
        </div>
        <AlertDescription className="text-muted-foreground">
          {connectionStatus === 'connected'
            ? 'Your access token is valid and Meta can see this Instagram account.'
            : statusMessage ||
              'Enter your Instagram credentials below to connect.'}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Credentials</CardTitle>
          <CardDescription className="text-muted-foreground">
            From Meta&apos;s dashboard — see the setup steps above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Page ID</Label>
            <Input
              placeholder="e.g. 100234567890123"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">
              Instagram Business Account ID
            </Label>
            <Input
              placeholder="e.g. 17841400000000000"
              value={igBusinessAccountId}
              onChange={(e) => setIgBusinessAccountId(e.target.value)}
              disabled={!canEdit || saving}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Page Access Token</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                placeholder="Enter your access token"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  setTokenEdited(true);
                }}
                onFocus={() => {
                  if (accessToken === MASKED_TOKEN) {
                    setAccessToken('');
                    setTokenEdited(true);
                  }
                }}
                disabled={!canEdit || saving}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                disabled={!canEdit}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {config && !tokenEdited && (
              <p className="text-xs text-muted-foreground">
                Token is hidden for security. Re-enter it to update
                configuration.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">
              Webhook Verify Token
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </Label>
            <Input
              placeholder="Create a custom verify token"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              disabled={!canEdit || saving}
            />
            <p className="text-xs text-muted-foreground">
              A custom string you create. Must match the token you set in
              Meta&apos;s webhook settings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Webhook Configuration</CardTitle>
          <CardDescription className="text-muted-foreground">
            Use this URL as the callback in Meta&apos;s App Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Webhook Callback URL</Label>
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
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Save Configuration
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            Test API Connection
          </Button>
        </div>
      )}
    </section>
  );
}
