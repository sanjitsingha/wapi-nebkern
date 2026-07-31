"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Set a new password for the *already-authenticated* user.
//
// Both recovery routes end here holding a live session — the OTP flow
// gets one from `verifyOtp({ type: 'recovery' })`, the emailed-link flow
// from the code exchange in /auth/callback — so this only ever has to
// call `updateUser`. It deliberately does not take the old password:
// proving control of the mailbox is what the recovery step established.

const MIN_LENGTH = 6;

export function NewPasswordForm({
  /** Where to send the user once the password is saved. They are signed
   *  in at this point, so the app is the sensible landing place. */
  redirectTo = "/dashboard",
  submitLabel = "Save new password",
}: {
  redirectTo?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // `router.refresh()` first so the server components behind the
    // destination re-read the (now updated) session rather than serving
    // a cached logged-out shell.
    router.refresh();
    router.push(redirectTo);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-foreground">
          New password
        </Label>
        <div className="group relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="h-12 rounded-xl border-border bg-muted/40 pr-11 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-foreground"
        >
          Confirm new password
        </Label>
        <div className="group relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Repeat the password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="h-12 rounded-xl border-border bg-muted/40 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="mt-1 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
