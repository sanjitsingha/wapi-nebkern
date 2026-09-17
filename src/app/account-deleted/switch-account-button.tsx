'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * "Sign in with a different account" on the lockout screen.
 *
 * The way out of a closed account. Deleting one now signs the browser
 * out on the way here, but this page is also where a teammate lands
 * mid-session when an owner closes the account underneath them — and
 * their session is still live, which used to leave them stuck: every
 * page redirected here, /login included.
 *
 * Signs out globally, then leaves with a full page load rather than a
 * client navigation, so no cached route or provider state survives into
 * the next session.
 *
 * Harmless when there is no session left: signOut is a no-op and the
 * button is simply a link to /login.
 */
export function SwitchAccountButton() {
  const [working, setWorking] = useState(false);

  const leave = async () => {
    setWorking(true);
    try {
      await createClient().auth.signOut({ scope: 'global' });
    } catch {
      // Revoking the token is a courtesy; getting to the form is the
      // point. Fall through either way.
    }
    window.location.href = '/login';
  };

  return (
    <button
      type="button"
      onClick={leave}
      disabled={working}
      className="border-border text-foreground hover:bg-muted flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition-colors disabled:opacity-60"
    >
      {working ? 'Signing out…' : 'Sign in with a different account'}
    </button>
  );
}
