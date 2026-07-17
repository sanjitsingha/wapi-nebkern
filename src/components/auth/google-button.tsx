"use client";

import { Button } from "@/components/ui/button";

interface GoogleAuthButtonProps {
  /** Button text — e.g. "Continue with Google" / "Sign up with Google". */
  label?: string;
  disabled?: boolean;
  /** Starts the Supabase Google OAuth flow — supplied by the login/signup
   *  page (`supabase.auth.signInWithOAuth({ provider: 'google' })`). */
  onClick?: () => void;
}

/**
 * "Continue with Google" button for the auth screens. The OAuth call itself
 * lives on the page (it needs the invite-token context) and is passed in via
 * `onClick`; this component is the presentation + the Google mark.
 */
export function GoogleAuthButton({
  label = "Continue with Google",
  disabled,
  onClick,
}: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full gap-3 rounded-xl border-border bg-background text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
    >
      <GoogleIcon />
      {label}
    </Button>
  );
}

/** Small "or" divider that sits between the Google button and the form. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Official multicolor Google "G" mark. Inlined so it needs no asset. */
function GoogleIcon() {
  return (
    <svg className="size-4.5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
