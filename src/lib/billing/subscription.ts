// ============================================================
// Subscription / trial state — pure, shared by server & client.
//
// The DB stores the raw lifecycle (accounts.subscription_status +
// trial_ends_at, migration 051). This module folds trial expiry into an
// EFFECTIVE status on read, so we never depend on a cron for correctness:
// a 'trialing' row past its trial_ends_at is reported as 'expired' here.
//
// See docs/billing-and-trial.md. Keep TRIAL_DAYS in sync with the
// interval in migration 051's handle_new_user().
// ============================================================

/** Trial length in days. Mirrored by migration 051 (INTERVAL '14 days'). */
export const TRIAL_DAYS = 14;

/** Raw lifecycle stored on `accounts` (mirrors subscription_status_enum). */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

/** The subscription-bearing columns on an `accounts` row. All nullable so
 *  this stays safe against forks whose schema predates migration 051. */
export interface AccountSubscriptionRow {
  plan?: string | null;
  subscription_status?: SubscriptionStatus | string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
}

export interface SubscriptionState {
  /** Effective status with trial expiry already folded in. */
  status: SubscriptionStatus;
  /** Plan key (e.g. 'trial', 'grandfathered', 'starter'). */
  plan: string;
  /** True while inside the free-trial window. */
  isTrial: boolean;
  /** Whole days remaining in the trial (0 when not trialing / expired). */
  trialDaysLeft: number;
  /** ISO end of trial, if any. */
  trialEndsAt: string | null;
  /**
   * The gate the app enforces: true when the account may perform costly
   * outward actions (send messages, run broadcasts). True for 'trialing'
   * and 'active'; false once the trial has expired (and for
   * canceled/expired/past_due).
   */
  hasAccess: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Compute the effective subscription state for an account row.
 *
 * `now` is injectable for deterministic tests; defaults to the wall clock.
 * Fails OPEN: a row with no subscription columns at all (pre-051 fork, or
 * a half-populated select) is treated as active so nobody is locked out by
 * a missing migration.
 */
export function computeSubscription(
  row: AccountSubscriptionRow | null | undefined,
  now: number = Date.now(),
): SubscriptionState {
  const plan = row?.plan ?? 'trial';
  const rawStatus = row?.subscription_status ?? null;
  const trialEndsAt = row?.trial_ends_at ?? null;

  // Fail-open when the column is entirely absent (undefined). Note: an
  // explicit null is treated the same, since both mean "unknown".
  if (rawStatus == null) {
    return {
      status: 'active',
      plan,
      isTrial: false,
      trialDaysLeft: 0,
      trialEndsAt,
      hasAccess: true,
    };
  }

  if (rawStatus === 'trialing') {
    const endMs = parseTime(trialEndsAt);
    const expired = endMs != null && endMs <= now;
    if (expired) {
      return {
        status: 'expired',
        plan,
        isTrial: false,
        trialDaysLeft: 0,
        trialEndsAt,
        hasAccess: false,
      };
    }
    const trialDaysLeft =
      endMs != null ? Math.max(0, Math.ceil((endMs - now) / DAY_MS)) : TRIAL_DAYS;
    return {
      status: 'trialing',
      plan,
      isTrial: true,
      trialDaysLeft,
      trialEndsAt,
      hasAccess: true,
    };
  }

  const status = rawStatus as SubscriptionStatus;
  return {
    status,
    plan,
    isTrial: false,
    trialDaysLeft: 0,
    trialEndsAt,
    hasAccess: status === 'active',
  };
}
