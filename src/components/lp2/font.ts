import { Manrope } from 'next/font/google';

/**
 * Manrope — shared by every surface that uses the lp2 visual language
 * (the `(marketing)` route group, /docs, /onboarding and the cookie
 * modal). Defined once here rather than called separately in each
 * layout: next/font dedupes by the loader's args, but a single source
 * of truth is what keeps two layouts from silently drifting to
 * different weights/subsets later.
 *
 * This is the same family the root layout loads as `--font-sans`, so
 * the product now reads in one typeface throughout. The separate
 * variable is kept so the lp2 CSS keeps its own hook — those surfaces
 * can diverge again later without touching the app's body font.
 *
 * A semi-geometric grotesque with a variable weight axis (200-800), so
 * the whole range comes in one file and `font-extrabold` just works.
 * No italic in the family; `italic` renders as a synthesised slant.
 */
export const lp2Display = Manrope({
  subsets: ['latin'],
  variable: '--font-lp2-display',
  display: 'swap',
});
