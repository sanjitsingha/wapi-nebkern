"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MessageSquare, User } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  OTHER_REFERRAL_VALUE,
  REFERRAL_SOURCES,
} from "@/lib/auth/referral-sources";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// One-time "tell us about yourself" step, shown straight after a
// successful Google sign-up.
//
// A password signup types its name into the signup form; an OAuth one
// hands us whatever Google chose to share and nothing else — no
// organization, no attribution. So the middleware routes any profile
// with a NULL profile_completed_at (migration 073) here, and only
// POST /api/account/complete-profile clears it.
//
// This sits BEFORE the plan-selection gate (/onboarding) so the order
// reads: who are you -> what plan -> the app.
// ============================================================

export default function WelcomePage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [source, setSource] = useState("");
  const [otherSource, setOtherSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Prefill from whatever Google supplied so the common case is a
  // single confirming click rather than retyping a known name.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const meta = data.user?.user_metadata ?? {};
      const guess =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        "";
      if (guess) setFullName((prev) => prev || guess);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!source) {
      setError("Please tell us where you found us.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          organization_name: organization.trim(),
          referral_source: source,
          referral_other: otherSource.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save your details.");

      // Full reload, not a client push: the gate lives in middleware,
      // so the next destination has to be decided server-side with the
      // now-stamped profile. A soft navigation would race the redirect.
      window.location.href = "/dashboard";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your details.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Instant
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Almost there
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tell us a little about yourself so we can set up your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {error}
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
                <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
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
                htmlFor="organization"
                className="text-sm font-medium text-foreground"
              >
                Organization{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <div className="group relative">
                <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="organization"
                  type="text"
                  placeholder="Acme Inc."
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll name your workspace after this. You can change it
                later in Settings.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">
                Where did you find us?
              </Label>
              <Select value={source} onValueChange={(v) => v && setSource(v)}>
                <SelectTrigger className="h-12 w-full rounded-xl border-border bg-muted/40 text-sm">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_SOURCES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {source === OTHER_REFERRAL_VALUE && (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="otherSource"
                  className="text-sm font-medium text-foreground"
                >
                  Where, specifically?
                </Label>
                <Input
                  id="otherSource"
                  type="text"
                  placeholder="Tell us more"
                  value={otherSource}
                  onChange={(e) => setOtherSource(e.target.value)}
                  className="h-12 rounded-xl border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={saving}
              className="mt-1 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </div>
      </main>

      <AuthBrandPanel />
    </div>
  );
}
