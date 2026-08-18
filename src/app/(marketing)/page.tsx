import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Hero } from '@/components/lp2/hero';
import { Lp2Industries } from '@/components/lp2/industries';
import { Lp2Features } from '@/components/lp2/features';

import { Lp2AiPerformance } from '@/components/lp2/ai-performance';
import { Lp2Integrations } from '@/components/lp2/integrations';
import { Lp2Compare } from '@/components/lp2/compare';

import { Lp2Apart } from '@/components/lp2/apart';
import { Lp2PricingNote } from '@/components/lp2/pricing-note';
import { Lp2Faq } from '@/components/lp2/faq';
import { Lp2Cta } from '@/components/lp2/cta';
import { Lp2Footer } from '@/components/lp2/footer';

// The public marketing landing page — the "joyful rebuild," promoted to
// `/` from its former home at /lp-2. The older design it replaced has
// since been deleted, so this is the only landing page. Indexed, being
// the front door.
export const metadata: Metadata = {
  title: {
    // The exact string a search result and a shared link show. Leads
    // with the product name, then what it does — the brand is new, so
    // "Instant" alone tells a stranger nothing.
    absolute: 'Instant — WhatsApp Marketing Automation',
  },
  description:
    'One shared inbox, AI agents that reply in seconds, and campaigns, pipelines and automations that turn every WhatsApp question into a paid order. From an official Meta Tech Provider.',
  robots: { index: true, follow: true },
};

// Fully static — nothing here reads the database or the request, so it
// prerenders once at build time.

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

/**
 * Site-name structured data.
 *
 * Google reads the name it prints above a result from the HOMEPAGE
 * only, and this outranks `og:site_name` in its list of signals — so
 * both are declared: this here, the OG tag in the root layout.
 *
 * `name` is short on purpose. The site name sits directly above the
 * blue title, and the title is already "Instant — WhatsApp Marketing
 * Automation"; putting the same sentence in both slots prints it twice
 * and reads as a bug. `alternateName` is the correct home for the
 * longer form, and Google may use it where the short one is ambiguous.
 */
const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Instant',
  alternateName: 'Instant — WhatsApp Marketing Automation',
  url: `${SITE_URL}/`,
};

export default function Lp2Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static object we control — no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />
      <Lp2Nav />
      <main>
        <Lp2Hero />
        {/* Straight after the hero, where a logo cloud normally goes:
            "is this for a business like mine?" is the question that
            comes before any feature. */}
        <Lp2Industries />
        {/* The problem, before any of the solution.
            This used to sit down at position nine, read as an objection
            handler among the other objection handlers. It is not one.
            Everyone arriving here already sells on WhatsApp, on the
            free Business app, and the question under every feature
            below is "why isn't the thing I have — which costs nothing —
            enough?" Answer it after six sections of features and those
            six sections read as a paid version of what they already
            own. Answer it here and they read as the fix for a ceiling
            the visitor has just been shown they are standing under. */}
        <Lp2Compare />
        <Lp2Features />
        <Lp2AiPerformance />

        {/* Placed here on purpose: the product story ends above, and
            "does it fit the stack I already run?" is the first
            practical objection once someone believes the story. */}
        <Lp2Integrations />

        <Lp2Apart />
        {/* Still no pricing block — plans live on /pricing, linked from
            the nav and the footer. This is one line, not that section
            returning: the flat-fee promise is the reason someone picks
            us over a reseller, and until now it appeared on this page
            only as a single stat tile inside the band above. A claim
            that load-bearing should not be something you have to read a
            four-up of numbers to find. */}
        <Lp2PricingNote />
        <Lp2Faq />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
