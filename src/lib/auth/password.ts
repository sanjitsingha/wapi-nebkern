// ============================================================
// Password policy — one definition, every place a password is set.
//
// Used by the signup form and the recovery form (NewPasswordForm).
// Keeping the rules here rather than inline in each form is the whole
// point: a policy enforced only at signup is bypassed by anyone who
// registers with a weak-but-legal password... then never changes it,
// or by resetting to something weaker.
//
// This is CLIENT-SIDE UX. It shapes the form and the error copy; it is
// not the enforcement boundary. Supabase/GoTrue applies whatever
// minimum length and character-class policy is configured on the
// project (Auth -> Providers -> Email), and that check runs regardless
// of what the browser sent. Set the dashboard policy to match these
// constants — otherwise a scripted POST can still register a weaker
// password than the form would ever allow.
// ============================================================

/** Floor for a new password. Mirror this in the Supabase dashboard. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * The symbol set GoTrue accepts, character for character:
 *
 *   !@#$%^&*()_+-=[]{};'\:"|<>?,./`~
 *
 * Deliberately NOT the looser `[^A-Za-z0-9]`. GoTrue's "requires
 * symbols" check tests membership of this exact set, so a password
 * whose only non-alphanumeric is something outside it — `£`, an em
 * dash, an emoji — clears a permissive browser check and is then
 * rejected server-side with a generic "password does not meet
 * requirements". Better to fail in the checklist, where the rule is
 * visible, than after submit with nothing to act on.
 */
const PASSWORD_SYMBOLS = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/;

export interface PasswordRule {
  /** Stable key — used as a React list key and in tests. */
  id: string;
  /** Shown in the live checklist under the password field. */
  label: string;
  test: (value: string) => boolean;
}

/**
 * Order matters: this is the order the checklist renders in, and
 * `firstPasswordError` reports the earliest unmet rule, so the most
 * basic failure (too short) is the one surfaced first.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lowercase",
    label: "One lowercase letter (a–z)",
    test: (v) => /[a-z]/.test(v),
  },
  {
    id: "uppercase",
    label: "One uppercase letter (A–Z)",
    test: (v) => /[A-Z]/.test(v),
  },
  {
    id: "number",
    label: "One number (0–9)",
    test: (v) => /[0-9]/.test(v),
  },
  {
    id: "special",
    label: "One special character (!@#$…)",
    test: (v) => PASSWORD_SYMBOLS.test(v),
  },
] as const;

export interface PasswordRuleState {
  rule: PasswordRule;
  met: boolean;
}

/** Every rule with its pass/fail state — drives the live checklist. */
export function checkPassword(value: string): PasswordRuleState[] {
  return PASSWORD_RULES.map((rule) => ({ rule, met: rule.test(value) }));
}

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

/**
 * The first unmet rule's label, or null when the password passes.
 * For the single-line error banner on submit; the checklist above the
 * button already shows the full picture.
 */
export function firstPasswordError(value: string): string | null {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : null;
}
