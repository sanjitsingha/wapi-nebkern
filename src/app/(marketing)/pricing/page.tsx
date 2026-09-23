import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { KeepReading } from '@/components/lp2/keep-reading';
import { PricingCards } from '@/components/lp2/pricing-cards';
import {
  PricingHero,
  MetaPricingBlock,
  HowMayaWorks,
  AddonsBlock,
  CompetitorComparison,
  PricingFaq,
  PricingFinalCta,
} from '@/components/lp2/pricing-page';

// The dedicated pricing page. Plan data (prices, features, add-ons, the
// competitor comparison, FAQ) all come from src/lib/marketing/pricing-data.ts
// so the numbers live in one place. Fully static — nothing here reads the
// database or the request; the plan CTAs point at /signup, which starts the
// trial and later lands the buyer on the in-app checkout.
export const metadata: Metadata = {
  alternates: { canonical: '/pricing' },
  title: { absolute: 'Pricing — Maya AI included, zero markup on Meta' },
  description:
    'Instant pricing: flat monthly plans with Maya AI included and Meta charges at zero markup. Starter ₹499, Growth ₹799, Business ₹999/mo. 14-day free trial.',
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <PricingHero />
        <PricingCards />
        <KeepReading
          heading="The features behind the plans"
          links={[
            {
              href: '/features/shared-inbox',
              title: 'Shared WhatsApp team inbox',
              blurb:
                'One WhatsApp number your whole team can answer — assign chats, leave notes, keep history on the contact.',
            },
            {
              href: '/features/campaigns',
              title: 'WhatsApp broadcast campaigns',
              blurb:
                'Approved templates sent to a segment, personalised per recipient, with live delivery and read rates.',
            },
            {
              href: '/features/segments',
              title: 'Contact segments and lists',
              blurb:
                'Filter contacts by tag, pipeline stage, orders or last activity, and feed campaigns and automations.',
            },
            {
              href: '/features/pipelines',
              title: 'WhatsApp sales pipelines',
              blurb:
                'Drag conversations through your own sales stages — the chat is the deal, history and all.',
            },
          ]}
        />
        <MetaPricingBlock />
        <HowMayaWorks />
        <AddonsBlock />
        <CompetitorComparison />
        <PricingFaq />
        <KeepReading
          padBottom
          links={[
            {
              href: '/blog/whatsapp-service-message-pricing-india',
              title: 'WhatsApp service message pricing in India',
              blurb:
                'The INR rate from October 1, 2026, the 1,000 free messages, and what your Meta bill will look like.',
            },
            {
              href: '/blog/whatsapp-automation-the-complete-guide-for-businesses-in-2026',
              title: 'WhatsApp automation: the complete 2026 guide',
              blurb:
                'What to automate, how automated messages are sent, and how to choose WhatsApp marketing software.',
            },
            {
              href: '/ask-maya',
              title: 'Maya, the AI agent in every plan',
              blurb:
                'See how Maya answers customers from your own catalog and FAQs, and hands off to your team.',
            },
          ]}
        />
        <PricingFinalCta />
      </main>
      <Lp2Footer />
    </>
  );
}
