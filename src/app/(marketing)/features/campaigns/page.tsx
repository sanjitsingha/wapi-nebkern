import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import {
  CampaignsCompliance,
  CampaignsGrid,
  CampaignsHero,
  CampaignsTrio,
} from '@/components/lp2/feature-campaigns';

export const metadata: Metadata = {
  title: { absolute: 'WhatsApp Broadcast Campaigns that actually arrive — Instant' },
  description:
    'Send an approved WhatsApp template to a segment, personalised per recipient, with live delivery and read rates. Opt-outs handled and sends paced, so your number keeps its quality rating.',
  alternates: { canonical: '/features/campaigns' },
  robots: { index: true, follow: true },
};

export default function CampaignsPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <CampaignsHero />
        <CampaignsTrio />
        <CampaignsCompliance />
        <CampaignsGrid />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
