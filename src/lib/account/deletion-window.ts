// ============================================================
// The deletion window's pure arithmetic and constants.
//
// Split out from `deletion.ts` because that module imports
// `node:crypto` for token minting, and these values are needed by
// client components — the settings dialog and the public recovery
// pages all quote the window in their copy. Importing the crypto module
// from a client component would drag node:crypto into the browser
// bundle and fail the build.
//
// Nothing here touches randomness, hashing, or the network.
// ============================================================

/**
 * How long a deleted account stays recoverable.
 *
 * This number is quoted to the user in the confirmation dialog, the
 * lockout screen, the recovery page and the email. Those all read it
 * from here, so changing it changes the copy too — but the wording
 * around it ("30 days", "a month") still has to be checked by eye.
 */
export const DELETION_WINDOW_DAYS = 30;

/**
 * How long a single recovery link stays valid.
 *
 * Much shorter than the window itself: the link is a bearer credential
 * sitting in an inbox, while the window is just how long the option
 * remains open. Someone whose link expires can request another for as
 * long as the account is still recoverable.
 */
export const RECOVERY_TOKEN_TTL_HOURS = 24;

/** The moment an account requested now becomes eligible for purge. */
export function purgeDateFrom(requestedAt: Date): Date {
  const purge = new Date(requestedAt);
  purge.setUTCDate(purge.getUTCDate() + DELETION_WINDOW_DAYS);
  return purge;
}

/** Whole days left before the purge, floored at zero. For copy only —
 *  never for access decisions, which compare timestamps directly. */
export function daysUntilPurge(purgeAt: Date, now: Date = new Date()): number {
  const ms = purgeAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
