"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { GoogleAuthButton, AuthDivider } from "@/components/auth/google-button";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { rememberOAuthNext } from "@/lib/auth/oauth-next";
import { firstPasswordError } from "@/lib/auth/password";
import {
  MessageSquare,
  CheckCircle,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → email
  // verification → redirect round-trip. `emailRedirectTo` below
  // points back at /join/<token> so the user lands on the redeem
  // step after verifying instead of being dropped on /dashboard.
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // Which provider already owns this address, when it's taken. Drives
  // the follow-up CTA in the error banner — "Sign in" for a password
  // account, "Continue with Google" for a Google one — so a blocked
  // signup ends somewhere useful instead of just being refused.
  const [conflict, setConflict] = useState<"google" | "password" | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const supabase = createClient();

  /**
   * Ask the server whether `value` is free. Returns the conflict
   * message when it isn't, null when it is (or when the check itself
   * failed — an advisory lookup must never block registration; signUp
   * is re-checked below and GoTrue owns uniqueness regardless).
   */
  const checkEmailAvailable = async (value: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.available !== false) {
        setConflict(null);
        return null;
      }
      setConflict(body.provider === "google" ? "google" : "password");
      return body.message ?? "An account with this email already exists.";
    } catch {
      setConflict(null);
      return null;
    }
  };

  // Check on blur so the user learns the address is taken before
  // filling in two password fields, not after.
  const handleEmailBlur = async () => {
    const value = email.trim();
    if (!value || loading) return;
    setCheckingEmail(true);
    const message = await checkEmailAvailable(value);
    setCheckingEmail(false);
    if (message) setError(message);
    else if (conflict) setError(null);
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    // Carry the invite token through so a Google sign-up started from an
    // invite link lands on the join page afterwards. Cookie, not query
    // string — see lib/auth/oauth-next.ts for why.
    rememberOAuthNext(
      inviteToken ? `/join/${encodeURIComponent(inviteToken)}` : "/dashboard",
    );
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflict(null);

    const passwordProblem = firstPasswordError(password);
    if (passwordProblem) {
      setError(passwordProblem);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    // Re-check at submit even if the blur check already passed — the
    // address can be claimed in between, and the user may never have
    // blurred the field at all (Enter straight from the password box).
    const taken = await checkEmailAvailable(email.trim());
    if (taken) {
      setError(taken);
      setLoading(false);
      return;
    }

    // If we have an invite token, point Supabase's verification
    // email back at the join page so the user can accept after
    // verifying. Without a token, Supabase uses its default
    // redirect (the app root).
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // The decoy. With email confirmation on, GoTrue answers a signup
    // for an existing address with a synthetic user carrying an EMPTY
    // identities array and no error — its enumeration protection. Treat
    // that as "taken" rather than showing "check your email" for an
    // account that was never created. This is the last line of defence:
    // it closes the gap between the check above and this call.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setConflict("password");
      setError(
        "An account with this email already exists. Sign in instead.",
      );
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen bg-background">
        <main className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
          <div className="mx-auto w-full max-w-sm text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Click the link to verify your account.
            </p>
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
            >
              <Button
                variant="outline"
                className="mt-8 h-12 w-full rounded-xl border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Back to sign in
              </Button>
            </Link>
          </div>
        </main>

        <AuthBrandPanel />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Form panel */}
      <main className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              wacrm
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              {inviteToken ? "Create account & join" : "Create an account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {inviteToken
                ? "Verify your email, then accept the invitation to join your team."
                : "Get started with your WhatsApp CRM in minutes."}
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-5">
            <GoogleAuthButton
              label="Sign up with Google"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
            />
            <AuthDivider />
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <p>{error}</p>
                {/* A refusal with nowhere to go is a dead end — offer the
                    route that actually works for this address. */}
                {conflict === "google" && (
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={googleLoading || loading}
                    className="mt-2 font-semibold underline underline-offset-4 hover:no-underline disabled:opacity-50"
                  >
                    Continue with Google
                  </button>
                )}
                {conflict === "password" && (
                  <Link
                    href={
                      inviteToken
                        ? `/login?invite=${encodeURIComponent(inviteToken)}`
                        : "/login"
                    }
                    className="mt-2 inline-block font-semibold underline underline-offset-4 hover:no-underline"
                  >
                    Go to sign in
                  </Link>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="fullName"
                className="text-sm font-medium text-foreground"
              >
                Full name
              </Label>
              <div className="group relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </Label>
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // A stale "already taken" banner about the previous
                    // address would be nonsense once it's been edited.
                    if (conflict) {
                      setConflict(null);
                      setError(null);
                    }
                  }}
                  onBlur={handleEmailBlur}
                  required
                  className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </div>
              {checkingEmail && (
                <p className="text-xs text-muted-foreground">
                  Checking availability…
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </Label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-describedby="password-requirements"
                  className="h-12 rounded-xl border-border bg-muted/40 pl-11 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <PasswordRequirements
                id="password-requirements"
                value={password}
                className="mt-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-foreground"
              >
                Confirm password
              </Label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
              className="font-medium text-primary hover:text-primary/80"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <AuthBrandPanel />
    </div>
  );
}
