// ============================================================
// Subscription / trial state — pure, shared by server & client.
//
// The DB stores the raw lifecycle (accounts.subscription_status +
// trial_ends_at, migration 051; current_period_end, migration 054). This
// module folds both end dates into an EFFECTIVE status on read, so we
// never depend on a cron for correctness:
//   - a 'trialing' row past its trial_ends_at is 'expired';
//   - an 'active' row past its current_period_end is 'expired' — a paid
//     plan (Razorpay, an activation code or the admin panel) ends when
//     its period does. An active row with no period end (grandfathered,
//     full access by hand) never ends.
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
  /** End of the paid period, for a plan bought, redeemed or assigned. */
  current_period_end?: string | null;
}

/** The accounts columns computeSubscription reads — select these. */
export const SUBSCRIPTION_COLUMNS =
  'plan, subscription_status, trial_started_at, trial_ends_at, current_period_end';

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
  /** ISO end of the paid period, if any. */
  periodEndsAt: string | null;
  /** Whole days left in a live paid period (0 when none or ended). */
  periodDaysLeft: number;
  /**
   * The gate the app enforces: true when the account may perform costly
   * outward actions (send messages, run broadcasts). True for 'trialing'
   * and 'active', and for 'canceled' until its paid period ends; false
   * once the trial or the period has ended, and for 'past_due'.
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
  const periodEndsAt = row?.current_period_end ?? null;
  const periodEndMs = parseTime(periodEndsAt);
  const periodOver = periodEndMs != null && periodEndMs <= now;
  const periodDaysLeft =
    periodEndMs != null && !periodOver ? Math.ceil((periodEndMs - now) / DAY_MS) : 0;
  const base = { plan, trialEndsAt, periodEndsAt, periodDaysLeft };

  // Fail-open when the column is entirely absent (undefined). Note: an
  // explicit null is treated the same, since both mean "unknown".
  if (rawStatus == null) {
    return {
      ...base,
      status: 'active',
      isTrial: false,
      trialDaysLeft: 0,
      hasAccess: true,
    };
  }

  if (rawStatus === 'trialing') {
    const endMs = parseTime(trialEndsAt);
    const expired = endMs != null && endMs <= now;
    if (expired) {
      return {
        ...base,
        status: 'expired',
        isTrial: false,
        trialDaysLeft: 0,
        hasAccess: false,
      };
    }
    const trialDaysLeft =
      endMs != null ? Math.max(0, Math.ceil((endMs - now) / DAY_MS)) : TRIAL_DAYS;
    return {
      ...base,
      status: 'trialing',
      isTrial: true,
      trialDaysLeft,
      hasAccess: true,
    };
  }

  // A paid plan whose period has run out — however it was bought — is
  // over, whatever the stored status still says.
  if (rawStatus === 'active' && periodOver) {
    return { ...base, status: 'expired', isTrial: false, trialDaysLeft: 0, hasAccess: false };
  }

  const status = rawStatus as SubscriptionStatus;
  return {
    ...base,
    status,
    isTrial: false,
    trialDaysLeft: 0,
    // Canceled keeps what was paid for, to the end of the period.
    hasAccess: status === 'active' || (status === 'canceled' && periodEndMs != null && !periodOver),
  };
}
