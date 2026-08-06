import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Hero } from '@/components/lp2/hero';
import { Lp2Features } from '@/components/lp2/features';
import { Lp2AiAgents } from '@/components/lp2/ai-agents';
import { Lp2Automations } from '@/components/lp2/automations';
import { Lp2AiPerformance } from '@/components/lp2/ai-performance';
import { Lp2Integrations } from '@/components/lp2/integrations';
import { Lp2Compare } from '@/components/lp2/compare';
import { Lp2Testimonials } from '@/components/lp2/testimonials';
import { Lp2Pricing } from '@/components/lp2/pricing';
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

export default function Lp2Page() {
  return (
    <>
      <Lp2Nav />
      <main>
        <Lp2Hero />
        <Lp2Features />
        <Lp2AiAgents />
        <Lp2Automations />
        <Lp2AiPerformance />
        {/* Placed here on purpose: the product story ends with the
            payoff section above, and "does it fit the stack I already
            run?" is the first practical objection after that — before
            the plan comparison and pricing. */}
        <Lp2Integrations />
        <Lp2Compare />
        <Lp2Testimonials />
        <Lp2Pricing />
        <Lp2Faq />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
