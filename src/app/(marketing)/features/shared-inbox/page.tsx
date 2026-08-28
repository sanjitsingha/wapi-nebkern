import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import {
  InboxGrid,
  InboxHero,
  InboxHistory,
  InboxTrio,
} from '@/components/lp2/feature-inbox';

export const metadata: Metadata = {
  title: { absolute: 'Shared Team Inbox for WhatsApp, Instagram & Messenger — Instant' },
  description:
    'One WhatsApp number your whole team can answer. Assign conversations, leave internal notes, and keep every message on the customer record — across WhatsApp, Instagram and Messenger.',
  alternates: { canonical: '/features/shared-inbox' },
  robots: { index: true, follow: true },
};

export default function SharedInboxPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <InboxHero />
        <InboxTrio />
        <InboxHistory />
        <InboxGrid />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
