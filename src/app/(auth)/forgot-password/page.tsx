"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rememberOAuthNext } from "@/lib/auth/oauth-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { BrandLogo } from "@/components/brand/logo";
import { AuthLegalLinks } from "@/components/auth/legal-notice";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";

// ============================================================
// Password recovery, by six-digit code.
//
// Three steps on one page — email → code → new password — rather than an
// emailed link the user has to open in whatever browser their mail app
// decides to use. That handoff is where the old flow lost people: a link
// opened in the Gmail in-app browser lands in a session that isn't the
// one they were typing in.
//
// Supabase sends the code from the same `resetPasswordForEmail` call as
// before; what makes it a code rather than a link is the Reset Password
// email template containing `{{ .Token }}`. `verifyOtp({ type:
// 'recovery' })` then returns a real session, which is what lets
// <NewPasswordForm> just call `updateUser`.
//
// `redirectTo` is still passed so that a template which also keeps
// `{{ .ConfirmationURL }}` has somewhere sane to land (/reset-password).
// ============================================================

const CODE_LENGTH = 6;
/** Supabase's own per-email resend limit is 60s by default; sit just
 *  inside it so the button doesn't invite a request the server refuses. */
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

  const sendCode = async (address: string) => {
    // The destination for the link variant travels in a cookie, not on
    // the redirect URL — a query string there has to be in Supabase's
    // Redirect URLs allow-list separately (see lib/auth/oauth-next.ts).
    rememberOAuthNext("/reset-password");
    return supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
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
                <div className="group relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="code"
                    // `inputMode` gets the numeric keypad on mobile;
                    // `one-time-code` lets iOS and Android offer the code
                    // straight from the notification.
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="000000"
                    value={code}
                    onChange={(e) =>
                      setCode(
                        e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH),
                      )
                    }
                    required
                    // `pr-11` matches `pl-11` so the digits sit on the
                    // true centre — with padding on one side only, the
                    // tracking pushes them visibly right.
                    className="h-12 rounded-xl border-border bg-muted/40 pr-11 pl-11 text-center text-lg font-semibold tracking-[0.4em] text-foreground placeholder:font-normal placeholder:tracking-[0.4em] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                  />
                </div>
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
