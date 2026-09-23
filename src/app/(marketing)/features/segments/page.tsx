import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import { KeepReading } from '@/components/lp2/keep-reading';
import {
  SegmentsGrid,
  SegmentsHero,
  SegmentsLive,
  SegmentsTrio,
} from '@/components/lp2/feature-segments';

export const metadata: Metadata = {
  title: { absolute: 'Segments & Lists — target the right WhatsApp audience | Instant' },
  description:
    'Filter WhatsApp contacts by tag, pipeline stage, orders or last activity. Segments stay up to date, lists hold still — both feed campaigns and automations.',
  alternates: { canonical: '/features/segments' },
  robots: { index: true, follow: true },
};

export default function SegmentsPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <SegmentsHero />
        <SegmentsTrio />
        <SegmentsLive />
        <SegmentsGrid />
        <KeepReading
          links={[
            {
              href: '/docs/segments-and-lists',
              title: 'Building segments and lists',
              blurb:
                'Filter contacts by tags, fields and activity, and keep the list up to date on its own.',
            },
            {
              href: '/docs/contacts',
              title: 'Importing and managing contacts',
              blurb:
                'CSV import, custom fields, tags and de-duplication.',
            },
            {
              href: '/features/campaigns',
              title: 'Send a campaign to a segment',
              blurb:
                'Broadcast an approved template to exactly the customers a segment picks out.',
            },
          ]}
        />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
