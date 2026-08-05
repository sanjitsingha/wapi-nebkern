import Script from 'next/script';

/**
 * Umami page-view analytics.
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
 */
export function Analytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!websiteId) return null;

  const src =
    process.env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js';

  return (
    // afterInteractive: analytics must never sit on the critical path of
    // a page someone is waiting to read.
    <Script defer strategy="afterInteractive" src={src} data-website-id={websiteId} />
  );
}
