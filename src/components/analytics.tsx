'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';

import {
  getCookieConsent,
  getCookieConsentServer,
  subscribeCookieConsent,
} from '@/lib/cookie-consent';

/**
 * Page-view analytics: Umami and Google Analytics 4.
 *
 * Both live behind this one component on purpose. Scope is enforced by
 * where it is rendered — `(marketing)/layout.tsx` and `docs/layout.tsx`
 * — so a second provider added here inherits the same boundary instead
 * of being wired into the layouts separately and drifting out of sync
 * the first time someone adds a third.
 *
 * SCOPE: public pages only — the marketing site and the docs. It is
 * deliberately NOT in the root layout, so nothing inside the signed-in
 * app is measured. Two reasons:
 *
 *   1. What the analytics are for is the funnel — which pages bring
 *      people in, which ones lose them. Once someone has signed in, the
 *      questions worth asking are about their workspace, and those are
 *      answerable from our own database without involving a third party.
 *
 *   2. Page paths inside the app carry identifiers — /inbox?c=<uuid>,
 *      /contacts/<id> — so measuring them would ship customer record ids
 *      to an outside service for no benefit.
 *
 * Configured, not hardcoded: this repository is MIT and self-hostable,
 * so a baked-in website id would send every fork's traffic to one
 * account. Unset means no script, no request, and no subprocessor —
 * which is why the Subprocessor List lists Umami under "only if you
 * enable the feature".
 *
 * To also measure the login/signup pages, render this from
 * `src/app/(auth)/layout.tsx` as well.
 *
 * CONSENT
 *
 * GA4 sets `_ga`, which is a non-essential cookie, so it does not load
 * until the visitor has actually accepted. Before a choice exists,
 * nothing is rendered — the prompt is what appears first. Umami is
 * unconditional because it is cookieless and stores nothing on the
 * device; that is the whole reason it was chosen, and gating it would
 * lose the traffic numbers for no gain in privacy.
 */
export function Analytics() {
  const consent = useSyncExternalStore(
    subscribeCookieConsent,
    getCookieConsent,
    getCookieConsentServer
  );

  return (
    <>
      <Umami />
      {consent === 'accepted' && <GoogleAnalytics />}
    </>
  );
}

function Umami() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!websiteId) return null;

  const src =
    process.env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js';

  return (
    // afterInteractive: analytics must never sit on the critical path of
    // a page someone is waiting to read.
    <Script
      defer
      strategy="afterInteractive"
      src={src}
      data-website-id={websiteId}
    />
  );
}

/**
 * Google Analytics 4 (gtag.js).
 *
 * The measurement id is configured rather than hardcoded for the same
 * reason as Umami's: this repository is MIT and self-hostable, and a
 * baked-in `G-…` would point every fork's traffic at one property.
 * Unset means no script and no request — so a fork is not silently
 * reporting to us, and GA does not appear on pages nobody opted into.
 *
 * GA4's enhanced measurement picks up client-side route changes from
 * browser history events, so the App Router's soft navigations are
 * counted without a route-change listener here.
 */
function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script
        async
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
      />
      {/* Inline scripts need an `id` for Next to track and dedupe them.
          The id is interpolated into a template string, so it is kept to
          the characters a GA measurement id can contain — anything else
          would be injecting arbitrary text into a <script> body. */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id.replace(/[^A-Za-z0-9-_]/g, '')}');`}
      </Script>
    </>
  );
}
