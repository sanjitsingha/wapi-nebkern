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
import { WaLanding } from '@/components/wa/landing';
import { getSiteDesign } from '@/lib/marketing/site-design.server';

/** The search-result description, reused in the structured data below.
 *  Under 160 characters so Google shows it whole, and it names the
 *  company as well as the product: "instant" on its own is an ordinary
 *  word, so "Nebkern" is what ties a search to this site. */
const DESCRIPTION =
  'Instant by Nebkern Technology: WhatsApp CRM and marketing automation on the official WhatsApp Business API — shared inbox, AI replies, campaigns and follow-ups.';

// The public marketing landing page — the "joyful rebuild," promoted to
// `/` from its former home at /lp-2. The older design it replaced has
// since been deleted, so this is the only landing page. Indexed, being
// the front door.
export const metadata: Metadata = {
  title: {
    // The exact string a search result and a shared link show. Leads
    // with the product name, then what it does, then who makes it — the
    // brand is new, and "Instant" alone tells a stranger (and Google)
    // nothing.
    absolute: 'Instant — Grow your business with the help of WhatsApp',
  },
  description: DESCRIPTION,
  // One official address for the home page, whatever query string it is
  // reached with — including /?hero=chat, which renders the other hero.
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
};

// Rendered per request: the design cookie picks which composition below
// is served. Nothing here reads the database.

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

const ORGANIZATION_ID = 'https://nebkern.com/#organization';

/**
 * Structured data — who makes Instant, and what it is.
 *
 * Three linked entities in one graph:
 *
 *  - Organization: Nebkern Technology, at nebkern.com. The company site
 *    carries its own Organization markup; this ties the product to it,
 *    so Google can connect "Instant" and "Nebkern" as one brand.
 *  - WebSite: the site name Google prints above a result. Google reads it
 *    from the HOMEPAGE only, and it outranks `og:site_name` (declared in
 *    the root layout). `name` stays short on purpose — the title already
 *    says the long form, and repeating it in both slots reads as a bug.
 *  - SoftwareApplication: what Instant is, with its starting price. The
 *    ₹499/month figure mirrors src/lib/marketing/pricing-data.ts, as the
 *    landing page's pricing note does — change them together.
 */
const HOMEPAGE_FAQS = [
  { q: 'Do I need the official WhatsApp Business API?', a: 'Yes — Instant is an official Meta Tech Provider and runs on Meta’s own Cloud API, which is what keeps your number safe from bans and your messages compliant. Connecting takes a few clicks through embedded signup, and we walk you through it.' },
  { q: 'What does “official Meta Tech Provider” actually mean?', a: 'Meta reviews and approves the companies allowed to build on the WhatsApp Business Platform, and Instant is one of them. In practice it means you connect to Meta directly — embedded signup on your own WhatsApp Business Account, direct Cloud API access, and message charges billed to you by Meta at Meta’s published rates, with no reseller sitting in the middle taking a cut.' },
  { q: 'Can my whole team use one WhatsApp number?', a: 'That is exactly what Instant is for. Everyone works from a shared inbox on the same number, with assignments, internal notes and the full conversation history — no more forwarding screenshots.' },
  { q: 'How does the AI agent actually learn my business?', a: 'You upload your own knowledge base — product docs, FAQs, policies. It answers routine questions instantly, writes lead details into contact fields, and hands off to a human whenever it should. Test everything in the playground before it goes anywhere near a customer.' },
  { q: 'What happens when the free trial ends?', a: 'Your 14-day trial includes every feature. When it ends, pick a plan to keep sending — your data, contacts and history stay untouched either way.' },
  { q: 'Can I send bulk broadcasts?', a: 'Yes — build campaigns on Meta-approved templates, target them with tags, lists and segments, and watch delivery and read stats update in real time.' },
  { q: 'Does it connect to my other tools?', a: 'Zapier, Make and n8n via outbound webhooks (message received, contact created, deal stage changed, and more), plus a REST API for creating contacts or sending messages from any system you already run.' },
  { q: 'Can I bring Instagram and Messenger in too?', a: 'Yes — on plans with those channels, Instagram DMs and Messenger threads land in the same shared inbox, so one team covers all three.' },
];

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'Nebkern Technology',
      alternateName: 'Nebkern',
      url: 'https://nebkern.com/',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Siliguri',
        addressRegion: 'West Bengal',
        addressCountry: 'IN',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Instant',
      alternateName: [
        'Instant by Nebkern',
        'Instant — WhatsApp CRM & Marketing Automation',
        'Instant — Grow your business with the help of WhatsApp',
      ],
      url: `${SITE_URL}/`,
      inLanguage: 'en-IN',
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#software`,
      name: 'Instant',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: `${SITE_URL}/`,
      description: DESCRIPTION,
      publisher: { '@id': ORGANIZATION_ID },
      offers: { '@type': 'Offer', price: '499', priceCurrency: 'INR' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: HOMEPAGE_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    },
  ],
};

export default async function Lp2Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { design } = await getSiteDesign();

  // The centred hero is the live one. /?hero=chat still renders the
  // earlier chat-bubble hero — see Hero in components/wa/landing.tsx —
  // and shares this page's canonical, so it is never indexed separately.
  const heroVariant = (await searchParams).hero === 'chat' ? 'chat' : 'centered';

  const jsonLd = (
    <script
      type="application/ld+json"
      // Static object we control — no user input reaches it.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
    />
  );

  // The WhatsApp design (whatsapp.design.md) gets its own composition —
  // the playful sections below lean on stickers and colour blocking that
  // do not survive being flattened. Nav and footer are shared; the
  // layout's data-design attribute restyles them.
  if (design === 'whatsapp') {
    return (
      <>
        {jsonLd}
        <Lp2Nav />
        <main>
          <WaLanding hero={heroVariant} />
        </main>
        <Lp2Footer />
      </>
    );
  }

  return (
    <>
      {jsonLd}
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
        {/* Hidden for now: The WhatsApp Business app, or the API? */}
        {false && <Lp2Compare />}
        <Lp2Features />
        <Lp2AiPerformance />

        {/* Placed here on purpose: the product story ends above, and
            "does it fit the stack I already run?" is the first
            practical objection once someone believes the story. */}
        {/* Hidden for now: Connect the stack you already run */}
        {false && <Lp2Integrations />}

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
