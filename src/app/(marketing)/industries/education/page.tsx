import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { WaClosingCta } from '@/components/wa/closing-cta';
import { JsonLd } from '@/components/json-ld';
import {
  EducationAdmissions,
  EducationCapture,
  EducationFacts,
  EducationGrid,
  EducationHero,
  EducationTrio,
} from '@/components/lp2/industry-education';
import { getFeatureSchema } from '@/lib/marketing/schema';

// ============================================================
// /industries/education — coaching centres, institutes and EdTech.
//
// Named `education` rather than `coaching-and-edtech`: it is the word
// people search, and the page serves both. The homepage rail's
// "Coaching & EdTech" card links here.
// ============================================================

const DESCRIPTION =
  'WhatsApp for coaching centres and institutes: answer admission enquiries day or night, run admissions on a board, and send batch, exam and fee reminders to the right group.';

export const metadata: Metadata = {
  title: {
    absolute: 'Coaching & Education — Instant for WhatsApp Business',
  },
  description: DESCRIPTION,
  alternates: { canonical: '/industries/education' },
  robots: { index: true, follow: true },
  // Root openGraph is replaced wholesale rather than merged, so
  // siteName has to be repeated or the card loses the product's name.
  openGraph: {
    siteName: 'Instant for WhatsApp Business',
    title: 'Coaching & Education — Instant for WhatsApp Business',
    description: DESCRIPTION,
    url: '/industries/education',
    type: 'website',
  },
};

const schema = getFeatureSchema({
  name: 'WhatsApp for Coaching & Education',
  description: DESCRIPTION,
  path: '/industries/education',
});

export default function EducationPage() {
  return (
    <>
      <JsonLd schema={schema} />
      <Lp2Nav />
      {/* The wrapper, not <main>: the closing CTA sits outside main and
          paints `section.bg-white` too, so it needs to be inside the
          scope that overrides the cream repaint. See whatsapp.css. */}
      <div className="industry-white">
        <main>
          <EducationHero />
          <EducationTrio />
          <EducationCapture />
          <EducationAdmissions />
          <EducationGrid />
          <EducationFacts />
        </main>
        <WaClosingCta />
      </div>
      <Lp2Footer />
    </>
  );
}
