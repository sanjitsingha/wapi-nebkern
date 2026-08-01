// ============================================================
// "How did you hear about us?" — asked once, on /welcome.
//
// Stored as the `value` string in profiles.referral_source (free text
// on purpose, see migration 073) so this list can be reworded or
// reordered without a schema change. Keep `value` stable even when
// `label` changes, otherwise historical rows stop grouping with new
// ones in reporting.
//
// `other` is last and deliberately generic — the free-text box the
// form reveals for it is stored as `other:<what they typed>`, which
// keeps every answer in one column while staying trivially separable.
// ============================================================

export interface ReferralSource {
  value: string;
  label: string;
}

export const REFERRAL_SOURCES: readonly ReferralSource[] = [
  { value: "google", label: "Google search" },
  { value: "social", label: "Instagram, Facebook or LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "friend", label: "Friend or colleague" },
  { value: "blog", label: "Blog or article" },
  { value: "ad", label: "Online ad" },
  { value: "event", label: "Event or webinar" },
  { value: "other", label: "Other" },
] as const;

export const OTHER_REFERRAL_VALUE = "other";

/** Guard for the API route — never trust the posted value verbatim. */
export function isReferralSource(value: string): boolean {
  return REFERRAL_SOURCES.some((s) => s.value === value);
}
