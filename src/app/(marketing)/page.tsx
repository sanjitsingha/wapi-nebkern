import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Hero } from '@/components/lp2/hero';
import { Lp2Features } from '@/components/lp2/features';
import { Lp2AiAgents } from '@/components/lp2/ai-agents';
import { Lp2Automations } from '@/components/lp2/automations';
import { Lp2Steps } from '@/components/lp2/steps';
import { Lp2Testimonials } from '@/components/lp2/testimonials';
import { Lp2Pricing } from '@/components/lp2/pricing';
import { Lp2Faq } from '@/components/lp2/faq';
import { Lp2Cta } from '@/components/lp2/cta';
import { Lp2Footer } from '@/components/lp2/footer';

// The public marketing landing page — the "joyful rebuild," promoted
// to `/` from its former home at /lp-2 (which now hosts the original
// design as a secondary variant). Indexed since this is the front door.
export const metadata: Metadata = {
  title: {
    absolute: 'wacrm — Make WhatsApp your happiest sales channel',
  },
  description:
    'One shared inbox, AI agents that reply in seconds, and campaigns, pipelines and automations that turn every WhatsApp question into a paid order.',
  robots: { index: true, follow: true },
};

// Fully static — nothing here reads the database or the request, so it
// prerenders once at build time.

export default function Lp2Page() {
  return (
    <>
      <Lp2Nav />
      <main>
        <Lp2Hero />
        <Lp2Features />
        <Lp2AiAgents />
        <Lp2Automations />
        <Lp2Steps />
        <Lp2Testimonials />
        <Lp2Pricing />
        <Lp2Faq />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
