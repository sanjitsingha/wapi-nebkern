import type { MetadataRoute } from 'next';

import { getPublishedPosts } from '@/lib/blog';

// ============================================================
// /sitemap.xml — the public surface of the site, and only that.
//
// Everything here is opt-IN. The app has ~60 routes and most of them
// are behind auth (the whole `(dashboard)` group, `admin`, `onboarding`,
// `welcome`, per-tenant `invoices/[id]` and `join/[token]`), plus the
// `(auth)` screens.
//
// A "list every route and subtract the private ones" sitemap goes wrong
// the first time someone adds a route and forgets the deny list — and
// the failure is silent and in the wrong direction, leaking an internal
// URL to Google. Listing the public pages by hand means a new dashboard
// route is invisible here by default, which is the safe way round.
//
// Blog posts are the one dynamic part: they are written in the admin
// panel and must appear without a redeploy.
// ============================================================

/** Absolute origin. Google rejects relative or mismatched hosts. */
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

/**
 * Re-generated at most once an hour. The static list below changes only
 * on deploy; this window exists for blog posts, and it keeps the
 * crawler from hitting the database on every request.
 */
export const revalidate = 3600;

/**
 * Every public page outside /docs is listed at full priority. The docs
 * sit below them: they are reference material for existing customers,
 * and a searcher landing on /docs/billing instead of /pricing is the
 * wrong way round.
 */
const TOP_PRIORITY = 1;
const DOCS_PRIORITY = 0.5;

/** Marketing pages. */
const MARKETING = [
  '',
  '/pricing',
  '/ask-maya',
  '/features/shared-inbox',
  '/features/campaigns',
  '/features/segments',
  '/features/pipelines',
  '/blog',
  '/qr-generator',
  '/contact-us',
  '/newsletter',
  '/contact',
];

/** Product documentation — one entry per `src/app/docs/*`. */
const DOCS = [
  '',
  '/getting-started',
  '/inbox',
  '/whatsapp',
  '/instagram-messenger',
  '/ai-agents',
  '/automations',
  '/flows',
  '/campaigns',
  '/templates',
  '/contacts',
  '/segments-and-lists',
  '/pipelines',
  '/media',
  '/team',
  '/account-settings',
  '/billing',
  '/api-and-integrations',
  '/support',
].map((s) => `/docs${s}`);

/** Policies and legal. */
const LEGAL = [
  '/terms',
  '/privacy',
  '/cookies',
  '/dpa',
  '/security',
  '/refunds',
  '/acceptable-use',
  '/data-retention',
  '/subprocessors',
  '/whatsapp-marketing-policy',
  '/whatsapp-messaging-policy',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // No `lastModified` on the static pages. The only date available here
  // is "now", regenerated every hour — so every page claimed to have
  // changed on every crawl, which is exactly what teaches Google the
  // field is meaningless (the reasoning on the blog posts below). A page
  // with no <lastmod> loses nothing; one with a lying one costs the
  // posts' real dates their credibility.
  const staticEntries: MetadataRoute.Sitemap = [
    ...MARKETING.map((path) => ({
      url: `${SITE}${path}`,
      changeFrequency: 'weekly' as const,
      priority: TOP_PRIORITY,
    })),
    ...DOCS.map((path) => ({
      url: `${SITE}${path}`,
      changeFrequency: 'monthly' as const,
      priority: DOCS_PRIORITY,
    })),
    ...LEGAL.map((path) => ({
      url: `${SITE}${path}`,
      changeFrequency: 'yearly' as const,
      priority: TOP_PRIORITY,
    })),
  ];

  // A database blip must not take the whole sitemap down with it —
  // Google treats a 500 as "this sitemap is broken" and can drop
  // everything in it, so a momentary Supabase outage would cost the
  // static pages too. Worst case here is a sitemap without posts.
  let posts: Awaited<ReturnType<typeof getPublishedPosts>> = [];
  try {
    // Explicit high limit: the helper defaults to 50, which is a sane
    // page size for the blog index and the wrong number for a sitemap.
    posts = await getPublishedPosts(1000);
  } catch {
    posts = [];
  }

  return [
    ...staticEntries,
    ...posts.map((post) => ({
      url: `${SITE}/blog/${post.slug}`,
      // `published_at` is the only date the table exposes to anon
      // readers. An edit therefore won't move `lastmod` — acceptable,
      // and better than claiming "modified now" on every crawl, which
      // teaches Google the field is meaningless.
      lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: TOP_PRIORITY,
    })),
  ];
}
