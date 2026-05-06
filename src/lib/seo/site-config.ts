/**
 * Single source of truth for anything the SEO layer needs to know
 * about the site — base URL, brand name, headline copy, social
 * handles. Import from here everywhere (metadata, JSON-LD, sitemap,
 * robots, OG image) so a rename or domain change is a one-file edit.
 */

/** Production origin — used to resolve all absolute URLs in metadata. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://wacrm.tech'

export const SITE_NAME = 'CRM Template for WhatsApp'

export const SITE_TAGLINE = 'Run your WhatsApp business from one inbox'

/** Default description — reused by layout metadata and structured data. */
export const SITE_DESCRIPTION =
  'A CRM template for WhatsApp built for small teams: shared inbox, contact hub, sales pipelines, broadcasts, and no-code automations — built on the official WhatsApp Business API.'

/**
 * Keyword targets. Search engines largely ignore the meta keywords
 * field, but a couple still use it and it's a cheap inclusion.
 */
export const SITE_KEYWORDS = [
  'WhatsApp CRM',
  'WhatsApp Business CRM',
  'WhatsApp shared inbox',
  'WhatsApp Business API',
  'WhatsApp automation',
  'WhatsApp broadcast',
  'customer messaging platform',
  'sales pipeline CRM',
  'team inbox',
]

/** Public hero image for OG / Twitter previews. */
export const OG_IMAGE_PATH = '/opengraph-image'
export const OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`

/** Organization info surfaced in JSON-LD. */
export const ORG_INFO = {
  name: SITE_NAME,
  legalName: 'CRM Template for WhatsApp',
  url: SITE_URL,
  logo: `${SITE_URL}/icon`,
}

/**
 * Helper: absolute-URL a relative path using SITE_URL.
 * Use this instead of string concat so trailing-slash handling stays
 * consistent.
 */
export function absoluteUrl(path = '/'): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${trimmed}`
}
