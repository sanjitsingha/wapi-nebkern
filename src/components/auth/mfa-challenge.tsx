'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { isCompleteOtp, mfaErrorMessage } from '@/lib/auth/mfa';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/ui/otp-input';

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
  // Bumped on every rejection, and used as the field's `key`.
  //
  // Emptying `code` is not enough on its own: after six digits the
  // caret sits in the LAST box, so the next keystroke would land at
  // position six of an empty code. Remounting puts the caret back in
  // box one, which is where a retyped code has to start.
  const [attempt, setAttempt] = useState(0);

  const verify = async (submitted: string) => {
    if (!isCompleteOtp(submitted) || verifying) return;
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
        setAttempt((n) => n + 1);
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

        <div className="flex flex-col gap-2">
          {/* A plain label, not `htmlFor` — the field is six inputs, and
              pointing the label at any one of them would be a lie. The
              group carries its own accessible name via aria-label. */}
          <Label className="text-foreground text-sm font-medium">
            Six-digit code
          </Label>
          <OtpInput
            key={attempt}
            value={code}
            invalid={error !== null}
            disabled={verifying}
            autoFocus
            ariaLabel="Six-digit authentication code"
            onChange={(next) => {
              setCode(next);
              setError(null);
            }}
            // Auto-submit on the sixth digit. The code is only valid for
            // 30 seconds; making someone find a button with that clock
            // running is a way to fail the login twice.
            onComplete={(full) => void verify(full)}
          />
        </div>

        <Button
          type="submit"
          disabled={!isCompleteOtp(code) || verifying}
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
