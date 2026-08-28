import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import {
  SegmentsGrid,
  SegmentsHero,
  SegmentsLive,
  SegmentsTrio,
} from '@/components/lp2/feature-segments';

export const metadata: Metadata = {
  title: { absolute: 'Segments & Lists — target the right WhatsApp audience | Instant' },
  description:
    'Filter contacts by tag, pipeline stage, order history or last activity. Segments keep themselves up to date; lists hold still. Both plug straight into a campaign or an automation.',
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
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
