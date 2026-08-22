'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Loader2, ShieldCheck } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import {
  OTP_LENGTH,
  TOTP_FRIENDLY_NAME,
  clearUnverifiedFactors,
  mfaErrorMessage,
  normaliseOtp,
  readMfaStatus,
} from '@/lib/auth/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ============================================================
// Settings → Profile → Two-factor authentication.
//
// Enrol a TOTP factor, or remove one. The mechanics are Supabase's (see
// src/lib/auth/mfa.ts); this is the surface.
//
// Enrolment is a dialog rather than an inline expansion because it is
// modal in the real sense: there is a half-created factor on the server
// between opening and verifying, and the user has to either finish or
// abandon it. A dialog makes that a decision instead of something they
// can scroll away from and forget.
// ============================================================

type Enrolling = {
  factorId: string;
  /** SVG data URI from Supabase — render, do not re-encode. */
  qr: string;
  /** The same seed as text, for anyone who cannot scan. */
  secret: string;
};

export function TwoFactorCard() {
  const supabase = createClient();

  // null = still reading. Avoids the toggle flicking on after paint.
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [starting, setStarting] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const refresh = useCallback(async () => {
    const status = await readMfaStatus(supabase);
    setEnrolled(status.enrolled);
    setFactorId(status.factorId);
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Toggle on → create a factor and show its QR. Nothing is enforced
   *  until the code below it is verified. */
  const startEnrol = async () => {
    setStarting(true);
    setError(null);
    try {
      // Sweep abandoned attempts first, or the friendly name collides.
      await clearUnverifiedFactors(supabase);

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: TOTP_FRIENDLY_NAME,
      });
      if (error || !data) {
        toast.error(mfaErrorMessage(error?.message ?? 'Could not start setup'));
        return;
      }
      setCode('');
      setEnrolling({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setStarting(false);
    }
  };

  /** Confirm the user's app is producing the codes we expect. Only after
   *  this does the factor count as verified and start gating logins. */
  const verify = async (submitted: string) => {
    if (!enrolling || submitted.length !== OTP_LENGTH) return;
    setVerifying(true);
    setError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.factorId,
        code: submitted,
      });
      if (error) {
        setError(mfaErrorMessage(error.message));
        setCode('');
        return;
      }
      setEnrolling(null);
      await refresh();
      toast.success('Two-factor authentication is on');
    } finally {
      setVerifying(false);
    }
  };

  /** Abandoning the dialog leaves an unverified factor server-side.
   *  Clear it on the way out so the next attempt starts clean. */
  const cancelEnrol = async () => {
    const pending = enrolling;
    setEnrolling(null);
    setCode('');
    setError(null);
    if (pending) {
      await supabase.auth.mfa
        .unenroll({ factorId: pending.factorId })
        .catch(() => {});
    }
  };

  const disable = async () => {
    if (!factorId) return;
    setDisabling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error(mfaErrorMessage(error.message));
        return;
      }
      setDisableOpen(false);
      await refresh();
      toast.success('Two-factor authentication is off');
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = async () => {
    if (!enrolling) return;
    try {
      await navigator.clipboard.writeText(enrolling.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the code and copy it manually');
    }
  };

  return (
    <>
      <Card className="py-0">
        <CardContent className="px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-foreground flex items-center gap-2 text-sm font-medium">
                Two-factor authentication
                {enrolled && (
                  <span className="bg-primary-soft text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    <ShieldCheck className="size-3" />
                    On
                  </span>
                )}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Ask for a code from your authenticator app every time you sign
                in. Without it, a leaked password is enough to get into your
                account.
              </p>
            </div>

            {enrolled === null ? (
              <Loader2 className="text-muted-foreground mt-1 size-4 shrink-0 animate-spin" />
            ) : (
              <Switch
                checked={enrolled}
                disabled={starting}
                aria-label="Two-factor authentication"
                onCheckedChange={(on) => {
                  if (on) void startEnrol();
                  else setDisableOpen(true);
                }}
              />
            )}
          </div>

          {enrolled && (
            <p className="text-muted-foreground border-border mt-4 border-t pt-4 text-sm">
              Keep a backup of your authenticator app, or save its recovery
              codes somewhere safe. Losing the app means losing access to this
              account — an admin cannot sign in on your behalf.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Enrolment ── */}
      <Dialog
        open={enrolling !== null}
        onOpenChange={(open) => {
          if (!open) void cancelEnrol();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan this with Google Authenticator, Authy, 1Password, or any
              other TOTP app, then enter the six-digit code it shows.
            </DialogDescription>
          </DialogHeader>

          {enrolling && (
            <div className="flex flex-col gap-4">
              <div className="border-border flex justify-center rounded-xl border bg-white p-4">
                {/* Supabase returns the QR as an SVG data URI. Unoptimised
                    because it is already inline — there is no origin for
                    the image pipeline to fetch it from. */}
                <Image
                  src={enrolling.qr}
                  alt="Two-factor setup QR code"
                  width={200}
                  height={200}
                  unoptimized
                  className="size-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Can&apos;t scan? Enter this key instead
                </Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted/50 border-border min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-xs">
                    {enrolling.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copySecret}
                    aria-label="Copy setup key"
                    className="size-9 shrink-0"
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totp-code" className="text-sm font-medium">
                  Six-digit code
                </Label>
                <Input
                  id="totp-code"
                  // `inputMode` so phones open the number pad;
                  // `one-time-code` so password managers and iOS offer the
                  // code they can already see.
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    const next = normaliseOtp(e.target.value);
                    setCode(next);
                    setError(null);
                    // Submit as soon as it is complete — nobody wants to
                    // reach for a button with a 30-second clock running.
                    if (next.length === OTP_LENGTH) void verify(next);
                  }}
                  className="h-12 text-center font-mono text-lg tracking-[0.4em]"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelEnrol}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={code.length !== OTP_LENGTH || verifying}
              onClick={() => void verify(code)}
            >
              {verifying && <Loader2 className="size-4 animate-spin" />}
              {verifying ? 'Verifying…' : 'Turn on'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Turning it off ── */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Turn off two-factor authentication?</DialogTitle>
            <DialogDescription>
              Your account will be protected by its password alone. Anyone who
              obtains that password will be able to sign in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisableOpen(false)}
            >
              Keep it on
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabling}
              onClick={disable}
            >
              {disabling && <Loader2 className="size-4 animate-spin" />}
              {disabling ? 'Turning off…' : 'Turn off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
