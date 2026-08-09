'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

import '@/app/(marketing)/lp2.css';
import { lp2Display } from '@/components/lp2/font';
import { press } from '@/components/lp2/ui';
import { cn } from '@/lib/utils';
import {
  getCookieConsent,
  getCookieConsentServer,
  setCookieConsent,
  subscribeCookieConsent,
  type CookieConsent,
} from '@/lib/cookie-consent';

// ============================================================
// First-run cookie prompt inside the signed-in app.
//
// STYLING
//
// Deliberately the landing page's visual language, not the dashboard's:
// ink outlines, the hard offset shadow, DM Sans. That means pulling
// `lp2.css` and the display font into the app bundle — safe, because
// every token and rule in that file is scoped under `.lp2`, so it
// cannot leak into the dashboard's own styles. The wrapper below opens
// that scope and the font variable together.
//
// BEHAVIOUR
//
// Shown once, on the first render after sign-in where no choice is
// stored. It does not render at all on the server, and it waits for
// mount before deciding — reading localStorage during render would
// mismatch hydration and flash the modal at people who already
// answered.
//
// No close button and no escape-to-dismiss: the two buttons are the
// only exits, because "dismissed" is not an answer to a consent
// question. Focus moves to Accept on open and is trapped inside.
//
// WHAT IT ACTUALLY GATES — read this before assuming it is compliance
//
// Nothing, yet. The signed-in app sets only its own session cookies,
// which are essential and exempt. The cookies that need consent (`_ga`
// from GA4) are set on the PUBLIC marketing pages, by visitors who are
// logged out and will never see this. To make the choice binding,
// render this on the marketing layout too and have
// `components/analytics.tsx` check `getCookieConsent()` before loading
// gtag.
// ============================================================

export function CookieConsentModal() {
  // Read through useSyncExternalStore rather than copying localStorage
  // into state inside an effect: it is an external store, this is the
  // hook for exactly that, and it gets the server snapshot right so
  // nothing flashes before hydration.
  const decided = useSyncExternalStore(
    subscribeCookieConsent,
    getCookieConsent,
    getCookieConsentServer
  );

  const acceptRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const open = decided === null;

  // Focus the primary action, and keep Tab inside the panel while it is
  // up — with the page still rendered behind it, tabbing would
  // otherwise walk off into a dashboard the visitor has not consented
  // to use yet.
  useEffect(() => {
    if (!open) return;
    acceptRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables =
        panelRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  // No local state to update — writing notifies the store, which
  // re-renders this through the subscription above.
  const choose = (value: CookieConsent) => setCookieConsent(value);

  return (
    <div
      className={cn(
        'lp2 fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center',
        lp2Display.variable
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
    >
      {/* Backdrop is inert — clicking it must not count as an answer. */}
      <div aria-hidden className="absolute inset-0 bg-(--lp2-ink)/45" />

      <div
        ref={panelRef}
        className="relative w-full max-w-lg rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-cream) p-6 text-(--lp2-ink) shadow-(--lp2-shadow-lg) sm:p-8"
      >
        <span className="flex size-11 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-lemon) shadow-(--lp2-shadow-sm)">
          <Cookie className="size-5" strokeWidth={2.5} />
        </span>

        <h2
          id="cookie-consent-title"
          className="lp2-display mt-4 text-2xl leading-tight font-extrabold sm:text-3xl"
        >
          Cookies, briefly
        </h2>

        <p
          id="cookie-consent-body"
          className="mt-3 text-sm leading-relaxed text-(--lp2-ink-soft) sm:text-base"
        >
          We use a few cookies to keep you signed in and to understand which
          parts of the product get used. The ones that keep you logged in are
          essential and stay either way — the rest are up to you.
        </p>

        <p className="mt-3 text-xs leading-relaxed text-(--lp2-ink-soft)">
          You can change your mind any time. The{' '}
          <Link
            href="/cookies"
            target="_blank"
            className="font-semibold text-(--lp2-ink) underline underline-offset-2"
          >
            Cookie Policy
          </Link>{' '}
          lists every one of them.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            ref={acceptRef}
            type="button"
            onClick={() => choose('accepted')}
            className={cn(
              'inline-flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-grass) px-6 text-sm font-bold text-white shadow-(--lp2-shadow)',
              press
            )}
          >
            Accept all
          </button>

          {/* Same size and weight as Accept on purpose. A decline
              styled as a faint text link is a dark pattern — the two
              choices have to look equally available. */}
          <button
            type="button"
            onClick={() => choose('declined')}
            className={cn(
              'inline-flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-white px-6 text-sm font-bold shadow-(--lp2-shadow)',
              press
            )}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
