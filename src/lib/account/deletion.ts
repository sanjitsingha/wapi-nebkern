// ============================================================
// Account deletion — the 30-day window and its recovery tokens.
//
// Server-only: uses node:crypto and is imported by API routes and the
// purge cron. Nothing here touches the database; the callers own that,
// so this stays testable and has one job.
// ============================================================

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { RECOVERY_TOKEN_TTL_HOURS } from './deletion-window';

// The window's constants and arithmetic live in `./deletion-window`,
// which client components can import — this module cannot be pulled
// into a browser bundle because of `node:crypto` above. Re-exported so
// server-side callers still have one import to reach for.
export {
  DELETION_WINDOW_DAYS,
  RECOVERY_TOKEN_TTL_HOURS,
  daysUntilPurge,
  purgeDateFrom,
} from './deletion-window';

export interface RecoveryToken {
  /** Goes in the emailed link. Never stored. */
  token: string;
  /** Stored. What an attacker with the database gets instead. */
  hash: string;
  expiresAt: Date;
}

/**
 * Mint a recovery token.
 *
 * 32 random bytes, hex-encoded — the same shape as the cron secret the
 * docs tell operators to generate. Long enough that guessing is not a
 * strategy, so the lookup can be a plain hash match without a rate
 * limiter standing behind it (there is one anyway, on the request
 * route, because sending mail is the expensive part).
 */
export function mintRecoveryToken(now: Date = new Date()): RecoveryToken {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(now);
  expiresAt.setUTCHours(expiresAt.getUTCHours() + RECOVERY_TOKEN_TTL_HOURS);
  return { token, hash: hashRecoveryToken(token), expiresAt };
}

/** SHA-256, hex. Not a password KDF on purpose: this is 256 bits of
 *  uniform randomness with a 24-hour life, so there is no dictionary to
 *  slow an attacker down against. */
export function hashRecoveryToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare for two hex hashes of equal length. */
export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Absolute URL for the emailed link. Relative would be useless in an
 *  inbox, and the host has to come from config rather than the request
 *  so a spoofed Host header cannot redirect the link somewhere else. */
export function recoveryLink(token: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://instant.nebkern.com'
  ).replace(/\/+$/, '');
  return `${base}/account-recovery/confirm?token=${encodeURIComponent(token)}`;
}

function shell(body: string): string {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#191826;max-width:520px">${body}</div>`;
}

/**
 * Sent the moment deletion is confirmed.
 *
 * Goes to the owner whether or not they are the one who pressed the
 * button — if the request came from a session that is not theirs, this
 * mail is how they find out while there is still time to undo it.
 */
export function deletionScheduledEmail(args: {
  accountName: string;
  purgeAt: Date;
  actorEmail: string | null;
}): { subject: string; html: string; text: string } {
  const when = args.purgeAt.toUTCString();
  const by = args.actorEmail ? ` by ${args.actorEmail}` : '';
  const link = `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://instant.nebkern.com').replace(/\/+$/, '')}/account-recovery`;

  return {
    subject: `Your Instant account is scheduled for deletion`,
    html: shell(`
      <p>Deletion of <strong>${args.accountName}</strong> was requested${by}.</p>
      <p>The account is now locked — nobody can sign in to it. Its data will
      be permanently deleted on <strong>${when}</strong>.</p>
      <p>If this was not intended, you can restore the account any time before
      then: <a href="${link}">${link}</a>. We will email a confirmation link to
      this address.</p>
      <p>After that date the data cannot be recovered.</p>
    `),
    text:
      `Deletion of ${args.accountName} was requested${by}.\n\n` +
      `The account is now locked and its data will be permanently deleted on ${when}.\n\n` +
      `If this was not intended, restore it before then at:\n${link}\n\n` +
      `After that date the data cannot be recovered.`,
  };
}

/** The recovery link itself. */
export function recoveryEmail(args: {
  accountName: string;
  token: string;
  purgeAt: Date;
}): { subject: string; html: string; text: string } {
  const link = recoveryLink(args.token);
  const deadline = args.purgeAt.toUTCString();

  return {
    subject: `Restore your Instant account`,
    html: shell(`
      <p>Someone asked to restore <strong>${args.accountName}</strong>.</p>
      <p><a href="${link}">Restore the account</a></p>
      <p>This link works once and expires in ${RECOVERY_TOKEN_TTL_HOURS} hours.
      The account itself can be restored until <strong>${deadline}</strong>,
      after which its data is gone for good.</p>
      <p>If you did not ask for this, ignore this email — the deletion stays
      scheduled and nothing changes.</p>
    `),
    text:
      `Someone asked to restore ${args.accountName}.\n\n` +
      `Restore the account:\n${link}\n\n` +
      `This link works once and expires in ${RECOVERY_TOKEN_TTL_HOURS} hours. ` +
      `The account can be restored until ${deadline}, after which its data is gone for good.\n\n` +
      `If you did not ask for this, ignore this email — the deletion stays scheduled.`,
  };
}
