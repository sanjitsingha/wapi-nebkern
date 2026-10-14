'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Inbox,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { WhatsAppLogo } from '@/components/inbox/channel-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WhatsAppConfig } from '@/types';
import { ConnectStepper, START_MESSAGING_STEP } from './whatsapp-connect-wizard';
import { embeddedSignupAvailable, useEmbeddedSignup } from './use-embedded-signup';

export interface PhoneInfo {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
}

export interface ConnectionHealth {
  /** `unknown` until GET /api/whatsapp/config answers. */
  status: 'connected' | 'disconnected' | 'unknown';
  /** The stored token can't be decrypted — only a fresh connect fixes it. */
  tokenCorrupted: boolean;
  message: string;
}

type RegistrationProbe = {
  live: boolean;
  checks: Record<string, boolean | null>;
  errors?: string[];
};

/** The diagnostic's check keys, said the way a person would. */
const CHECK_LABELS: Record<string, string> = {
  config_exists: 'Connection saved',
  token_decryptable: 'Access key readable',
  phone_metadata_ok: 'Number found on Meta',
  waba_subscribed_to_app: 'Incoming messages sent to Instant',
  locally_marked_registered: 'Number registered with Meta',
};

// Our own wording from lib/whatsapp/connect-flow.ts, so a reload still
// knows the last attempt stopped at the number's PIN.
const PIN_ERROR = /two-step verification PIN/i;

export function WhatsAppConnected({
  config,
  phoneInfo,
  health,
  justConnected,
  canEdit,
  onChanged,
  onDisconnected,
}: {
  config: WhatsAppConfig;
  phoneInfo: PhoneInfo | null;
  health: ConnectionHealth;
  justConnected: boolean;
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
  onDisconnected: () => void;
}) {
  const reconnect = useEmbeddedSignup({ onConnected: () => void onChanged() });
  const [finishing, setFinishing] = useState(false);
  const [pin, setPin] = useState('');
  const [pinAsked, setPinAsked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [probe, setProbe] = useState<RegistrationProbe | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const registered = Boolean(config.registered_at);
  const lastError = config.last_registration_error ?? null;
  const needsPin = pinAsked || (lastError != null && PIN_ERROR.test(lastError));
  const unreachable = health.status === 'disconnected';
  const number = phoneInfo?.display_phone_number ?? null;
  const waDigits = number?.replace(/\D/g, '') ?? '';
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '';

  const state: { label: string; tone: 'ok' | 'warn' | 'bad' } = unreachable
    ? { label: 'Can’t reach Meta', tone: 'bad' }
    : registered
      ? { label: 'Live', tone: 'ok' }
      : { label: 'One more step', tone: 'warn' };

  async function finishSetup() {
    setFinishing(true);
    try {
      const res = await fetch('/api/whatsapp/config/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pin ? { pin } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not finish the setup.');
        return;
      }
      if (data.registered) {
        toast.success('Done — your number now receives messages in Instant.');
        setPin('');
        setPinAsked(false);
      } else if (data.needs_pin) {
        setPinAsked(true);
        toast.error(data.error, { duration: 10000 });
      } else if (data.skipped) {
        toast.message('Your number is already active on Meta. Send it a test message — if it reaches your inbox, you’re all set.', {
          duration: 10000,
        });
      } else {
        toast.error(data.error || 'Meta didn’t register the number.', { duration: 10000 });
      }
      await onChanged();
    } catch {
      toast.error('Could not reach Instant. Check your connection and try again.');
    } finally {
      setFinishing(false);
    }
  }

  async function checkConnection() {
    setChecking(true);
    setProbe(null);
    try {
      const res = await fetch('/api/whatsapp/config/verify-registration');
      const data = (await res.json()) as RegistrationProbe;
      setProbe(data);
      if (data.live) toast.success('All good — Meta is delivering messages to Instant.');
      await onChanged();
    } catch {
      toast.error('Could not run the check. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        'Disconnect this WhatsApp number from Instant? Your conversations and contacts stay, but nothing new is sent or received until you connect again.',
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not disconnect the number.');
        return;
      }
      toast.success('WhatsApp number disconnected.');
      onDisconnected();
    } catch {
      toast.error('Could not reach Instant. Check your connection and try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  function copyWebhookUrl() {
    void navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied');
  }

  const reconnecting = reconnect.phase === 'login' || reconnect.phase === 'finishing';

  return (
    <div className="max-w-2xl space-y-5">
      {justConnected && (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
          <ConnectStepper current={START_MESSAGING_STEP} complete={registered} />
          <p className="text-sm text-emerald-900">
            {registered
              ? 'Your number is connected. Send it a test message below to see it arrive.'
              : 'Your number is connected. One more step below and it starts receiving messages.'}
          </p>
        </div>
      )}

      {/* The number */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <WhatsAppLogo className="size-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">
              {number ?? 'Your WhatsApp number'}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {phoneInfo?.verified_name ?? (health.status === 'unknown' ? 'Checking with Meta…' : 'WhatsApp Business')}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              state.tone === 'ok' && 'bg-emerald-50 text-emerald-700',
              state.tone === 'warn' && 'bg-amber-50 text-amber-800',
              state.tone === 'bad' && 'bg-red-50 text-red-700',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                state.tone === 'ok' && 'bg-emerald-500',
                state.tone === 'warn' && 'bg-amber-500',
                state.tone === 'bad' && 'bg-red-500',
              )}
            />
            {state.label}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={checkConnection} disabled={checking}>
            {checking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Check connection
          </Button>
          <span className="text-xs text-muted-foreground">
            {registered && config.registered_at
              ? `Receiving messages since ${new Date(config.registered_at).toLocaleDateString()}`
              : 'Runs a quick check with Meta'}
          </span>
        </div>

        {probe && (
          <ul className="mt-3 space-y-1.5 rounded-lg bg-muted/40 px-3.5 py-3 text-sm">
            {Object.entries(probe.checks).map(([key, ok]) => (
              <li key={key} className="flex items-center gap-2">
                {ok === true ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                ) : ok === false ? (
                  <XCircle className="size-4 shrink-0 text-red-600" />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border border-border" />
                )}
                <span className="text-foreground">{CHECK_LABELS[key] ?? key}</span>
              </li>
            ))}
            {(probe.errors ?? []).map((e) => (
              <li key={e} className="pl-6 text-xs leading-relaxed text-red-700">
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Can't reach Meta: the token is gone or revoked — reconnecting replaces it. */}
      {unreachable && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-medium text-red-900">Instant can&rsquo;t reach this number</p>
                <p className="mt-1 text-sm leading-relaxed text-red-800">
                  {health.tokenCorrupted
                    ? 'The saved access key can’t be read any more. Connect the number again to replace it.'
                    : 'Meta turned down the saved access key — it may have been revoked or expired. Connect again to refresh it.'}
                </p>
                {!health.tokenCorrupted && health.message && (
                  <p className="mt-1.5 text-xs text-red-700/80">{health.message}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {embeddedSignupAvailable && (
                    <Button
                      onClick={() => void reconnect.launch()}
                      disabled={reconnecting}
                      className="bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
                    >
                      {reconnecting && <Loader2 className="size-4 animate-spin" />}
                      Reconnect with Facebook
                    </Button>
                  )}
                  <Button variant="outline" onClick={disconnect} disabled={disconnecting}>
                    Disconnect and start over
                  </Button>
                </div>
              )}
              {reconnect.phase === 'failed' && reconnect.failure && (
                <p className="text-sm text-red-700">{reconnect.failure.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved but not registered: one click, or the number's PIN. */}
      {!unreachable && !registered && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-medium text-amber-950">One more step: switch on incoming messages</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">
                  {needsPin
                    ? 'This number already has a two-step verification PIN. Enter it so Meta hands the number over to Instant.'
                    : lastError
                      ? `Meta stopped the last attempt: “${lastError}”`
                      : 'You can already send messages. To receive replies, Meta needs to register the number with Instant.'}
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {needsPin && (
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6-digit PIN"
                      aria-label="Two-step verification PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-9 w-36 bg-white tracking-widest"
                    />
                  )}
                  <Button onClick={finishSetup} disabled={finishing || (needsPin && pin.length !== 6)}>
                    {finishing && <Loader2 className="size-4 animate-spin" />}
                    Finish setup
                  </Button>
                </div>
              )}
              {needsPin && (
                <p className="text-xs leading-relaxed text-amber-900/80">
                  Forgot it? Reset it in{' '}
                  <a
                    href="https://business.facebook.com/wa/manage/phone-numbers/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    WhatsApp Manager
                  </a>{' '}
                  → your number → Two-step verification, then enter the new one here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Try it */}
      {!unreachable && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-medium text-foreground">Send a test message</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            From your personal phone, send &ldquo;Hi&rdquo; to {number ?? 'your business number'}. It
            shows up in your inbox within a few seconds.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {waDigits && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={`https://wa.me/${waDigits}?text=Hi`} target="_blank" rel="noopener noreferrer" />}
              >
                <WhatsAppLogo className="size-3.5" />
                Open in WhatsApp
              </Button>
            )}
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/inbox" />}>
              <Inbox className="size-3.5" />
              Go to inbox
            </Button>
          </div>
        </div>
      )}

      {/* For support conversations — nothing here needs editing. */}
      <details className="group rounded-xl border border-border bg-card px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
          Technical details
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[180px_1fr]">
          <dt className="text-muted-foreground">Phone number ID</dt>
          <dd className="font-mono text-foreground">{config.phone_number_id}</dd>
          <dt className="text-muted-foreground">WhatsApp Business Account ID</dt>
          <dd className="font-mono text-foreground">{config.waba_id || '—'}</dd>
          <dt className="text-muted-foreground">Connected</dt>
          <dd className="text-foreground">
            {config.connected_at ? new Date(config.connected_at).toLocaleString() : '—'}
          </dd>
          <dt className="text-muted-foreground">Webhook URL</dt>
          <dd className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-xs text-foreground">{webhookUrl}</span>
            <button
              type="button"
              onClick={copyWebhookUrl}
              aria-label="Copy webhook URL"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Copy className="size-3.5" />
            </button>
          </dd>
        </dl>
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Meta&rsquo;s WhatsApp Cloud API docs
          <ExternalLink className="size-3" />
        </a>
      </details>

      {canEdit && !unreachable && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={disconnect}
            disabled={disconnecting}
            className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline disabled:opacity-50"
          >
            {disconnecting && <Loader2 className="size-3.5 animate-spin" />}
            Disconnect this number
          </button>
        </div>
      )}
    </div>
  );
}
