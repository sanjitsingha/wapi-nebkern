import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Two-factor authentication, on Supabase's native MFA.
//
// Nothing here stores a secret, generates a code, or checks one. All of
// that lives in GoTrue: `supabase.auth.mfa.*` holds the TOTP seed, and
// the session's Authenticator Assurance Level (AAL) records whether the
// second factor has been presented. This file is the vocabulary the app
// uses to talk about that, so the rules live in one place instead of
// being re-derived in each component.
//
// Why TOTP and not an emailed code: an emailed code is a second factor
// only if the mailbox is a second thing, and for most people it is the
// same inbox that can already reset the password. TOTP needs a device
// the attacker does not have. It also needs no delivery infrastructure,
// costs nothing per login, and works on a plane.
// ============================================================

/**
 * AAL1 — signed in with one factor (password or Google).
 * AAL2 — that, plus a verified second factor this session.
 *
 * `nextLevel` is what the user COULD reach: it reads `aal2` when they
 * have a verified factor enrolled, whatever the current session has
 * done. The gap between the two is the whole enforcement rule.
 */
export type Aal = 'aal1' | 'aal2';

export interface MfaStatus {
  /** A verified factor exists, so logins are challenged. */
  enrolled: boolean;
  /** This session has cleared the challenge. */
  satisfied: boolean;
  /**
   * Enrolled, but this session is still at aal1 — the user is holding a
   * half-finished login and must present a code before going further.
   */
  challengeRequired: boolean;
  /** The verified factor's id, for unenrolling. */
  factorId: string | null;
}

const UNKNOWN: MfaStatus = {
  enrolled: false,
  satisfied: true,
  challengeRequired: false,
  factorId: null,
};

/**
 * Read where the current session stands.
 *
 * Fails OPEN — a network blip or an unexpected shape reports "no 2FA
 * required" rather than locking someone out of their account. That is
 * the right trade for a per-user, self-enrolled factor: the cost of a
 * false negative is one login that skipped a code, and the cost of a
 * false positive is a user who cannot get in at all and cannot fix it
 * from the outside. Revisit this the day 2FA becomes mandatory
 * org-wide, where the calculus flips.
 */
export async function readMfaStatus(
  supabase: SupabaseClient,
): Promise<MfaStatus> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return UNKNOWN;

    const enrolled = data.nextLevel === 'aal2';
    const satisfied = data.currentLevel === 'aal2';

    let factorId: string | null = null;
    if (enrolled) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      factorId = factors?.totp?.[0]?.id ?? null;
    }

    return {
      enrolled,
      satisfied: !enrolled || satisfied,
      challengeRequired: enrolled && !satisfied,
      factorId,
    };
  } catch {
    return UNKNOWN;
  }
}

/**
 * Supabase keeps unverified factors around when an enrolment is
 * abandoned — closing the dialog on the QR step leaves one behind, and
 * a second attempt then trips over the duplicate friendly name.
 * Clearing them before enrolling makes "try again" actually work.
 */
export async function clearUnverifiedFactors(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.listFactors();
  const stale = (data?.all ?? []).filter((f) => f.status === 'unverified');
  await Promise.all(
    stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
  );
}

/** What we label the factor in Supabase. Users see this nowhere; it is
 *  for whoever is reading the auth dashboard. */
export const TOTP_FRIENDLY_NAME = 'Authenticator app';

/** TOTP codes are always six digits. Used to gate the submit button and
 *  to auto-submit once the field is full. */
export const OTP_LENGTH = 6;

/** Strip anything that is not a digit and cap at six — authenticator
 *  apps show the code as "123 456" and that is what gets pasted. */
export function normaliseOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

/**
 * Turn a GoTrue MFA error into something a person can act on.
 *
 * The raw messages are written for whoever is integrating the API, not
 * for someone squinting at their phone — "invalid TOTP code entered"
 * does not tell them the most common cause, which is a clock drifting
 * on one side or the other.
 */
export function mfaErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && m.includes('code')) {
    return 'That code was not accepted. Codes expire every 30 seconds — try the current one, and check your phone’s clock is set automatically.';
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute before trying again.';
  }
  if (m.includes('expired')) {
    return 'That challenge expired. Close this and start again.';
  }
  return message;
}
