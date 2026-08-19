"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { BrandLogo } from "@/components/brand/logo";
import { NewPasswordForm } from "@/components/auth/new-password-form";

// Where the emailed recovery *link* lands, for anyone who clicks it
// instead of typing the code: /auth/callback exchanges the code, which
// leaves a live session, and this page just collects the new password.
//
// It exists mainly so that path isn't a dead end — the route was
// referenced by the old forgot-password page but never built, so every
// clicked reset link 404'd. The six-digit code on /forgot-password is
// the primary flow now; this is the fallback.

export default function ResetPasswordPage() {
  const supabase = createClient();
  // null = still checking. The session is what proves the recovery link
  // was valid — without one there is nothing to authorise the change.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 flex items-center">
            <BrandLogo priority className="h-8" />
          </div>

          {hasSession === null && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your reset link...
            </div>
          )}

          {hasSession === false && (
            <>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                This link has expired
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Reset links are single-use and time-limited. Start again and
                we&apos;ll send a fresh six-digit code.
              </p>
              <Link href="/forgot-password">
                <Button className="mt-8 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90">
                  Request a new code
                </Button>
              </Link>
            </>
          )}

          {hasSession === true && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Choose a new password
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Set the password you&apos;ll sign in with from now on.
                </p>
              </div>
              <NewPasswordForm />
            </>
          )}

          <Link
            href="/login"
            className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </main>

      <AuthBrandPanel />
    </div>
  );
}
