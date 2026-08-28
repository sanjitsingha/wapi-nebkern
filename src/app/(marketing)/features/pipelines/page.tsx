import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import {
  PipelinesAutomation,
  PipelinesGrid,
  PipelinesHero,
  PipelinesTrio,
} from '@/components/lp2/feature-pipelines';

export const metadata: Metadata = {
  title: { absolute: 'Sales Pipelines built on the conversation — Instant' },
  description:
    'Drag WhatsApp conversations through your own sales stages. The chat is the deal — full history, custom fields and owner on one record, with automations that fire on a stage change.',
  alternates: { canonical: '/features/pipelines' },
  robots: { index: true, follow: true },
};

export default function PipelinesPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <PipelinesHero />
        <PipelinesTrio />
        <PipelinesAutomation />
        <PipelinesGrid />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
