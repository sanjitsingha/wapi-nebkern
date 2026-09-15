import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import {
  MayaHero,
  MayaOverview,
  MayaAssistant,
  MayaFlows,
  MayaAutomations,
  MayaChooser,
} from '@/components/lp2/ask-maya';

export const metadata: Metadata = {
  title: { absolute: 'Ask Maya — the AI assistant, Flows & Automations behind Instant' },
  description:
    'Maya, an AI assistant trained on your own knowledge base, plus visual Flows and rule-based Automations — so no WhatsApp customer waits on a sleeping team.',
  // The page moved from /autopilot; without this, the old URL and the
  // new one both describe the same content to a crawler that has the
  // former indexed. next.config.ts 301s the old path, and this names
  // the winner outright.
  alternates: { canonical: '/ask-maya' },
  robots: { index: true, follow: true },
};

export default function AskMayaPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <MayaHero />
        <MayaOverview />
        <MayaAssistant />
        <MayaFlows />
        <MayaAutomations />
        <MayaChooser />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
