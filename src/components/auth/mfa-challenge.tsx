'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { OTP_LENGTH, mfaErrorMessage, normaliseOtp } from '@/lib/auth/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ============================================================
// The second step of signing in, for accounts with 2FA on.
//
// By the time this renders the password has already been accepted and a
// session exists — but at AAL1, which the middleware treats as not yet
// signed in. Nothing in the app is reachable until a code promotes it
// to AAL2, so this is a real gate and not a formality.
//
// It is a step inside /login rather than its own route: a separate page
// would be reachable directly, in a half-authenticated state, and would
// need its own guard against being opened out of order. Keeping it here
// means the only way in is through the password.
// ============================================================

export function MfaChallenge({
  factorId,
  onVerified,
  onCancel,
}: {
  /** The verified TOTP factor to challenge against. */
  factorId: string;
  /** Session is now AAL2 — the caller navigates on. */
  onVerified: () => void;
  /** Abandon the half-finished login and go back to the password form. */
  onCancel: () => void;
}) {
  const supabase = createClient();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const verify = async (submitted: string) => {
    if (submitted.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: submitted,
      });
      if (error) {
        setError(mfaErrorMessage(error.message));
        setCode('');
        inputRef.current?.focus();
        return;
      }
      onVerified();
    } finally {
      setVerifying(false);
    }
  };

  /** Signing out here matters: the AAL1 session is a real session, and
   *  leaving it behind would let a refresh land the browser back in a
   *  half-authenticated state with no obvious way forward. */
  const cancel = async () => {
    await supabase.auth.signOut().catch(() => {});
    onCancel();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="bg-primary-soft text-primary mb-5 inline-flex size-11 items-center justify-center rounded-xl">
          <ShieldCheck className="size-5" />
        </span>
        <h2 className="text-foreground text-3xl font-semibold tracking-tight">
          Enter your code
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Your password was correct. Open your authenticator app and enter the
          six-digit code for this account to finish signing in.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        className="flex flex-col gap-5"
      >
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mfa-code" className="text-foreground text-sm font-medium">
            Six-digit code
          </Label>
          <Input
            ref={inputRef}
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(e) => {
              const next = normaliseOtp(e.target.value);
              setCode(next);
              setError(null);
              // Auto-submit on the sixth digit. The code is only valid
              // for 30 seconds; making someone find a button with that
              // clock running is a way to fail the login twice.
              if (next.length === OTP_LENGTH) void verify(next);
            }}
            className="h-12 rounded-xl border-border bg-muted/40 text-center font-mono text-lg tracking-[0.4em] focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
          />
        </div>

        <Button
          type="submit"
          disabled={code.length !== OTP_LENGTH || verifying}
          className="mt-1 h-12 w-full rounded-xl text-sm font-semibold"
        >
          {verifying ? 'Verifying…' : 'Verify and sign in'}
        </Button>
      </form>

      <button
        type="button"
        onClick={cancel}
        className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
      >
        Use a different account
      </button>
    </div>
  );
}
