'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Phone, PhoneOff } from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

type NotConfiguredReason =
  | 'no_config'
  | 'token_corrupted'
  | 'meta_api_error';

interface CallingState {
  configured: boolean;
  enabled: boolean;
  status: string | null;
  callIconVisibility: string | null;
}

export function CallingConfig() {
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<CallingState | null>(null);
  const [notConfigured, setNotConfigured] = useState<{
    reason: NotConfiguredReason;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/calling');
      const body = await res.json();
      if (body.configured) {
        setState({
          configured: true,
          enabled: !!body.enabled,
          status: body.status ?? null,
          callIconVisibility: body.callIconVisibility ?? null,
        });
        setNotConfigured(null);
      } else {
        setState(null);
        setNotConfigured({ reason: body.reason, message: body.message });
      }
    } catch {
      setNotConfigured({
        reason: 'meta_api_error',
        message: 'Could not load calling settings. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(next: boolean) {
    if (saving) return;
    setSaving(true);
    // Optimistic flip; revert on failure.
    setState((prev) => (prev ? { ...prev, enabled: next } : prev));
    try {
      const res = await fetch('/api/whatsapp/calling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState((prev) => (prev ? { ...prev, enabled: !next } : prev));
        toast.error(body.error ?? 'Could not update calling');
        return;
      }
      toast.success(next ? 'Calling enabled' : 'Calling disabled');
      // Re-read so status/visibility reflect Meta's canonical state.
      load();
    } catch {
      setState((prev) => (prev ? { ...prev, enabled: !next } : prev));
      toast.error('Could not update calling');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SettingsPanelHead
        title="Calling"
        description="Let customers call your WhatsApp number. Incoming calls are logged in the inbox. Answering calls in-app is coming in a later update."
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading calling settings…
        </div>
      ) : notConfigured ? (
        <Alert variant={notConfigured.reason === 'no_config' ? 'default' : 'destructive'}>
          <AlertTriangle className="size-4" />
          <AlertTitle>
            {notConfigured.reason === 'no_config'
              ? 'WhatsApp not connected'
              : notConfigured.reason === 'token_corrupted'
                ? 'Connection needs re-saving'
                : 'Calling not available'}
          </AlertTitle>
          <AlertDescription>
            {notConfigured.message}
            {notConfigured.reason === 'no_config' && (
              <>
                {' '}
                <Link href="/settings/whatsapp" className="underline">
                  Go to WhatsApp settings
                </Link>
                .
              </>
            )}
          </AlertDescription>
        </Alert>
      ) : state ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                    state.enabled
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {state.enabled ? (
                    <Phone className="size-4" />
                  ) : (
                    <PhoneOff className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {state.enabled
                      ? 'Calling is enabled'
                      : 'Calling is disabled'}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {state.enabled
                      ? 'Customers see a call button in the chat and can call you. Calls appear in the inbox.'
                      : 'Turn this on to show a call button in the chat so customers can call your number.'}
                  </p>
                </div>
              </div>
              <Switch
                checked={state.enabled}
                onCheckedChange={(v) => toggle(!!v)}
                disabled={!canEdit || saving}
                aria-label="Toggle calling"
              />
            </CardContent>
          </Card>

          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Only admins can change calling settings.
            </p>
          )}

          <Alert>
            <Phone className="size-4" />
            <AlertTitle>How inbound calling works today</AlertTitle>
            <AlertDescription>
              When a customer calls, the call rings on their side and is
              recorded in the conversation as an incoming/missed call.
              Picking up and talking from inside the app (the in-browser
              call screen) is a follow-up step — this first version turns
              on calling and captures the call history.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
