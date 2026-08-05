import type { MetadataRoute } from 'next';

// ============================================================
// /robots.txt
//
// The sitemap says what to index; this says what not to crawl. Both are
// needed: a signed-in route left out of the sitemap is still reachable
// if anything ever links to it, and Google will happily index the login
// redirect it lands on.
//
// Nothing here is a security control — every path below is already
// behind auth. It's a crawl-budget and index-hygiene measure: keep the
// crawler on the ~35 marketing pages that can rank, instead of walking
// into an app that will only ever hand it a login screen.
// ============================================================

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // The signed-in app.
        '/dashboard',
        '/inbox',
        '/contacts',
        '/lists',
        '/segments',
        '/pipelines',
        '/broadcasts',
        '/campaigns',
        '/templates',
        '/automations',
        '/flows',
        '/agents',
        '/forms',
        '/calls',
        '/media',
        '/qr-code',
        '/settings',
        '/admin',
        // Account lifecycle: nothing to index, and every one of these
        // is either per-user or single-use.
        '/onboarding',
        '/welcome',
        '/invoices',
        '/join',
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        // JSON, not pages.
        '/api',
        // The prototype landing page. Its blog is already noindexed as
        // a duplicate of /blog; this keeps the crawler off the rest.
        '/lp-2',
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
