"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { AuthLegalLinks } from "@/components/auth/legal-notice";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { GoogleAuthButton, AuthDivider } from "@/components/auth/google-button";
import { GoogleGisButton } from "@/components/auth/google-gis-button";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { googleGisEnabled } from "@/lib/auth/google-gis";
import { readMfaStatus } from "@/lib/auth/mfa";
import { rememberOAuthNext } from "@/lib/auth/oauth-next";

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get("invite");

  // Where a successful sign-in lands. The redirect flow stashes this in a
  // cookie for /auth/callback to read; GIS has no round trip to lose it
  // across, so it navigates here directly.
  const destination = inviteToken
    ? `/join/${encodeURIComponent(inviteToken)}`
    : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Seed the error from the query so an OAuth failure bounced back from
  // /auth/callback (e.g. the user cancelled Google consent) is shown.
  const [error, setError] = useState<string | null>(
    searchParams.get("error"),
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Set once the password is accepted AND the account has 2FA on. While
  // it holds a factor id the form is replaced by the code step: the
  // session exists but sits at AAL1, which the middleware refuses.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  /** Where a completed sign-in goes. Shared by the password path and the
   *  2FA path so the invite token survives either. */
  const finish = () => {
    if (inviteToken) {
      router.push(`/join/${encodeURIComponent(inviteToken)}`);
    } else {
      router.push("/dashboard");
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    // Carry the invite token through the OAuth round-trip so the user lands
    // on the join page after Google sends them back, not /dashboard. It
    // goes in a cookie, not on `redirectTo` — a query string there has to
    // be in the Supabase Redirect URLs allow-list in its own right, and a
    // miss dumps the user on the Site URL instead of here.
    rememberOAuthNext(destination);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // On success the browser is already navigating to Google; we only reach
    // here if the request itself failed to start.
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // The password bought a session, but for a 2FA account that session
    // is AAL1 — enough to ask for a code, not enough to enter the app.
    // Swap the form for the code step rather than navigating; the
    // middleware would only bounce them back here anyway.
    const status = await readMfaStatus(supabase);
    if (status.challengeRequired && status.factorId) {
      setMfaFactorId(status.factorId);
      setLoading(false);
      return;
    }

    finish();
  };

  /** Back out of a half-finished login. MfaChallenge has already signed
   *  the AAL1 session out by this point. */
  const cancelMfa = () => {
    setMfaFactorId(null);
    setPassword("");
    setError(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Form panel */}
      <main className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 flex items-center">
            <BrandLogo priority className="h-8" />
          </div>

          {/* Second step, for accounts with 2FA on. Returns early: the
              password form, the Google buttons and the sign-up link all
              belong to step one, and leaving them on screen would offer
              a way around the gate. */}
          {mfaFactorId ? (
            <>
              <MfaChallenge
                factorId={mfaFactorId}
                onVerified={finish}
                onCancel={cancelMfa}
              />
              <AuthLegalLinks />
            </>
          ) : (
          <>
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              {inviteToken ? "Sign in to accept" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {inviteToken
                ? "Sign in and we'll take you to the invitation."
                : "Sign in to your account to continue."}
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-5">
            {/* GIS skips the supabase.co redirect so Google's card names
                this site instead of the project ref. Off unless switched
                on; the redirect button below is the proven path and stays
                the default. */}
            {googleGisEnabled() ? (
              <GoogleGisButton
                destination={destination}
                label="Continue with Google"
                text="continue_with"
                onError={setError}
                fallback={
                  <GoogleAuthButton
                    label="Continue with Google"
                    onClick={handleGoogle}
                    disabled={googleLoading || loading}
                  />
                }
              />
            ) : (
              <GoogleAuthButton
                label="Continue with Google"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
              />
            )}
            <AuthDivider />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            )}

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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="font-medium text-primary hover:text-primary/80"
            >
              Create account
            </Link>
          </p>

          <AuthLegalLinks />
          </>
          )}
        </div>
      </main>

      <AuthBrandPanel />
    </div>
  );
}
