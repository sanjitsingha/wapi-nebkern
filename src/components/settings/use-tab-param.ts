'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Sync a Tabs component with the `?tab=` query param.
 *
 * Returns the currently-active tab (read live from the URL, validated
 * against `tabs` with `tabs[0]` as the fallback) and a setter that writes
 * the chosen tab back to the URL. Deriving the active tab from the URL —
 * rather than from mount-time `defaultValue` — means:
 *   - clicking a tab updates the address bar, so the view is shareable;
 *   - a soft navigation to `?tab=plan` while already on the page actually
 *     switches the tab (defaultValue only ran once, on mount).
 *
 * Uses `router.replace` with scroll preserved, so rapid tab clicks don't
 * pile up history entries — Back returns to the previous page, not the
 * previous tab. Other query params are carried through untouched.
 *
 * Pages using this must stay wrapped in <Suspense> (useSearchParams opts
 * the tree out of static prerendering otherwise).
 */
export function useTabParam<T extends string>(
  tabs: readonly T[],
): [T, (value: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get('tab');
  const active = (tabs as readonly string[]).includes(raw ?? '')
    ? (raw as T)
    : tabs[0];

  const setTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return [active, setTab];
}
