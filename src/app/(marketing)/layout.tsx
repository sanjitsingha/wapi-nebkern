import { DM_Sans } from 'next/font/google';

import './lp2.css';

// ============================================================
// /lp-2 — the joyful landing rebuild.
//
// This route carries its own shell rather than reusing the marketing
// chrome from `site-chrome.tsx`: the whole point of the rebuild is a
// different nav, a different palette and a different type voice, so
// sharing the header would defeat it. `/` is untouched.
// ============================================================

/**
 * DM Sans powers the whole /lp-2 experience — both body copy and
 * headings (lp2.css points the base font-family and `.lp2-display` at
 * this same variable). A clean, slightly geometric grotesque with real
 * weight (up to 1000) and an optical-size axis. Scoped to this route:
 * it loads only when someone visits /lp-2, so the dashboard and the
 * existing landing page pay nothing for it.
 *
 * No `weight` — it's a variable font, so the whole range comes in one
 * file and `font-extrabold` on a heading just works.
 */
const display = DM_Sans({
  subsets: ['latin'],
  variable: '--font-lp2-display',
  display: 'swap',
});

export default function Lp2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `.lp2` is the scope every token and keyframe in lp2.css hangs
    // off, so none of this page's palette can leak into the app.
    <div
      className={`lp2 ${display.variable} min-h-screen bg-(--lp2-cream) text-(--lp2-ink) antialiased`}
    >
      {children}
    </div>
  );
}
