import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import { KeepReading } from '@/components/lp2/keep-reading';
import {
  PipelinesAutomation,
  PipelinesGrid,
  PipelinesHero,
} from '@/components/lp2/feature-pipelines';

export const metadata: Metadata = {
  title: { absolute: 'Sales Pipelines built on the conversation — Instant' },
  description:
    'Drag WhatsApp conversations through your own sales stages. The chat is the deal: history, custom fields and owner on one record, with stage automations.',
  alternates: { canonical: '/features/pipelines' },
  robots: { index: true, follow: true },
};

export default function PipelinesPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <PipelinesHero />
        <PipelinesAutomation />
        <PipelinesGrid />
        <KeepReading
          links={[
            {
              href: '/docs/pipelines',
              title: 'Setting up pipelines and deals',
              blurb:
                'Stages, deal values and moving deals along, the step-by-step guide.',
            },
            {
              href: '/features/shared-inbox',
              title: 'Where deals start: the shared inbox',
              blurb:
                'Every deal links back to the WhatsApp conversation it came from.',
            },
            {
              href: '/blog/whatsapp-automation-the-complete-guide-for-businesses-in-2026',
              title: 'WhatsApp automation: the complete 2026 guide',
              blurb:
                'Follow-ups and reminders that keep deals moving without anyone chasing them.',
            },
          ]}
        />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
