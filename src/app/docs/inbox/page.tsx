import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Shared inbox' };

export default function InboxDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Conversations & CRM"
        title="Shared inbox"
        description="Every conversation, on every connected channel, in one place your whole team works from."
      />

      <DocsArticle>
        <h2>Conversation status</h2>
        <p>
          Every conversation is <strong>Open</strong>, <strong>Pending</strong>,
          or <strong>Closed</strong> — a small colored dot on each row shows
          which (green for open, amber for pending, gray for closed). Use the
          status filter chip above the list to see just one state, or
          &ldquo;All.&rdquo;
        </p>

        <h2>Who&apos;s handling a conversation</h2>
        <p>
          A conversation can be handled by exactly one of three things at a
          time:
        </p>
        <ul>
          <li>
            <strong>A teammate</strong> — assigned to a specific person on
            your team.
          </li>
          <li>
            <strong>A Flow (bot)</strong> — one of your automated conversation
            flows is driving the thread. See <Link href="/docs/flows">Flows</Link>.
          </li>
          <li>
            <strong>Your AI agent</strong> — set to auto-reply on this thread
            regardless of your account-wide AI settings. See{' '}
            <Link href="/docs/ai-agents">AI agents</Link>.
          </li>
        </ul>
        <p>
          The <strong>Filter</strong> panel above the conversation list lets
          you filter by any combination of AI agent / Bot / Team member at
          once (matching any of your selections) — leave nothing selected to
          see conversations regardless of who&apos;s handling them.
        </p>

        <h2>Channel tabs</h2>
        <p>
          Above the search box, tabs split the inbox into{' '}
          <strong>All / WhatsApp / Messenger / Instagram</strong>, each
          showing a live count. WhatsApp is the channel available today —
          see <Link href="/docs/instagram-messenger">Instagram &amp; Messenger</Link>{' '}
          for their status.
        </p>

        <h2>Tags and other filters</h2>
        <p>
          Filter the list down to conversations whose contact carries a
          specific tag, or open the <strong>Filter</strong> panel for more:
          the conversation&apos;s start date (a from/to range) and which
          teammate it&apos;s assigned to. An <strong>Unread</strong> chip shows only
          conversations with unread messages.
        </p>

        <h2>The 24-hour reply window (WhatsApp)</h2>
        <p>
          WhatsApp only allows free-form replies within{' '}
          <strong>24 hours of the customer&apos;s last message</strong> —
          outside that window, only pre-approved message templates can be
          sent. wacrm shows a countdown badge next to the customer&apos;s name in the
          conversation list so you always know how much time is left: it
          turns amber under 6 hours, red under 2 hours, and disappears once
          the window has closed. When the window is closed, the message
          composer disables free-text and points you to sending a template
          instead.
        </p>
        <DocsCallout type="info">
          This 24-hour rule is a WhatsApp platform policy, not a wacrm limit
          — it exists on every WhatsApp Business API tool. See{' '}
          <Link href="/docs/templates">Message templates</Link> for how to
          reach a customer outside the window.
        </DocsCallout>

        <h2>Composing a message</h2>
        <p>
          What you can send depends on the channel. On WhatsApp:
        </p>
        <DocsFieldTable
          columns={['Type', 'Notes']}
          rows={[
            { cells: ['Text', 'Free-form, subject to the 24-hour window above.'] },
            { cells: ['Image / video', 'Available on every channel.'] },
            { cells: ['Document / voice note', 'WhatsApp only. Voice notes record up to 5 minutes and are captured directly in the browser.'] },
            { cells: ['Templates', 'WhatsApp only — the template picker button only appears on WhatsApp conversations.'] },
            { cells: ['Reply / quote', 'Quote a specific earlier message when replying — WhatsApp only.'] },
            { cells: ['Reactions', 'React to a message with an emoji — WhatsApp only.'] },
          ]}
        />
        <p>
          Media captions are capped at 1,024 characters. An{' '}
          <strong>AI draft</strong> button is also available in the composer
          when your AI agent is active on the conversation — it drafts a
          reply for you to review and send, rather than sending automatically.
        </p>

        <h2>Delivery status</h2>
        <p>
          Each of your outgoing messages shows a small status icon: a clock
          while sending, a single check once sent, a double check once
          delivered, and a blue double check once read. If a message fails
          to send, it shows as failed rather than silently disappearing.
        </p>

        <h2>Notes on a contact</h2>
        <p>
          The contact panel next to the conversation (open it from the
          expand icon) holds notes about that person — reminders, context,
          anything your team wants to remember about them. These are notes
          on the <strong>contact&apos;s record</strong>, visible whenever you open
          that contact from any conversation, rather than private messages
          embedded inside one specific chat thread.
        </p>

        <h2>Search, unread, and presence</h2>
        <ul>
          <li>
            <strong>Search</strong> matches against the contact&apos;s name,
            phone number, Instagram/Messenger id, and the text of their last
            message.
          </li>
          <li>
            <strong>Unread counts</strong> show as a badge on each
            conversation and clear automatically once you open it.
          </li>
          <li>
            <strong>Presence</strong> shows which of your teammates are
            currently online or viewing a conversation — useful for avoiding
            two people replying to the same customer at once. This reflects
            your team&apos;s presence, not whether the customer is online.
          </li>
        </ul>
      </DocsArticle>

      <DocsPager slug="inbox" />
    </>
  );
}
