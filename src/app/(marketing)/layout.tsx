import './lp2.css';

import { lp2Display } from '@/components/lp2/font';
import { Analytics } from '@/components/analytics';
import { CookieConsentModal } from '@/components/consent/cookie-consent-modal';

// ============================================================
// (marketing) — the joyful landing rebuild, promoted to `/`.
//
// This route group carries its own shell — nav, palette and type voice
// all its own. It once coexisted with an older marketing chrome serving
// a second landing page at /lp-2; that page and its components are
// deleted, so this is the only marketing shell now. /docs shares this
// same lp2 scope + font (see src/app/docs/layout.tsx) so the site reads
// as one brand even where its tone gets more serious.
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
      {/* Public pages only — see components/analytics.tsx. The root
          layout deliberately does not carry this, so nothing inside the
          signed-in app is measured. */}
      <Analytics />
      {/* The consent prompt belongs here, not only in the app: GA4 is
          what needs consent and GA4 runs on these pages, for visitors
          who are logged out. Analytics reads the same stored choice, so
          gtag does not load until this is answered with Accept. */}
      <CookieConsentModal />
    </div>
  );
}
