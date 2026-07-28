import './lp2.css';

import { lp2Display } from '@/components/lp2/font';

// ============================================================
// (marketing) — the joyful landing rebuild, promoted to `/`.
//
// This route group carries its own shell rather than reusing the old
// marketing chrome from `site-chrome.tsx`: the whole point of the
// rebuild is a different nav, a different palette and a different
// type voice, so sharing the header would defeat it. The demoted
// original at /lp-2 keeps using site-chrome.tsx unchanged; /docs
// shares this same lp2 scope + font (see src/app/docs/layout.tsx) so
// the site reads as one brand even where its tone gets more serious.
// ============================================================

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `.lp2` is the scope every token and keyframe in lp2.css hangs
    // off, so none of this page's palette can leak into the app.
    <div
      className={`lp2 ${lp2Display.variable} min-h-screen bg-(--lp2-cream) text-(--lp2-ink) antialiased`}
    >
      {children}
    </div>
  );
}
