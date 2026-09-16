"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Loader2,
  MessageSquare,
  Phone,
  User,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  OTHER_REFERRAL_VALUE,
  REFERRAL_SOURCES,
} from "@/lib/auth/referral-sources";
import { canEditSettings, type AccountRole } from "@/lib/auth/roles";
import {
  SIGNUP_PHONE_ERROR,
  normalizeSignupPhone,
} from "@/lib/auth/signup-phone";
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
// One-time "tell us about yourself" step.
//
// The middleware routes any profile with a NULL profile_completed_at
// here, and only POST /api/account/complete-profile clears it. That
// covers a Google sign-up (which hands us a name and nothing else), and
// since migration 100 anyone who has no phone number on file — every
// account from before phone became required passes through once.
//
// This sits BEFORE the plan-selection gate (/onboarding) so the order
// reads: who are you -> what plan -> the app.
// ============================================================

interface ProfileSnapshot {
  full_name: string | null;
  phone: string | null;
  referral_source: string | null;
  account_role: string | null;
  account: { name: string | null } | { name: string | null }[] | null;
}

export default function WelcomePage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [source, setSource] = useState("");
  const [otherSource, setOtherSource] = useState("");
  // Until the profile loads, assume the stricter case. The server makes
  // the real decision either way, so the worst this can do is show the
  // organization field for a moment to someone it doesn't apply to.
  const [canNameWorkspace, setCanNameWorkspace] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Prefill everything already known, so a returning user is only asked
  // for what is actually missing — usually just the phone.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (cancelled || !user) return;

      const meta = user.user_metadata ?? {};
      const googleName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        "";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, referral_source, account_role, account:accounts(name)")
        .eq("user_id", user.id)
        .maybeSingle<ProfileSnapshot>();
      if (cancelled) return;

      const name = profile?.full_name || googleName;
      if (name) setFullName((prev) => prev || name);
      if (profile?.phone) setPhone((prev) => prev || profile.phone || "");

      if (profile?.account_role) {
        setCanNameWorkspace(canEditSettings(profile.account_role as AccountRole));
      }

      // The signup trigger names a new workspace after its owner. Offering
      // that back as the "organization" would let someone click straight
      // through a required field, so only a name that is clearly something
      // else is prefilled.
      const account = Array.isArray(profile?.account)
        ? profile?.account[0]
        : profile?.account;
      const accountName = account?.name?.trim() ?? "";
      const isPlaceholder =
        !accountName ||
        accountName === "My account" ||
        accountName === name ||
        accountName === user.email;
      if (!isPlaceholder) {
        setOrganization((prev) => prev || accountName);
      }

      const referral = profile?.referral_source ?? "";
      if (referral.startsWith(`${OTHER_REFERRAL_VALUE}:`)) {
        setSource((prev) => prev || OTHER_REFERRAL_VALUE);
        setOtherSource(
          (prev) => prev || referral.slice(OTHER_REFERRAL_VALUE.length + 1),
        );
      } else if (REFERRAL_SOURCES.some((o) => o.value === referral)) {
        setSource((prev) => prev || referral);
      }
    })();
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
    const normalizedPhone = normalizeSignupPhone(phone);
    if (!normalizedPhone) {
      setError(SIGNUP_PHONE_ERROR);
      return;
    }
    if (canNameWorkspace && !organization.trim()) {
      setError("Please enter your organization name.");
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
          phone: normalizedPhone,
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
                htmlFor="phone"
                className="text-sm font-medium text-foreground"
              >
                Phone number
              </Label>
              <div className="group relative">
                <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  // Matches the signup form: the country code lives in the
                  // placeholder, with no note under the field.
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                />
              </div>
            </div>

            {canNameWorkspace && (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="organization"
                  className="text-sm font-medium text-foreground"
                >
                  Organization
                </Label>
                <div className="group relative">
                  <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="organization"
                    type="text"
                    placeholder="Acme Inc."
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    required
                    className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll name your workspace after this. You can change it
                  later in Settings.
                </p>
              </div>
            )}

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
