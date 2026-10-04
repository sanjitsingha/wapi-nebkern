import { PLANS, FAQS as PRICING_FAQS } from '@/lib/marketing/pricing-data';
import type { Comparison } from '@/lib/marketing/comparisons';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

export const ORGANIZATION_ID = 'https://nebkern.com/#organization';

/**
 * The product's full name, as it should appear in metadata, schema and
 * anywhere Google reads a brand.
 *
 * "WhatsApp" is Meta's own capitalisation and the rest of the site
 * already uses it; spelling it "Whatsapp" in the one place search
 * engines read the brand would be the wrong half to be casual about.
 *
 * BRAND_SHORT is not a fallback — it is the name used in running prose
 * ("Instant answers them while you sleep"), where the full one would
 * read as an advert. Both are declared to search engines: the full name
 * as `name`, the short one as `alternateName`.
 */
export const BRAND = 'Instant for WhatsApp Business';
export const BRAND_SHORT = 'Instant';

export const ORGANIZATION_SCHEMA = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'Nebkern Technology',
  alternateName: 'Nebkern',
  url: 'https://nebkern.com/',
  logo: 'https://media.instant.nebkern.com/assets/meta-logo.png',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Siliguri',
    addressRegion: 'West Bengal',
    addressCountry: 'IN',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@nebkern.com',
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['en', 'hi'],
  },
};

export const WEBSITE_SCHEMA = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: BRAND,
  // Names only. A tagline in alternateName tells Google the brand is
  // called "Grow your business with the help of WhatsApp", which it is
  // not — these are the other things people actually type.
  alternateName: [BRAND_SHORT, 'Instant WhatsApp', 'Instant by Nebkern'],
  url: `${SITE_URL}/`,
  inLanguage: 'en-IN',
  publisher: { '@id': ORGANIZATION_ID },
};

/** Build a Schema.org BreadcrumbList */
export function getBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/** Build a Schema.org FAQPage */
export function getFaqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };
}

/** Build Schema.org Product & AggregateOffer for the Pricing page */
export function getPricingSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION_SCHEMA,
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Pricing', path: '/pricing' },
      ]),
      {
        '@type': 'Product',
        '@id': `${SITE_URL}/pricing#product`,
        name: BRAND,
        description:
          'Flat monthly plans with Maya AI included and Meta charges at zero markup on the official WhatsApp Business API.',
        url: `${SITE_URL}/pricing`,
        brand: {
          '@type': 'Brand',
          name: BRAND,
        },
        publisher: { '@id': ORGANIZATION_ID },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: '499',
          highPrice: '999',
          offerCount: PLANS.length,
          offers: PLANS.map((plan) => ({
            '@type': 'Offer',
            name: `${BRAND_SHORT} ${plan.name} Plan`,
            price: plan.monthlyPrice.toString(),
            priceCurrency: 'INR',
            priceValidUntil: '2027-12-31',
            url: `${SITE_URL}/pricing`,
            description: plan.tagline,
            category: 'Subscription',
          })),
        },
      },
      getFaqSchema(PRICING_FAQS),
    ],
  };
}

/** Build Schema.org SoftwareApplication for feature pages */
export function getFeatureSchema({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION_SCHEMA,
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Features', path: '/#features' },
        { name, path },
      ]),
      {
        '@type': 'SoftwareApplication',
        name: `${BRAND} — ${name}`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: `${SITE_URL}${path}`,
        description,
        publisher: { '@id': ORGANIZATION_ID },
        offers: {
          '@type': 'Offer',
          price: '499',
          priceCurrency: 'INR',
        },
      },
    ],
  };
}

/** Build Schema.org WebPage / Comparison for comparison pages */
export function getComparisonPageSchema(comparison: Comparison) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION_SCHEMA,
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Compare', path: '/compare' },
        { name: `Instant vs ${comparison.rival}`, path: `/compare/${comparison.slug}` },
      ]),
      {
        '@type': 'WebPage',
        name: comparison.title,
        description: comparison.metaDescription,
        url: `${SITE_URL}/compare/${comparison.slug}`,
        publisher: { '@id': ORGANIZATION_ID },
      },
    ],
  };
}

/** Build Schema.org WebApplication for QR Code generator */
export function getQrGeneratorSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION_SCHEMA,
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'QR Code Generator', path: '/qr-generator' },
      ]),
      {
        '@type': 'WebApplication',
        name: `Free WhatsApp QR Code Generator — ${BRAND_SHORT}`,
        description:
          'Create free, custom WhatsApp QR codes that open directly into chat with pre-filled messages. Download in print-ready PNG and vector SVG.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'All',
        url: `${SITE_URL}/qr-generator`,
        publisher: { '@id': ORGANIZATION_ID },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
        },
      },
    ],
  };
}

/** Build Schema.org ContactPage for contact pages */
export function getContactSchema({ isForm = false }: { isForm?: boolean } = {}) {
  const path = isForm ? '/contact-us' : '/contact';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION_SCHEMA,
      getBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: isForm ? 'Contact Us' : 'Contact Details & Grievance', path },
      ]),
      {
        '@type': 'ContactPage',
        name: isForm
          ? `Contact ${BRAND_SHORT}`
          : `Contact Details & Grievance Officer — ${BRAND_SHORT}`,
        url: `${SITE_URL}${path}`,
        mainEntity: ORGANIZATION_SCHEMA,
      },
    ],
  };
}
