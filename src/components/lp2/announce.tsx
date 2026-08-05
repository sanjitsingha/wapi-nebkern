'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

// ============================================================
// Marketing announcement bar — the strip above the nav.
//
// Distinct from `components/layout/announcement-bar.tsx`, which is the
// admin-managed bar inside the signed-in app. This one is public,
// static, and edited here in code: a landing-page announcement changes
// when the marketing does, and routing that through the database would
// add a query to every anonymous pageview to render one sentence.
//
// Set `ANNOUNCEMENT` to null to remove the bar entirely — the nav's
// sticky offset does not depend on it, so nothing else needs touching.
// ============================================================

const ANNOUNCEMENT: {
  /** Bumping this makes the bar reappear for people who dismissed the
   *  previous one — otherwise a new announcement is invisible to every
   *  returning visitor, which is exactly who it is meant for. */
  id: string;
  badge: string;
  text: string;
  href: string;
  cta: string;
} | null = {
  id: 'wa-calling-2026-08',
  badge: 'New',
  text: 'WhatsApp calling is live — answer customer calls right inside your inbox.',
  href: '/#features',
  cta: 'See what’s new',
};

const DISMISS_KEY = 'wacrm:lp-announce-dismissed';

export function Lp2Announce() {
  // Starts VISIBLE and hides after mount if this visitor already
  // dismissed it. The dismissal lives in localStorage, which the server
  // cannot read, so one of two compromises is unavoidable:
  //
  //   start hidden → the bar pops in after hydration and pushes the
  //                  whole page down. That hits every FIRST-time
  //                  visitor, which on a landing page is most of them,
  //                  and it is a layout shift on the one screen where
  //                  first impressions matter.
  //
  //   start shown  → returning visitors who dismissed it see it for a
  //                  frame before it goes.
  //
  // The second is the better trade: it affects fewer people, and a brief
  // flash is milder than the page jumping under someone's cursor.
  const [show, setShow] = useState(true);

  // Reading localStorage is exactly the "synchronise with an external
  // system the server cannot see" case the rule exists to allow, and
  // there is no callback to hang it off — the value is already there at
  // mount. Same block-disable pattern as deal-form.tsx.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!ANNOUNCEMENT) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === ANNOUNCEMENT.id) {
        setShow(false);
      }
    } catch {
      // Private mode or storage disabled — leave it showing.
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!ANNOUNCEMENT || !show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, ANNOUNCEMENT.id);
    } catch {
      // Not persisting a dismissal is a smaller problem than crashing.
    }
  };

  return (
    // Not sticky: it scrolls away and leaves the nav behind. An
    // announcement is worth one look, and permanently spending 40px of
    // a laptop screen on it is not the trade it deserves.
    <div className="relative z-50 bg-(--lp2-ink) text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2.5 sm:px-6">
        <p className="flex min-w-0 items-center gap-2.5 text-center text-[13px] font-medium">
          <span className="hidden shrink-0 rounded-full bg-(--lp2-lemon) px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-(--lp2-ink) uppercase sm:inline-flex">
            {ANNOUNCEMENT.badge}
          </span>
          <span className="truncate sm:whitespace-normal">{ANNOUNCEMENT.text}</span>
          <Link
            href={ANNOUNCEMENT.href}
            className="hidden shrink-0 items-center gap-1 font-bold underline underline-offset-4 transition-colors hover:text-(--lp2-lemon) md:inline-flex"
          >
            {ANNOUNCEMENT.cta}
            <ArrowRight className="size-3.5" strokeWidth={2.75} />
          </Link>
        </p>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 flex size-6 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white sm:right-5"
        >
          <X className="size-3.5" strokeWidth={2.75} />
        </button>
      </div>
    </div>
  );
}
