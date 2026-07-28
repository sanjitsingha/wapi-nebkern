import { DM_Sans } from 'next/font/google';

/**
 * DM Sans — shared by every surface that uses the lp2 visual language
 * (the `(marketing)` route group, and /docs). Defined once here rather
 * than called separately in each layout: next/font dedupes by the
 * loader's args, but a single source of truth is what keeps two
 * layouts from silently drifting to different weights/subsets later.
 *
 * A clean, slightly geometric grotesque with real weight (up to 1000)
 * and an optical-size axis. No `weight` — it's a variable font, so the
 * whole range comes in one file and `font-extrabold` just works.
 */
export const lp2Display = DM_Sans({
  subsets: ['latin'],
  variable: '--font-lp2-display',
  display: 'swap',
});
