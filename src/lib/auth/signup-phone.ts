// ============================================================
// The phone number a user registers with.
//
// Stored as E.164 with the leading '+' (profiles.phone, migration 100),
// and the database CHECKs exactly that shape. This is the one place a
// typed number becomes the stored form, shared by the signup form,
// /welcome, and the route behind /welcome — so the three can't disagree
// about what counts as valid.
//
// Pure and dependency-free: it runs in the browser and on the server.
//
// India is the default market, so a local mobile needs no country code:
// "98765 43210", "098765 43210" and "+91 98765 43210" all become
// "+919876543210". A number anywhere else must carry its "+country".
// ============================================================

/** What the database accepts. Mirrors CHECK profiles_phone_e164. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** An Indian mobile: ten digits, starting 6–9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Canonical E.164 (e.g. `+919876543210`) for a typed number, or null
 * when it isn't a number we can accept.
 */
export function normalizeSignupPhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+')) {
    // +91 is held to the Indian mobile rule. Otherwise "+91 12345678"
    // would pass as a plausibly long international number.
    if (digits.startsWith('91')) {
      return INDIAN_MOBILE.test(digits.slice(2)) ? `+${digits}` : null;
    }
    const candidate = `+${digits}`;
    return E164.test(candidate) ? candidate : null;
  }

  // No '+': read it as Indian. Leading zeros cover both a trunk "0" and
  // an international "0091" prefix.
  digits = digits.replace(/^0+/, '');
  if (INDIAN_MOBILE.test(digits)) return `+91${digits}`;
  if (
    digits.length === 12 &&
    digits.startsWith('91') &&
    INDIAN_MOBILE.test(digits.slice(2))
  ) {
    return `+${digits}`;
  }
  return null;
}

/** Shown when normalizeSignupPhone returns null. */
export const SIGNUP_PHONE_ERROR =
  'Enter a valid mobile number — e.g. 98765 43210, or with its country code (+44 7911 123456) outside India.';
