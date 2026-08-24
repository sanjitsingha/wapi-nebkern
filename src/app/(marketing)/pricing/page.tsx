import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
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
  title: { absolute: 'Pricing — Maya AI included, zero markup on Meta' },
  description:
    'Instant by Nebkern: a flat platform fee with Maya AI included and Meta charges passed through at zero markup. Starter ₹499, Growth ₹799, Business ₹999/mo — plus a 14-day free trial. All prices exclude 18% GST.',
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <PricingHero />
        <PricingCards />
        <MetaPricingBlock />
        <HowMayaWorks />
        <AddonsBlock />
        <CompetitorComparison />
        <PricingFaq />
        <PricingFinalCta />
      </main>
      <Lp2Footer />
    </>
  );
}
