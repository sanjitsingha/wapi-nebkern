import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Flows' };

export default function FlowsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Automation & AI"
        title="Flows"
        badge="Beta"
        description="A visual, no-code builder for multi-step conversations — menus, FAQ bots, lead capture, and anything with branches."
      />

      <DocsArticle>
        <p>
          Where an <Link href="/docs/automations">automation</Link> runs one
          straight-line rule, a Flow is a small conversation of its own —
          built as a canvas of connected steps rather than a single trigger
          and action list.
        </p>

        <h2>Building blocks</h2>
        <DocsFieldTable
          columns={['Node', 'What it does']}
          rows={[
            { cells: ['Send message', 'Reply with text.'] },
            { cells: ['Send buttons', 'Offer up to 3 quick-reply buttons.'] },
            { cells: ['Send list', 'Offer a scrollable list of up to 10 options across sections.'] },
            { cells: ['Send media', 'Send an image, video, or document.'] },
            { cells: ['Collect input', 'Capture the customer&rsquo;s next reply into a variable you can reuse later in the flow.'] },
            { cells: ['If / else', 'Branch based on a captured variable, a tag, or a contact field.'] },
            { cells: ['Tag contact', 'Add or remove a tag.'] },
            { cells: ['Handoff to agent', 'End the automated part and hand the conversation to a teammate, optionally with a note.'] },
            { cells: ['End', 'Finish the run.'] },
          ]}
        />

        <h2>Starting a flow</h2>
        <p>A flow can start on a conversation in three ways:</p>
        <ul>
          <li>
            <strong>Keyword</strong> — the customer&rsquo;s message matches
            one you&rsquo;ve chosen.
          </li>
          <li>
            <strong>First message from contact</strong> — automatically for
            anyone messaging in for the first time.
          </li>
          <li>
            <strong>Manual</strong> — you assign it to a specific
            conversation yourself from the inbox, the same way you&rsquo;d
            assign a teammate or your AI agent.
          </li>
        </ul>

        <h2>Starter templates</h2>
        <p>
          Three ready-made flows are available to clone and adapt rather than
          building from a blank canvas: a <strong>Welcome menu</strong>, an{' '}
          <strong>FAQ bot</strong>, and a <strong>Lead capture</strong> flow.
        </p>

        <h2>Draft, active, archived</h2>
        <p>
          A flow is a <strong>Draft</strong> while you&rsquo;re building it,{' '}
          <strong>Active</strong> once published and able to run on real
          conversations, or <strong>Archived</strong> when retired.
          Activating checks the flow for structural problems first — a node
          left disconnected, a required field left empty — and blocks
          publishing until they&rsquo;re fixed.
        </p>

        <h2>When a customer goes off-script</h2>
        <p>
          If a reply doesn&rsquo;t match what a step expected, the flow
          reprompts (up to a couple of tries) before handing the
          conversation off to a human rather than looping forever. A flow
          also times out after a period of inactivity, handing off the same
          way.
        </p>

        <DocsCallout type="info" title="Testing a flow">
          There isn&rsquo;t a separate simulated test mode yet — building
          confidence in a flow currently means running it against a real
          conversation (your own test contact works well) and reviewing its
          run history afterward.
        </DocsCallout>
      </DocsArticle>

      <DocsPager slug="flows" />
    </>
  );
}
