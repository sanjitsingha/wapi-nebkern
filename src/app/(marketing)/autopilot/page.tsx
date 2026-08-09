import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import {
  AutopilotHero,
  AutopilotOverview,
  AutopilotAiBot,
  AutopilotFlows,
  AutopilotAutomations,
  AutopilotChooser,
} from '@/components/lp2/autopilot';

export const metadata: Metadata = {
  title: { absolute: 'Autopilot — the AI Bot, Flows & Automations behind Instant' },
  description:
    'Three systems, one job: an AI Bot trained on your own knowledge base, visual Flows for multi-step conversations, and rule-based Automations for everything else — so no customer waits on a human who is asleep.',
  robots: { index: true, follow: true },
};

export default function AutopilotPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <AutopilotHero />
        <AutopilotOverview />
        <AutopilotAiBot />
        <AutopilotFlows />
        <AutopilotAutomations />
        <AutopilotChooser />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
