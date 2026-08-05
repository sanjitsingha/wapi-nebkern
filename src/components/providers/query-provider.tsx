'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================
// Client-side query cache.
//
// THE PROBLEM IT SOLVES
//
// Every screen fetched its own data in a useEffect with no memory, so
// navigating Contacts → Inbox → Contacts downloaded the same contact
// list twice inside half a minute. Reference data was worse: `tags` is
// read from 14 separate call sites, `custom_fields` from 10, `profiles`
// from 8 — each one its own request, each one repeated on every mount,
// all for data that changes maybe once a week.
//
// On Supabase's free tier that repetition came straight out of a 5 GB
// monthly egress allowance.
//
// THE DEFAULTS, AND WHY THEY ARE NOT THE LIBRARY'S
// ============================================================

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState, not a module-level client: a module singleton would be
  // shared across users in SSR, and would survive a sign-out — so the
  // next person to sign in on the same tab could be handed the previous
  // account's cached rows.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // How long a result is trusted without re-asking. Thirty
            // seconds is the point of the whole exercise: it covers a
            // navigation away and back, which is the pattern that was
            // costing the most. Reference data overrides this upward —
            // see the hooks in src/hooks/reference-data.
            staleTime: 30_000,

            // Keep unused results in memory for five minutes so
            // returning to a screen is instant rather than merely
            // deduplicated.
            gcTime: 5 * 60_000,

            // OFF, deliberately — the library defaults it on. Alt-tabbing
            // is not evidence that data changed, and this app is used
            // alongside WhatsApp Web, so focus events fire constantly.
            // Anything that genuinely needs to be live (unread counts,
            // the open conversation) is driven by Realtime, not polling.
            refetchOnWindowFocus: false,

            // Reconnecting after a dropped connection IS worth a refetch:
            // we may have missed Realtime events while offline.
            refetchOnReconnect: true,

            // One retry, not three. A failed Supabase read is usually a
            // permission or shape problem that will fail identically
            // twice more — retrying just delays the error reaching the
            // user.
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
