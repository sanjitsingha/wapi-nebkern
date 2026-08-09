import { cache } from 'react';

import { computeSubscription } from '@/lib/billing/subscription';
import { adminDb } from './admin-db';
import { ADMIN_TAGS, cachedRead } from './admin-cache';

// ============================================================
// Shared admin reads.
//
// Five pages — tickets, users, announcements, notifications, popups —
// each fetched `accounts(id, name)` for themselves, so the same tiny
// list was pulled five separate times as you clicked around. It lives
// here once now, cached across requests and deduplicated within one.
//
// `cache()` from React and `cachedRead` do different jobs and both are
// wanted: React's dedupes repeat calls inside a single render (two
// components asking for the account list get one query), while the
// Next cache keeps the result across requests.
// ============================================================

export interface AccountRef {
  id: string;
  /** Never null. `accounts.name` is nullable in the database, and the
   *  fallback is applied here so five call sites don't each invent
   *  their own way of rendering a nameless tenant. */
  name: string;
}

/** id → name, for every "which tenant is this?" label in the panel. */
export const getAccountsIndex = cache(
  async (): Promise<AccountRef[]> =>
    cachedRead(ADMIN_TAGS.accounts, ['index'], async () => {
      const { data } = await adminDb()
        .from('accounts')
        .select('id, name')
        .order('name', { ascending: true });

      return ((data ?? []) as { id: string; name: string | null }[]).map(
        (a) => ({ id: a.id, name: a.name ?? 'Unnamed account' })
      );
    })
);

/** The same list as a Map, since almost every caller wants a lookup. */
export const getAccountsMap = cache(async (): Promise<Map<string, string>> => {
  const rows = await getAccountsIndex();
  return new Map(rows.map((a) => [a.id, a.name]));
});

export interface OverviewStats {
  accounts: number;
  users: number;
  byStatus: Record<string, number>;
  trialsEndingSoon: number;
}

/**
 * The dashboard's numbers.
 *
 * Still reads the account rows rather than aggregating in SQL. A view
 * could count these server-side, but the status of an account is
 * decided by `computeSubscription` — trial dates, grace periods, the
 * lot — and re-implementing that in Postgres would put the same
 * business rule in two places, free to drift apart silently. With the
 * table this size the read is trivial; the caching is what actually
 * removes the cost.
 *
 * `users` is a HEAD count, not a fetch: nothing here needs the rows.
 */
export const getOverviewStats = cache(
  async (): Promise<OverviewStats> =>
    cachedRead(ADMIN_TAGS.overview, ['stats'], async () => {
      const db = adminDb();
      const [accountsRes, usersRes] = await Promise.all([
        db
          .from('accounts')
          .select(
            'plan, subscription_status, trial_started_at, trial_ends_at, created_at'
          ),
        db.from('profiles').select('*', { count: 'exact', head: true }),
      ]);

      const byStatus: Record<string, number> = {
        trialing: 0,
        active: 0,
        past_due: 0,
        canceled: 0,
        expired: 0,
      };
      let trialsEndingSoon = 0;

      const accounts = accountsRes.data ?? [];
      for (const a of accounts) {
        const sub = computeSubscription(
          a as Parameters<typeof computeSubscription>[0]
        );
        byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1;
        if (sub.isTrial && sub.trialDaysLeft <= 3) trialsEndingSoon += 1;
      }

      return {
        accounts: accounts.length,
        users: usersRes.count ?? 0,
        byStatus,
        trialsEndingSoon,
      };
    })
);

export interface TicketAttention {
  open: number;
  needsReply: number;
}

/**
 * Support counters — deliberately uncached.
 *
 * Everything else in the panel tolerates a minute of staleness. This
 * does not: "3 tickets awaiting reply" that is actually 5 sends you
 * away from the queue believing you are done.
 */
export async function getTicketAttention(): Promise<TicketAttention> {
  const { data } = await adminDb()
    .from('support_tickets')
    .select('status, last_message_at, last_support_reply_at');

  const tickets = (data ?? []) as {
    status: string;
    last_message_at: string | null;
    last_support_reply_at: string | null;
  }[];

  let open = 0;
  let needsReply = 0;
  for (const t of tickets) {
    if (t.status === 'open' || t.status === 'pending') open += 1;

    // Newest message came from the customer and the ticket is live.
    if (t.status === 'closed' || t.status === 'resolved') continue;
    if (!t.last_message_at) continue;
    if (
      !t.last_support_reply_at ||
      Date.parse(t.last_message_at) > Date.parse(t.last_support_reply_at)
    ) {
      needsReply += 1;
    }
  }

  return { open, needsReply };
}
