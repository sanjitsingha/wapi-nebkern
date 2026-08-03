import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsHero,
  DocsPager,
  DocsSteps,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Instagram & Messenger' };

export default function InstagramMessengerDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Channels"
        title="Instagram & Messenger"
        description="Two more inboxes alongside WhatsApp's, connected together in a single Facebook login."
      />

      <DocsArticle>
        <h2>One connection, two channels</h2>
        <p>
          Instagram Direct Messages and Facebook Messenger arrive in the same{' '}
          <strong>shared inbox</strong> your WhatsApp conversations already
          live in, with the same tagging, assignment and conversation-status
          tools described in <Link href="/docs/inbox">Shared inbox</Link>.
        </p>
        <p>
          They are set up together, not separately. As an approved{' '}
          <strong>Meta Tech Provider</strong> we ask Meta for Page and
          Instagram messaging permissions in one consent screen, and Meta
          hands back your Facebook Page along with the Instagram professional
          account linked to it. One approval, both inboxes — there are no
          tokens to copy and no second setup.
        </p>

        <h2>Connecting</h2>
        <DocsSteps
          steps={[
            {
              title: 'Open Settings → Instagram & Messenger',
              description:
                'Owners and admins can connect; agents and viewers see the panel read-only.',
            },
            {
              title: 'Click “Connect Facebook & Instagram”',
              description:
                'Facebook opens in a new browser tab — log in there and approve one permission screen, using the account that manages your Page. Your settings page stays open in its own tab, and the login tab closes itself when you are done.',
            },
            {
              title: 'Pick a Page, if you manage more than one',
              description:
                'Each Page in the list shows whether an Instagram account is linked to it. Choosing the Page connects both channels at once; a Page with no Instagram linked connects Messenger only.',
            },
          ]}
        />

        <DocsCallout type="tip" title="Instagram comes through your Page">
          Instagram DMs are reached <strong>through</strong> the Facebook Page
          your Instagram professional account is linked to — that is why the
          picker lists Pages rather than Instagram handles. If your Instagram
          account is not linked to a Page yet, link it in Meta Business Suite
          and then connect again.
        </DocsCallout>

        <h2>Setting up one channel on its own</h2>
        <p>
          Each channel on the panel has its own <strong>Connect</strong> and{' '}
          <strong>Disconnect</strong> buttons next to it, which run that
          channel&apos;s own login. Use them to add Messenger today and
          Instagram later, to replace one account without re-approving the
          other, or to switch a single channel off.
        </p>
        <p>
          <strong>Full setup</strong> on either row opens that
          channel&apos;s own page — <strong>Settings → Messenger</strong> or{' '}
          <strong>Settings → Instagram</strong> — where the webhook callback
          URL, the verify token, and (on Instagram) manual credential entry
          live.
        </p>
        <p>
          The webhook callback URLs are registered <strong>once per
          instance</strong> in Meta&apos;s App Dashboard → Webhooks, not once
          per workspace, which is why they are not on the combined page.
          Connecting always subscribes your Page to them automatically.
        </p>

        <h2>What carries over — and what doesn&apos;t</h2>
        <p>
          Most of what you know from WhatsApp applies, with two differences
          worth knowing on day one:
        </p>
        <ul>
          <li>
            Both are DM-only channels — no comments, no story replies, and no
            broadcast/template system like WhatsApp&apos;s. Free-form text and
            media, back and forth.
          </li>
          <li>
            Neither platform&apos;s send API reports delivered/read receipts the
            way WhatsApp does, so messages there show as sent rather than a
            full tick progression.
          </li>
          <li>
            Instagram DMs are a per-plan feature. If your plan does not
            include them, the connect still works and brings Messenger in —
            the panel says so instead of showing Instagram as connected.
          </li>
        </ul>

        <h2>Disconnecting</h2>
        <p>
          Both channels share one Facebook connection, so{' '}
          <strong>Disconnect both</strong> removes them together. Existing
          conversations, contacts and message history stay exactly where they
          are — only the ability to send and receive new messages goes.
        </p>

        <DocsCallout type="info" title="Connected before this changed?">
          Instagram accounts linked with the older Instagram-only login need
          to be reconnected once through the Page, and the panel will tell you
          so. Nothing else changes — the same account, the same conversations.
        </DocsCallout>
      </DocsArticle>

      <DocsPager slug="instagram-messenger" />
    </>
  );
}
