import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/site-config'

/**
 * robots.txt served at /robots.txt. We explicitly disallow every
 * gated area so crawlers don't spend their budget on pages they'll
 * bounce off. Auth pages are closed off too — no SEO value, and
 * we don't want a "Sign in" page competing with the landing page
 * in SERPs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/inbox',
          '/contacts',
          '/pipelines',
          '/broadcasts',
          '/automations',
          '/settings',
          '/login',
          '/signup',
          '/forgot-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
