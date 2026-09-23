import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Lp2Cta } from '@/components/lp2/cta';
import { KeepReading } from '@/components/lp2/keep-reading';
import {
  InboxGrid,
  InboxHero,
  InboxHistory,
  InboxTrio,
} from '@/components/lp2/feature-inbox';

export const metadata: Metadata = {
  title: { absolute: 'Shared Team Inbox for WhatsApp, Instagram & Messenger — Instant' },
  description:
    'One WhatsApp number your whole team can answer. Assign chats, leave internal notes and keep history on the contact — WhatsApp, Instagram and Messenger.',
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
        <KeepReading
          links={[
            {
              href: '/docs/inbox',
              title: 'Setting up the shared inbox',
              blurb:
                'Assigning chats, internal notes, statuses and quick replies — the step-by-step guide.',
            },
            {
              href: '/ask-maya',
              title: 'Let Maya answer first',
              blurb:
                'Maya replies 24×7 from your own content and hands the conversation to your team when it needs a person.',
            },
            {
              href: '/features/pipelines',
              title: 'Turn chats into deals',
              blurb:
                'Move a conversation onto a sales pipeline and track it from first message to closed.',
            },
          ]}
        />
        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
