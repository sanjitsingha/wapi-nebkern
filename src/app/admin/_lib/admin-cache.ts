import { unstable_cache, revalidateTag } from 'next/cache';

// ============================================================
// Query caching for the admin panel.
//
// THE PROBLEM
//
// Every page under `(protected)` is `force-dynamic`, because the
// layout reads the session cookie to gate access. That is correct for
// auth — but it also meant every navigation re-ran every Supabase
// query behind it. Clicking through the panel a dozen times cost a
// couple of dozen requests against a free-tier project, all returning
// the same handful of rows.
//
// WHY CACHE THE QUERY, NOT THE PAGE
//
// The auth check must run on every request; that is the one thing that
// cannot be stale. So the page stays dynamic and the *data* is cached
// instead. Reads are served from Next's cache for `seconds`, and the
// admin gate still runs every single time.
//
// WHY unstable_cache
//
// Next 16 supersedes it with the `use cache` directive — but that
// requires `cacheComponents: true` in next.config, which changes
// caching semantics for the WHOLE app: the tenant dashboard, the
// webhook routes, everything. That is not a switch to flip as a side
// effect of tidying the back office. `unstable_cache` is still
// supported and its blast radius is exactly these functions. Swap it
// for `use cache` if the app ever opts into Cache Components.
//
// STALENESS
//
// 60s for lists and reference data. Tickets are deliberately NOT
// cached — support is the one place where acting on a minute-old view
// is a real mistake. Every mutation calls `revalidateAdmin` so an edit
// is visible immediately rather than up to a minute later.
// ============================================================

/** Cache keys, so a mutation can invalidate exactly what it changed. */
export const ADMIN_TAGS = {
  accounts: 'admin:accounts',
  profiles: 'admin:profiles',
  authUsers: 'admin:auth-users',
  plans: 'admin:plans',
  invoices: 'admin:invoices',
  announcements: 'admin:announcements',
  notifications: 'admin:notifications',
  popups: 'admin:popups',
  codes: 'admin:codes',
  blog: 'admin:blog',
  contact: 'admin:contact',
  newsletter: 'admin:newsletter',
  qr: 'admin:qr',
} as const;

// There is no `overview` tag any more. The dashboard used to be its own
// cached query; it is now derived from the accounts / profiles / plans
// reads, so invalidating those invalidates it by construction. A tag of
// its own would have to be remembered at every write site, and would be
// silently wrong the first time someone forgot.

export type AdminTag = (typeof ADMIN_TAGS)[keyof typeof ADMIN_TAGS];

const DEFAULT_TTL_SECONDS = 60;

/**
 * Cache one read for `seconds`, keyed by `tag`.
 *
 * `keyParts` must include every argument the loader varies on — a
 * cache keyed only by its tag would serve one account's detail page
 * for another's.
 */
export function cachedRead<T>(
  tag: AdminTag,
  keyParts: string[],
  load: () => Promise<T>,
  seconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  return unstable_cache(load, [tag, ...keyParts], {
    tags: [tag],
    revalidate: seconds,
  })();
}

/**
 * Drop cached reads after a write. Call from every admin API route
 * that mutates — without it an edit appears to do nothing for up to a
 * minute, which reads as a broken save.
 *
 * `{ expire: 0 }`, not the recommended `'max'`: `'max'` is
 * stale-while-revalidate, so the very next render still serves the old
 * value and refreshes behind it. That is right for a blog post and
 * wrong here — the operator who just changed a plan needs to see the
 * change, not the previous one. Expiring outright makes that read a
 * blocking miss, which is the point.
 *
 * (`updateTag` is the purpose-built version of this, but it only works
 * inside Server Actions; these are Route Handlers.)
 */
export function revalidateAdmin(...tags: AdminTag[]): void {
  for (const t of tags) revalidateTag(t, { expire: 0 });
}
