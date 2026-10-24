'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MessageSquareOff,
  Smartphone,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DiscoveredNumber } from '@/lib/whatsapp/connect-flow';
import { WhatsAppLogo } from '@/components/inbox/channel-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  embeddedSignupAvailable as facebookAvailable,
  useEmbeddedSignup,
  type EmbeddedSignupFailure,
  type EmbeddedSignupPhase,
} from './use-embedded-signup';

// ============================================================
// Connecting a WhatsApp number, as steps a non-developer can follow:
// get ready → say whether the number is new to the Cloud API →
// connect → start messaging. Everything technical
// (IDs, webhook subscription, registration, the two-step PIN) happens
// on the server; the person only logs in to Facebook — or, if they
// already run the Cloud API themselves, pastes one token.
// ============================================================

const STEPS = ['Get ready', 'Your setup', 'Connect', 'Start messaging'] as const;

/** Index of the last step — where the connected page's banner sits. */
export const START_MESSAGING_STEP = STEPS.length - 1;

/** The step indicator, shared with the connected page's "you're live" banner. */
export function ConnectStepper({ current, complete = false }: { current: number; complete?: boolean }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Connection steps">
      {STEPS.map((label, i) => {
        const done = complete || i < current;
        const active = !complete && i === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none sm:gap-3">
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary bg-primary/10 text-primary',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-sm',
                active || done ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn('hidden h-px min-w-4 flex-1 sm:block', done ? 'bg-primary' : 'bg-border')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Facebook's "f" — lucide's brand icons are deprecated. */
function FacebookMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07"
      />
    </svg>
  );
}

const REQUIREMENTS = [
  {
    icon: UserRound,
    title: 'A Facebook account',
    body: 'You log in with it. If your business has no Meta business portfolio yet, you can create one on the way.',
  },
  {
    icon: Smartphone,
    title: 'A phone number for your business',
    body: 'It has to receive a verification code by SMS or a phone call.',
  },
  {
    icon: MessageSquareOff,
    title: 'Not in use on the WhatsApp app',
    body: 'A number on the WhatsApp or WhatsApp Business app can’t be connected. Delete that WhatsApp account first, or use another number.',
  },
  {
    icon: BadgeCheck,
    title: 'Your business name',
    body: 'The display name customers see. It should match your business — Meta reviews it.',
  },
];

function GetReady({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Before you start</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Have these ready. Connecting takes about five minutes.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {REQUIREMENTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">{title}</span>
              <span className="block text-sm leading-relaxed text-muted-foreground">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href="/docs/connect-whatsapp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Read the step-by-step guide
          <ExternalLink className="size-3.5" />
        </a>
        <Button onClick={onNext}>
          I&rsquo;m ready
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Your setup: new to the Cloud API, or already on it
// ------------------------------------------------------------

type ConnectMethod = 'facebook' | 'token';

const SETUP_OPTIONS: {
  method: ConnectMethod;
  icon: typeof Sparkles;
  title: string;
  body: string;
  need: string;
}[] = [
  {
    method: 'facebook',
    icon: Sparkles,
    title: 'I’m new to the WhatsApp Cloud API',
    body: 'First time putting this number on the API. Log in with Facebook and Meta creates your WhatsApp Business Account and verifies your number — Dripo does the rest.',
    need: 'You’ll need: your Facebook login',
  },
  {
    method: 'token',
    icon: KeyRound,
    title: 'I already use the WhatsApp Cloud API',
    body: 'Your number already runs on the Cloud API through your own Meta app. Paste an access token and Dripo finds your numbers.',
    need: 'You’ll need: a system-user access token',
  },
];

function ChooseSetup({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: ConnectMethod | null;
  onChange: (method: ConnectMethod) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Is your number already on the WhatsApp Cloud API?
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Not sure? Pick the first one — it&rsquo;s how most businesses start.
        </p>
      </div>

      <div role="radiogroup" aria-label="Your setup" className="grid gap-3 sm:grid-cols-2">
        {SETUP_OPTIONS.map(({ method, icon: Icon, title, body, need }) => {
          const unavailable = method === 'facebook' && !facebookAvailable;
          const selected = value === method;
          return (
            <label
              key={method}
              className={cn(
                'flex flex-col gap-3 rounded-lg border p-4 transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring',
                selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border',
                unavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/40',
              )}
            >
              <input
                type="radio"
                name="wa-setup"
                value={method}
                checked={selected}
                disabled={unavailable}
                onChange={() => onChange(method)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                {selected ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : method === 'facebook' && !unavailable ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Recommended
                  </span>
                ) : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{body}</span>
              </span>
              <span className="mt-auto text-xs font-medium text-muted-foreground">
                {unavailable ? 'Not available right now' : need}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!value}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Connect with Facebook
// ------------------------------------------------------------

const FACEBOOK_PROGRESS = [
  { key: 'login', label: 'Log in to Facebook and verify your number' },
  { key: 'exchange', label: 'Get permission to manage your WhatsApp' },
  { key: 'account', label: 'Find your WhatsApp Business Account' },
  { key: 'number', label: 'Check your phone number' },
  { key: 'subscribe', label: 'Send incoming messages to Dripo' },
  { key: 'register', label: 'Register your number with Meta' },
  { key: 'save', label: 'Save the connection securely' },
] as const;

/**
 * The server does steps 2–7 in one request, so while it runs the list
 * advances on a timer; when it answers, the list shows the truth — all
 * done, or the step the server says failed.
 */
function FacebookProgress({
  phase,
  failure,
}: {
  phase: EmbeddedSignupPhase;
  failure: EmbeddedSignupFailure | null;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (phase !== 'finishing') return;
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, [phase]);

  const last = FACEBOOK_PROGRESS.length - 1;
  const failedAt =
    phase === 'failed'
      ? Math.max(0, FACEBOOK_PROGRESS.findIndex((s) => s.key === (failure?.step ?? 'login')))
      : -1;
  const activeAt =
    phase === 'login' ? 0 : phase === 'finishing' ? Math.min(1 + tick, last) : phase === 'done' ? last + 1 : -1;

  return (
    <ol className="space-y-2.5">
      {FACEBOOK_PROGRESS.map((s, i) => {
        const failed = i === failedAt;
        const done = failedAt >= 0 ? i < failedAt : i < activeAt;
        const active = failedAt < 0 && i === activeAt;
        return (
          <li key={s.key} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                'mt-px flex size-5 shrink-0 items-center justify-center rounded-full',
                done && 'bg-primary text-primary-foreground',
                failed && 'bg-red-600 text-white',
                active && 'text-primary',
                !done && !failed && !active && 'border border-border',
              )}
            >
              {done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : failed ? (
                <X className="size-3" strokeWidth={3} />
              ) : active ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  done || active || failed ? 'text-foreground' : 'text-muted-foreground',
                  failed && 'font-medium',
                )}
              >
                {s.label}
              </span>
              {active && i === 0 && (
                <span className="block text-xs text-muted-foreground">
                  Finish the steps in the Facebook window. Keep this tab open.
                </span>
              )}
              {failed && failure && (
                <span className="block text-xs leading-relaxed text-red-700">{failure.message}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ConnectWithFacebook({ onConnected, onBack }: { onConnected: () => void; onBack: () => void }) {
  const { phase, failure, launch } = useEmbeddedSignup({ onConnected });
  // Remounts the progress list per attempt so its timer starts over.
  const [attempt, setAttempt] = useState(0);
  const busy = phase === 'login' || phase === 'finishing';

  function start() {
    setAttempt((a) => a + 1);
    void launch();
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Connect with Facebook</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A Facebook window opens. Choose your business, add your number and type in the
          code Meta sends you. Dripo does the rest.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-6">
        <div className="flex items-center gap-4" aria-hidden>
          <span className="flex size-11 items-center justify-center rounded-full bg-[#1877F2] text-white">
            <FacebookMark className="size-6" />
          </span>
          <span className="h-px w-8 bg-border" />
          <WhatsAppLogo className="size-11" />
        </div>
        <Button
          onClick={start}
          disabled={busy}
          className="h-10 bg-[#1877F2] px-5 text-white hover:bg-[#1877F2]/90"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FacebookMark className="size-4" />}
          {phase === 'login'
            ? 'Waiting for Facebook…'
            : phase === 'finishing'
              ? 'Setting up your number…'
              : phase === 'failed'
                ? 'Try again'
                : 'Continue with Facebook'}
        </Button>
        {phase === 'idle' && (
          <p className="text-center text-xs text-muted-foreground">
            Pop-up blocked? Allow pop-ups for this site and click again.
          </p>
        )}
      </div>

      {phase !== 'idle' && <FacebookProgress key={attempt} phase={phase} failure={failure} />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Connect with an access token
// ------------------------------------------------------------

function numberStatusLabel(status: string | null): { label: string; tone: 'ok' | 'muted' | 'warn' } {
  switch (status) {
    case 'CONNECTED':
      return { label: 'Active', tone: 'ok' };
    case 'PENDING':
      return { label: 'Not registered yet', tone: 'muted' };
    case null:
      return { label: 'Unknown', tone: 'muted' };
    default:
      return { label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), tone: 'warn' };
  }
}

function ConnectWithToken({ onConnected, onBack }: { onConnected: () => void; onBack: () => void }) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  // Some tokens (a system user's, usually) can't name their WhatsApp
  // account; the lookup then asks for its ID and looks inside it.
  const [needsWabaId, setNeedsWabaId] = useState(false);
  const [wabaId, setWabaId] = useState('');
  const [numbers, setNumbers] = useState<DiscoveredNumber[] | null>(null);
  const [sameApp, setSameApp] = useState<boolean | null>(null);
  const [selected, setSelected] = useState('');
  const [connecting, setConnecting] = useState(false);

  async function findNumbers() {
    setFinding(true);
    setFindError(null);
    setNumbers(null);
    try {
      const res = await fetch('/api/whatsapp/config/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token.trim(),
          ...(needsWabaId && wabaId.trim() ? { waba_id: wabaId.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFindError(data.error || 'Could not look up numbers for that token.');
        if (data.code === 'no_waba') setNeedsWabaId(true);
        return;
      }
      const found = (data.numbers ?? []) as DiscoveredNumber[];
      setNumbers(found);
      setSameApp(typeof data.sameApp === 'boolean' ? data.sameApp : null);
      setSelected(found.length === 1 ? found[0].phoneNumberId : '');
    } catch {
      setFindError('Could not reach Dripo. Check your connection and try again.');
    } finally {
      setFinding(false);
    }
  }

  async function connect() {
    const number = numbers?.find((n) => n.phoneNumberId === selected);
    if (!number) return;
    setConnecting(true);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token.trim(),
          phone_number_id: number.phoneNumberId,
          waba_id: number.wabaId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not connect that number.', { duration: 10000 });
        return;
      }
      // Saved. If Meta still wants the number's own PIN, the connected
      // page asks for it — with the stored token, no re-paste.
      onConnected();
    } catch {
      toast.error('Could not reach Dripo. Check your connection and try again.');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Connect with an access token</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          For businesses already on the WhatsApp Cloud API. Paste a system-user access
          token and Dripo finds your numbers — no IDs to copy.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-token">Access token</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Input
              id="wa-token"
              type={showToken ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="EAAG…"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setNumbers(null);
                setFindError(null);
                setNeedsWabaId(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && token.trim() && !finding) void findNumbers();
              }}
              className="h-10 pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button onClick={findNumbers} disabled={!token.trim() || finding} className="h-10">
            {finding && <Loader2 className="size-4 animate-spin" />}
            Find my numbers
          </Button>
        </div>
        {findError && <p className="text-sm text-red-700">{findError}</p>}
      </div>

      {needsWabaId && (
        <div className="space-y-2">
          <Label htmlFor="wa-waba-id">WhatsApp Business Account ID</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="wa-waba-id"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="1234567890123456"
              value={wabaId}
              onChange={(e) => {
                setWabaId(e.target.value);
                setNumbers(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && wabaId.trim() && !finding) void findNumbers();
              }}
              className="h-10 flex-1 font-mono text-sm"
            />
            <Button onClick={findNumbers} disabled={!wabaId.trim() || finding} className="h-10">
              {finding && <Loader2 className="size-4 animate-spin" />}
              Find numbers
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            In Meta Business Settings → Accounts → WhatsApp accounts, under the account&apos;s name.
          </p>
        </div>
      )}

      <details className="group rounded-lg border border-border px-4 py-3 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
          Where do I get a token?
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>
            In{' '}
            <a
              href="https://business.facebook.com/settings/system-users"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              Meta Business Settings → System users
            </a>
            , add a system user with the Admin role.
          </li>
          <li>Click <strong className="text-foreground">Assign assets</strong>, pick your WhatsApp account and give it full control.</li>
          <li>
            Click <strong className="text-foreground">Generate new token</strong>, choose your app, set
            expiry to <strong className="text-foreground">Never</strong>, and tick{' '}
            <code>whatsapp_business_management</code>, <code>whatsapp_business_messaging</code>{' '}
            and <code>business_management</code>.
          </li>
          <li>Copy the token and paste it above.</li>
        </ol>
      </details>

      {numbers && (
        <div className="space-y-2">
          <Label>Choose the number to connect</Label>
          <div role="radiogroup" className="divide-y divide-border rounded-lg border border-border">
            {numbers.map((n) => {
              const status = numberStatusLabel(n.status);
              return (
                <label
                  key={n.phoneNumberId}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="wa-number"
                    value={n.phoneNumberId}
                    checked={selected === n.phoneNumberId}
                    onChange={() => setSelected(n.phoneNumberId)}
                    className="accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{n.displayPhoneNumber}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[n.verifiedName, n.wabaName].filter(Boolean).join(' · ') || 'WhatsApp Business Account'}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs',
                      status.tone === 'ok' && 'bg-emerald-50 text-emerald-700',
                      status.tone === 'muted' && 'bg-muted text-muted-foreground',
                      status.tone === 'warn' && 'bg-amber-50 text-amber-800',
                    )}
                  >
                    {status.label}
                  </span>
                </label>
              );
            })}
          </div>
          {sameApp === false && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                This token comes from a different Meta app. Dripo can send messages with it,
                but customers&rsquo; replies won&rsquo;t reach your inbox.
                {facebookAvailable && ' For two-way messaging, connect with Facebook instead.'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant="ghost" onClick={onBack} disabled={connecting}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={connect} disabled={!selected || connecting}>
          {connecting && <Loader2 className="size-4 animate-spin" />}
          Connect this number
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------

export function WhatsAppConnectWizard({ onConnected }: { onConnected: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  // Without the Meta app configured, the token is the only way in, so
  // it starts picked.
  const [method, setMethod] = useState<ConnectMethod | null>(facebookAvailable ? null : 'token');

  return (
    <div className="max-w-2xl space-y-6">
      <ConnectStepper current={step} />
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        {step === 0 ? (
          <GetReady onNext={() => setStep(1)} />
        ) : step === 1 || !method ? (
          <ChooseSetup value={method} onChange={setMethod} onBack={() => setStep(0)} onNext={() => setStep(2)} />
        ) : method === 'facebook' ? (
          <ConnectWithFacebook onConnected={onConnected} onBack={() => setStep(1)} />
        ) : (
          <ConnectWithToken onConnected={onConnected} onBack={() => setStep(1)} />
        )}
      </div>
    </div>
  );
}
