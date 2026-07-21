import type { Metadata } from 'next';
import Link from 'next/link';

import { DocsArticle, DocsCallout, DocsHero, DocsPager } from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Instagram & Messenger' };

export default function InstagramMessengerDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Channels"
        badge="Coming soon"
        title="Instagram & Messenger"
        description="Two more inboxes joining WhatsApp's — both are on the roadmap, neither is connectable yet."
      />

      <DocsArticle>
        <h2>What&apos;s coming</h2>
        <p>
          Instagram Direct Messages and Facebook Messenger will land in the
          same <strong>shared inbox</strong> your WhatsApp conversations
          already live in — one place for your team to answer every channel,
          rather than switching apps depending on where a customer wrote in
          from.
        </p>
        <p>
          When each channel ships, you&apos;ll see it as a tab in the inbox
          alongside WhatsApp, and it&apos;ll pick up the same tagging, assignment,
          and conversation-status tools described in{' '}
          <Link href="/docs/inbox">Shared inbox</Link>.
        </p>

        <DocsCallout type="info" title="Where to check status">
          Both channels currently show a <strong>&ldquo;Coming
          soon&rdquo;</strong> card under <strong>Settings → Instagram</strong> and{' '}
          <strong>Settings → Messenger</strong> instead of a connect button.
          There&apos;s nothing to configure yet — this page will be updated with
          setup steps the day either channel opens up.
        </DocsCallout>

        <h2>What to expect, once live</h2>
        <p>
          A few things will carry over directly from how WhatsApp works
          today, and a couple of things won&apos;t — worth knowing in advance so
          nothing surprises you on day one:
        </p>
        <ul>
          <li>
            Both are DM-only channels — no comments, no story replies, no
            broadcast/template system like WhatsApp&apos;s. Free-form text and
            media, back and forth.
          </li>
          <li>
            Neither platform&apos;s send API reports delivered/read receipts the
            way WhatsApp does, so messages there will show as sent rather
            than a full tick progression.
          </li>
          <li>
            Connecting either will go through Meta&apos;s standard Facebook Login
            consent screen — the same account you manage your Page and
            Instagram profile with today.
          </li>
        </ul>

        <p>
          Not signed up yet? Everything else in these docs — the inbox, CRM,
          campaigns, automations, and AI agents — already works fully on
          WhatsApp today.
        </p>
      </DocsArticle>

      <DocsPager slug="instagram-messenger" />
    </>
  );
}
