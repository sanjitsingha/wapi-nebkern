import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import { KeepReading } from '@/components/lp2/keep-reading';
import { JsonLd } from '@/components/json-ld';
import {
  D2cAutomations,
  D2cFacts,
  D2cGrid,
  D2cHero,
  D2cMaya,
  D2cTrio,
} from '@/components/lp2/industry-d2c';
import { getFeatureSchema } from '@/lib/marketing/schema';

// ============================================================
// /industries/d2c-ecommerce — the first industry page.
//
// The homepage rail links here; before this existed those buttons
// pointed at the nearest feature page instead. The other four
// industries still do, and each will want a sibling of this file.
// ============================================================

const DESCRIPTION =
  'WhatsApp for D2C and eCommerce: recover abandoned carts, send order and delivery updates, and let AI answer sizing and returns — one number, one inbox, Meta’s own rates.';

export const metadata: Metadata = {
  title: {
    absolute: 'WhatsApp for D2C & eCommerce brands — Instant',
  },
  description: DESCRIPTION,
  alternates: { canonical: '/industries/d2c-ecommerce' },
  robots: { index: true, follow: true },
  // Root openGraph is replaced wholesale rather than merged, so
  // siteName has to be repeated or the card loses the product's name.
  openGraph: {
    siteName: 'Instant',
    title: 'WhatsApp for D2C & eCommerce brands — Instant',
    description: DESCRIPTION,
    url: '/industries/d2c-ecommerce',
    type: 'website',
  },
};

const schema = getFeatureSchema({
  name: 'WhatsApp for D2C & eCommerce',
  description: DESCRIPTION,
  path: '/industries/d2c-ecommerce',
});

export default function D2cEcommercePage() {
  return (
    <>
      <JsonLd schema={schema} />
      <Lp2Nav />
      <main>
        <D2cHero />
        <D2cTrio />
        <D2cAutomations />
        <D2cMaya />
        <D2cGrid />
        <D2cFacts />
        <KeepReading
          links={[
            {
              href: '/features/campaigns',
              title: 'Broadcast campaigns',
              blurb:
                'Approved templates to a segment, personalised per recipient, with delivery and read rates counted.',
            },
            {
              href: '/ask-maya',
              title: 'Maya answers first',
              blurb:
                'The AI agent replies from your own catalogue and policies, and hands over the moment a person is needed.',
            },
            {
              href: '/pricing',
              title: 'What Instant costs',
              blurb:
                'Three plans, the whole product on each, and Meta’s conversation charges billed to you at Meta’s own rates.',
            },
          ]}
        />
      </main>
      <Lp2Cta />
      <Lp2Footer />
    </>
  );
}
