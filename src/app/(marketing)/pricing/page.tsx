import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Pricing } from '@/components/lp2/pricing';
import { Lp2Cta } from '@/components/lp2/cta';
import { Lp2Footer } from '@/components/lp2/footer';
import {
  PricingHero,
  PricingNoPerMessage,
  PricingMatrix,
  PricingFaq,
} from '@/components/lp2/pricing-page';

// The dedicated pricing page the nav points at. The plan cards are the
// same <Lp2Pricing> block the landing page shows — reused rather than
// recreated, since three tiers of copy maintained in two files would
// disagree within a release. `compareLink` is off here: the matrix it
// links to is further down this very page.
export const metadata: Metadata = {
  title: { absolute: 'Pricing — flat monthly plans, no per-message fees' },
  description:
    'Plans from ₹100/month with every core feature included. No per-message or per-contact charges from us — Meta bills your WhatsApp account directly at its own rates. Compare Try, Pro and Business side by side.',
  robots: { index: true, follow: true },
};

// Fully static — nothing here reads the database or the request.

export default function PricingPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <PricingHero />
        <Lp2Pricing compareLink={false} />
        <PricingNoPerMessage />
        <PricingMatrix />
        <PricingFaq />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
