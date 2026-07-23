'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

// ============================================================
// Auth-aware header CTA for the marketing chrome. Kept a small client
// island so SiteHeader (and the blog that shares it) stay server
// components — reading auth cookies there would force those pages into
// per-request dynamic rendering.
//
// Defaults to the logged-out buttons, which is also what the server
// renders: a logged-out visitor (the common case) sees the correct CTA
// immediately with no flash, and a logged-in visitor briefly sees them
// before the session resolves and swaps in "Dashboard".
// ============================================================

const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover';
const btnGhost =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted';

export function HeaderCta() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setLoggedIn(!!data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setLoggedIn(!!session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loggedIn) {
    // A bordered button rather than the solid-green primary — a full green
    // block reads as a loud marketing CTA, which "go to your dashboard"
    // isn't. Keeps the brand colour as an accent on the icon instead.
    return (
      <Link
        href="/dashboard"
        className="border-border bg-background text-foreground hover:bg-muted inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-colors"
      >
        <LayoutDashboard className="text-primary h-4 w-4" />
        Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className={`${btnGhost} hidden sm:inline-flex`}>
        Log in
      </Link>
      <Link href="/signup" className={btnPrimary}>
        Get started
      </Link>
    </>
  );
}
