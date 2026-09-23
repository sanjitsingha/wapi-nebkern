import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import { KeepReading } from '@/components/lp2/keep-reading';
import {
  CampaignsCompliance,
  CampaignsGrid,
  CampaignsHero,
  CampaignsTrio,
} from '@/components/lp2/feature-campaigns';

export const metadata: Metadata = {
  title: { absolute: 'WhatsApp Broadcast Campaigns that actually arrive — Instant' },
  description:
    'Send approved WhatsApp templates to a segment, personalised per recipient, with live delivery and read rates — opt-outs handled, sends paced.',
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
        <KeepReading
          links={[
            {
              href: '/docs/campaigns',
              title: 'Sending your first broadcast campaign',
              blurb:
                'Audiences, approved templates, scheduling and delivery reports, step by step.',
            },
            {
              href: '/docs/templates',
              title: 'Getting WhatsApp templates approved',
              blurb:
                'How template categories work and what Meta looks for before it approves one.',
            },
            {
              href: '/blog/whatsapp-service-message-pricing-india',
              title: 'What WhatsApp messages cost in India',
              blurb:
                'The Meta rates behind a campaign, and what changes on October 1, 2026.',
            },
          ]}
        />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
