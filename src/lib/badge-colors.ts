/**
 * Soft "pill" badge colour classes — light-first, dark-aware.
 *
 * The app defaults to light mode, so each badge leads with a solid
 * tint-50 fill + tint-700 text + tint-200 border (crisp, high-contrast
 * on white) and layers the translucent dark-mode treatment behind the
 * `dark:` variant. Use these instead of ad-hoc `text-*-400` strings,
 * which were tuned for the old dark default and wash out on a light
 * surface.
 *
 * Keeping every variant in one map keeps status pills consistent
 * across broadcasts, automations, templates, members, etc. — change a
 * colour here, change it everywhere.
 */

export type BadgeColor =
  | "neutral"
  | "primary"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "teal";

export const softBadge: Record<BadgeColor, string> = {
  // Neutral + primary ride the theme tokens so they track mode/accent.
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
  green:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  amber:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25",
  purple:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/25",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/25",
};
