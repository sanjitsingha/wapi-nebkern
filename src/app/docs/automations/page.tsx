import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Automations' };

export default function AutomationsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Automation & AI"
        title="Automations"
        badge="Beta"
        description="Simple trigger → condition → action rules — the fast way to handle a routine reply without building a full Flow."
      />

      <DocsArticle>
        <p>
          An automation is one trigger, an optional set of conditions, and
          one or more actions that run in order. For anything with multiple
          branching steps — a menu, a multi-turn conversation — reach for{' '}
          <Link href="/docs/flows">Flows</Link> instead; automations are
          built for single, direct rules.
        </p>

        <h2>Triggers</h2>
        <DocsFieldTable
          columns={['Trigger', 'Fires when']}
          rows={[
            { cells: ['New message received', 'Any inbound WhatsApp message arrives.'] },
            { cells: ['First message from contact', "A contact's very first message comes in."] },
            { cells: ['Keyword match', 'An inbound message contains — or exactly matches — one of your chosen keywords.'] },
            { cells: ['New contact created', 'A brand-new contact is created from an inbound message.'] },
          ]}
        />

        <h2>Conditions</h2>
        <p>
          Narrow when an automation should actually act, beyond just its
          trigger firing:
        </p>
        <ul>
          <li><strong>Tag presence</strong> — the contact does or doesn&apos;t carry a given tag.</li>
          <li><strong>Contact field</strong> — a field on the contact equals a value.</li>
          <li><strong>Message content</strong> — the inbound text contains a given phrase.</li>
          <li><strong>Time of day</strong> — only within (or outside) a set time range, including ranges that cross midnight.</li>
        </ul>

        <h2>Actions</h2>
        <DocsFieldTable
          columns={['Action', 'What it does']}
          rows={[
            { cells: ['Send message / Send template / Send buttons', 'Reply with text, a template, or a quick-reply button set.'] },
            { cells: ['Add tag / Remove tag', "Change the contact's tags."] },
            { cells: ['Assign conversation', 'Hand the thread to a teammate.'] },
            { cells: ['Update contact field', 'Write to name, email, company, marketing opt-out, or a custom field.'] },
            { cells: ['Create deal', 'Open a new deal in your default currency.'] },
            { cells: ['Wait', 'Pause before continuing to the next action.'] },
            { cells: ['Condition (if / else)', 'Branch the remaining actions.'] },
            { cells: ['Send webhook', 'POST a message to a URL of your choice.'] },
            { cells: ['Close conversation', 'Mark the conversation closed.'] },
          ]}
        />

        <p>
          A message or webhook action can include the inbound message text
          via <code>{'{{message.text}}'}</code>, or a value you captured
          earlier in the same run via <code>{'{{vars.<key>}}'}</code>.
        </p>

        <DocsCallout type="info" title="AI and automations don't double-reply">
          If an active automation would respond to a message (or its keyword
          actually matches), your{' '}
          <Link href="/docs/ai-agents">AI agent</Link> stands down on that
          message rather than sending its own reply too.
        </DocsCallout>
      </DocsArticle>

      <DocsPager slug="automations" />
    </>
  );
}
