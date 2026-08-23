"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { BrandLogo } from "@/components/brand/logo";
import { AuthLegalLinks } from "@/components/auth/legal-notice";
import { NewPasswordForm } from "@/components/auth/new-password-form";
// The same six boxes the signup verification step uses. Shared so
// the two code screens cannot drift apart in behaviour — paste
// handling, backspace and autofill are fiddly enough to get right
// once.
import { OtpInput } from "@/components/auth/otp-input";
import { ArrowLeft, Mail } from "lucide-react";

// ============================================================
// Password recovery, by six-digit code.
//
// Three steps on one page — email → code → new password — rather than an
// emailed link the user has to open in whatever browser their mail app
// decides to use. That handoff is where the old flow lost people: a link
// opened in the Gmail in-app browser lands in a session that isn't the
// one they were typing in.
//
// The code is Supabase's, the email is ours. /api/auth/password-reset
// asks the Admin API to mint a recovery token and hand back its OTP
// without sending anything, then posts it through DeoMail from the
// app's own verified domain. Supabase's Reset Password template and its
// built-in SMTP are no longer in the path — and neither is the
// `{{ .Token }}` placeholder that used to be load-bearing here.
//
// Nothing below that changes: `verifyOtp({ type: 'recovery' })` still
// takes the same code and still returns a real session, which is what
// lets <NewPasswordForm> just call `updateUser`.
//
// The reply is identical whether or not the address is registered, so
// "Send code" always advances to the code step. That is the same
// posture `resetPasswordForEmail` took, and it is deliberate: this
// screen is unauthenticated, and a truthful answer would confirm which
// addresses have accounts.
// ============================================================

/**
 * How many digits the code has — one box each.
 *
 * This has to match Supabase's "Email OTP Length" (Authentication →
 * Providers → Email). That setting decides what the code actually
 * is; this constant only says how many boxes to draw and when the
 * code counts as complete.
 *
 * They were out of step once — 6 here against 8 there — and the old
 * single field hid it: it quietly dropped the last two digits and
 * its submit button never enabled, so the code could not be entered
 * at all. Boxes make the next mismatch obvious instead of silent,
 * because six boxes under an eight-digit code is visible on sight.
 */
const CODE_LENGTH = 6;
/** A courtesy cooldown, not the enforcement — the route rate-limits per
 *  address and per caller regardless of what this button allows. */
const RESEND_SECONDS = 60;

type Step = "email" | "code" | "password";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  /**
   * Returns `{ error }` rather than throwing, to keep the two call sites
   * below shaped exactly as they were when this was a Supabase call.
   *
   * A non-OK response is a real fault worth showing — the transport is
   * unconfigured, or the caller is rate limited. "No such user" is not
   * among them: the route answers that with the same 200 as a success.
   */
  const sendCode = async (
    address: string,
  ): Promise<{ error: { message: string } | null }> => {
    let res: Response;
    try {
      res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
    } catch {
      return { error: { message: "Network error — please try again." } };
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        error: {
          message:
            body?.error ??
            (res.status === 429
              ? "Too many attempts. Try again in a few minutes."
              : "Could not send the code — please try again."),
        },
      };
    }

    return { error: null };
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const { error } = await sendCode(email);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setStep("code");
    setCooldown(RESEND_SECONDS);
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);

    const { error } = await sendCode(email);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNotice("We've sent a new code.");
    setCooldown(RESEND_SECONDS);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    // A recovery OTP verifies into a full session, which is what the
    // password step then updates.
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    });
    setLoading(false);

    if (error) {
      setError(
        /expired|invalid/i.test(error.message)
          ? "That code is invalid or has expired. Request a new one."
          : error.message,
      );
      return;
    }

    setStep("password");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 flex items-center">
            <BrandLogo priority className="h-8" />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              {step === "password" ? "Choose a new password" : "Reset password"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {step === "email" &&
                "Enter your email and we'll send you a six-digit code."}
              {step === "code" && (
                <>
                  Enter the six-digit code we sent to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                </>
              )}
              {step === "password" &&
                "Your identity is confirmed. Set the password you'll sign in with from now on."}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-5 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {notice}
            </div>
          )}

          {step === "email" && (
            <form onSubmit={handleSendCode} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Email
                </Label>
                <div className="group relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-1 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send code"}
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerify} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="code"
                  className="text-sm font-medium text-foreground"
                >
                  Six-digit code
                </Label>
                <OtpInput
                  id="code"
                  value={code}
                  // Clear the rejection as soon as they start
                  // correcting it, so the boxes are not still red
                  // underneath a fresh code.
                  onChange={(v) => {
                    setCode(v);
                    if (error) setError(null);
                  }}
                  length={CODE_LENGTH}
                  disabled={loading}
                  autoFocus
                  invalid={!!error}
                />
              </div>

              <Button
                type="submit"
                disabled={loading || code.length < CODE_LENGTH}
                className="mt-1 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify code"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setNotice(null);
                  }}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Use another email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="font-medium text-primary transition-colors hover:text-primary/80 disabled:text-muted-foreground"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {step === "password" && <NewPasswordForm />}

          <Link
            href="/login"
            className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          <AuthLegalLinks />
        </div>
      </main>

      <AuthBrandPanel />
    </div>
  );
}
