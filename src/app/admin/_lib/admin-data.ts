import { cache } from 'react';

import {
  computeSubscription,
  type SubscriptionStatus,
} from '@/lib/billing/subscription';
import {
  BILLING_PLAN_COLUMNS,
  mapBillingPlanRow,
  type BillingPlan,
} from '@/lib/billing/plans';
import { adminDb } from './admin-db';
import { ADMIN_TAGS, cachedRead } from './admin-cache';

// ============================================================
// Shared admin reads — the panel's only source of tenant data.
//
// THE RULE: a page never queries `accounts`, `profiles` or
// `billing_plans` itself. It asks for one of the loaders below.
//
// Those three tables were being read over and over by pages that each
// wanted a slightly different projection of the same few rows —
// Overview fetched accounts + a profiles count, Accounts fetched
// accounts + profiles, Users fetched profiles + accounts + auth,
// getAccountsIndex fetched accounts again for id/name, and five more
// pages called that. Nine queries for three tables, per click.
//
// Now there is exactly one query per table, selecting the widest
// projection anyone needs, and every other loader is a pure derivation
// of it. Overview costs zero queries of its own; the Accounts page
// costs zero; getAccountsIndex costs zero. What used to be nine round
// trips is three, and those three are cached for a minute on top.
//
// TWO LAYERS OF CACHE, BOTH WANTED
//
//   `cache()`     — React. Dedupes repeat calls inside ONE render, so
//                   a page and its sidebar asking for the same list
//                   share a single call.
//   `cachedRead`  — Next. Keeps the result ACROSS requests, so the
//                   next click doesn't hit Supabase at all.
//
// COST OF DERIVING RATHER THAN AGGREGATING
//
// The counts below are computed in JS over the fetched rows rather
// than by a SQL `count()` or a view. That is deliberate: an account's
// effective status comes from `computeSubscription` — trial dates,
// grace periods, the lot — and re-implementing that in Postgres would
// put one business rule in two places, free to drift apart in silence.
// The tables are small and the read is cached; the JS pass is free.
// ============================================================

/* ─── Canonical reads. One per table. ─────────────────────────────── */

export interface AccountRow {
  id: string;
  name: string;
  owner_user_id: string;
  plan: string | null;
  subscription_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

/**
 * Every account, with every column any admin page needs.
 *
 * The projection is the union of what Overview, Accounts and the
 * account detail page want. Widening it is cheaper than a second
 * query: this is one row per tenant.
 */
export const getAccounts = cache(
  async (): Promise<AccountRow[]> =>
    cachedRead(ADMIN_TAGS.accounts, ['all'], async () => {
      const { data } = await adminDb()
        .from('accounts')
        .select(
          'id, name, owner_user_id, plan, subscription_status, trial_started_at, trial_ends_at, created_at'
        )
        .order('created_at', { ascending: false });

      return (data ?? []) as AccountRow[];
    })
);

export interface ProfileRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  account_id: string | null;
  account_role: string | null;
}

export const getProfiles = cache(
  async (): Promise<ProfileRow[]> =>
    cachedRead(ADMIN_TAGS.profiles, ['all'], async () => {
      const { data } = await adminDb()
        .from('profiles')
        .select('user_id, email, full_name, account_id, account_role');

      return (data ?? []) as ProfileRow[];
    })
);

export const getPlans = cache(
  async (): Promise<BillingPlan[]> =>
    cachedRead(ADMIN_TAGS.plans, ['all'], async () => {
      const { data } = await adminDb()
        .from('billing_plans')
        .select(BILLING_PLAN_COLUMNS)
        .order('sort_order', { ascending: true });

      return ((data ?? []) as Parameters<typeof mapBillingPlanRow>[0][]).map(
        mapBillingPlanRow
      );
    })
);

export interface AuthUserRow {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  emailConfirmedAt: string | null;
}

/**
 * Supabase Auth's user list — existence and ban state, which the
 * `profiles` mirror cannot be trusted for.
 *
 * Cached like the rest, and invalidated by the suspend/delete routes,
 * so a ban still shows up the instant you apply it. Flattened to a
 * plain shape here because the SDK's `User` drags a large type through
 * every caller for six fields.
 */
export const getAuthUsers = cache(
  async (): Promise<AuthUserRow[]> =>
    cachedRead(ADMIN_TAGS.authUsers, ['page1'], async () => {
      const { data } = await adminDb().auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      return (data?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        bannedUntil:
          (u as { banned_until?: string | null }).banned_until ?? null,
        emailConfirmedAt: u.email_confirmed_at ?? null,
      }));
    })
);

/* ─── Derivations. These cost nothing. ────────────────────────────── */

export interface AccountRef {
  id: string;
  /** Never null. `accounts.name` is nullable in the database, and the
   *  fallback is applied here so the call sites don't each invent their
   *  own way of rendering a nameless tenant. */
  name: string;
}

/** id → name, for every "which tenant is this?" label in the panel. */
export const getAccountsIndex = cache(async (): Promise<AccountRef[]> => {
  const rows = await getAccounts();
  return rows
    .map((a) => ({ id: a.id, name: a.name ?? 'Unnamed account' }))
    .sort((x, y) => x.name.localeCompare(y.name));
});

/** The same list as a Map, since almost every caller wants a lookup. */
export const getAccountsMap = cache(async (): Promise<Map<string, string>> => {
  const rows = await getAccountsIndex();
  return new Map(rows.map((a) => [a.id, a.name]));
});

/** owner/member email by user id, for "who owns this account?". */
export const getEmailsByUserId = cache(
  async (): Promise<Map<string, string | null>> => {
    const rows = await getProfiles();
    return new Map(rows.map((p) => [p.user_id, p.email]));
  }
);

export interface OverviewStats {
  accounts: number;
  users: number;
  byStatus: Record<string, number>;
  byPlan: { key: string; name: string; count: number }[];
  trialsEndingSoon: number;
  /** Accounts created in the last 30 days. */
  newThisMonth: number;
  /** Accounts created in the 30 days before that — for the delta. */
  newLastMonth: number;
  /** Daily signup counts, oldest first, for the last 30 days. */
  signups: number[];
  /** Summed monthly value of every account on a priced, active plan. */
  mrrMinor: number;
  currency: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Everything the dashboard prints, derived from the three canonical
 * reads above — this function issues no query of its own.
 */
export const getOverviewStats = cache(async (): Promise<OverviewStats> => {
  const [accounts, profiles, plans] = await Promise.all([
    getAccounts(),
    getProfiles(),
    getPlans(),
  ]);

  const byStatus: Record<string, number> = {
    trialing: 0,
    active: 0,
    past_due: 0,
    canceled: 0,
    expired: 0,
  };
  const planCounts = new Map<string, number>();

  // Monthly value per plan key. Yearly plans are divided by twelve so
  // one number can be compared month to month; anything not in the
  // table (legacy keys, "trial") contributes nothing.
  const monthlyByPlan = new Map<string, number>();
  for (const p of plans) {
    if (!p.isActive) continue;
    monthlyByPlan.set(
      p.key,
      p.interval === 'yearly' ? Math.round(p.amount / 12) : p.amount
    );
  }

  const now = Date.now();
  const signups = new Array<number>(30).fill(0);
  let trialsEndingSoon = 0;
  let newThisMonth = 0;
  let newLastMonth = 0;
  let mrrMinor = 0;

  for (const a of accounts) {
    const sub = computeSubscription(a);
    byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1;
    planCounts.set(sub.plan, (planCounts.get(sub.plan) ?? 0) + 1);

    if (sub.isTrial && sub.trialDaysLeft <= 3) trialsEndingSoon += 1;
    // Only paying accounts count toward run rate — a trial on the
    // Growth plan is not revenue until it converts.
    if (sub.status === 'active') mrrMinor += monthlyByPlan.get(sub.plan) ?? 0;

    const created = Date.parse(a.created_at);
    if (Number.isNaN(created)) continue;
    const ageDays = Math.floor((now - created) / DAY_MS);
    if (ageDays < 30) {
      newThisMonth += 1;
      // Index 29 is today, 0 is thirty days ago.
      signups[29 - ageDays] += 1;
    } else if (ageDays < 60) {
      newLastMonth += 1;
    }
  }

  const planName = new Map(plans.map((p) => [p.key, p.name]));
  const byPlan = [...planCounts.entries()]
    .map(([key, count]) => ({ key, name: planName.get(key) ?? key, count }))
    .sort((x, y) => y.count - x.count);

  return {
    accounts: accounts.length,
    users: profiles.length,
    byStatus,
    byPlan,
    trialsEndingSoon,
    newThisMonth,
    newLastMonth,
    signups,
    mrrMinor,
    currency: plans[0]?.currency ?? 'INR',
  };
});

/**
 * The tenant list, with owner email, member count and effective status
 * folded in. Shared by the Accounts page and anything else that needs
 * a resolved view of a tenant rather than the raw row.
 */
export interface AccountView {
  id: string;
  name: string;
  ownerEmail: string | null;
  plan: string;
  status: SubscriptionStatus;
  trialDaysLeft: number;
  isTrial: boolean;
  memberCount: number;
  trialEndsAt: string | null;
  createdAt: string;
}

export const getAccountViews = cache(async (): Promise<AccountView[]> => {
  const [accounts, profiles] = await Promise.all([
    getAccounts(),
    getProfiles(),
  ]);

  const emailByUserId = new Map<string, string | null>();
  const memberCount = new Map<string, number>();
  for (const p of profiles) {
    emailByUserId.set(p.user_id, p.email);
    if (p.account_id) {
      memberCount.set(p.account_id, (memberCount.get(p.account_id) ?? 0) + 1);
    }
  }

  return accounts.map((a) => {
    const sub = computeSubscription(a);
    return {
      id: a.id,
      name: a.name,
      ownerEmail: emailByUserId.get(a.owner_user_id) ?? null,
      plan: sub.plan,
      status: sub.status as SubscriptionStatus,
      trialDaysLeft: sub.isTrial ? sub.trialDaysLeft : 0,
      isTrial: sub.isTrial,
      memberCount: memberCount.get(a.id) ?? 0,
      trialEndsAt: a.trial_ends_at,
      createdAt: a.created_at,
    };
  });
});

/* ─── Support. Deliberately uncached. ─────────────────────────────── */

export interface TicketAttention {
  open: number;
  needsReply: number;
  /** Age in hours of the longest-waiting unanswered ticket, or null. */
  oldestWaitingHours: number | null;
}

/**
 * Support counters — the one read in the panel that is never cached.
 *
 * Everything else tolerates a minute of staleness. This does not: "3
 * tickets awaiting reply" that is actually 5 sends you away from the
 * queue believing you are done.
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
  let oldestWaiting: number | null = null;

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
      const waited = Date.parse(t.last_message_at);
      if (!Number.isNaN(waited) && (oldestWaiting === null || waited < oldestWaiting)) {
        oldestWaiting = waited;
      }
    }
  }

  return {
    open,
    needsReply,
    oldestWaitingHours:
      oldestWaiting === null
        ? null
        : Math.floor((Date.now() - oldestWaiting) / (60 * 60 * 1000)),
  };
}
