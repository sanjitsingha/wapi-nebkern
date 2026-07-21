import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsCode,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'API & integrations' };

export default function ApiAndIntegrationsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Developers"
        title="API & integrations"
        description="Create contacts and send messages from your own systems, and get notified the moment something happens in wacrm."
      />

      <DocsArticle>
        <h2>API keys</h2>
        <p>
          Generate a key under <strong>Settings → API Access</strong>{' '}
          (requires the integrations feature on your plan). Send it on every
          request as a header:
        </p>
        <DocsCode label="Header">{'x-api-key: wak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}</DocsCode>
        <p>
          A new key can read templates and send messages by default. Keep it
          secret — anyone holding it can send messages as your account.
        </p>

        <h2>REST API</h2>
        <h3>Create or find a contact</h3>
        <DocsCode label="POST /api/v1/contacts">{`{
  "phone": "+91XXXXXXXXXX",
  "name": "Optional name"
}`}</DocsCode>
        <p>
          Safe to call repeatedly with the same phone number — it finds and
          returns the existing contact instead of creating a duplicate.
        </p>

        <h3>Send a template message</h3>
        <DocsCode label="POST /api/v1/messages">{`{
  "to": "+91XXXXXXXXXX",
  "template": { "name": "order_update", "language": "en_US" },
  "params": ["12345", "Tomorrow"]
}`}</DocsCode>
        <p>
          <code>params</code> fill the template&rsquo;s{' '}
          <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… placeholders in
          order — see <Link href="/docs/templates">Message templates</Link>.
          A message sent this way also appears in your shared inbox, exactly
          as if it had been sent from inside the app.
        </p>

        <DocsCallout type="info">
          Only approved templates can be sent — the same rule as sending
          from the inbox or a campaign. There&rsquo;s no endpoint to list
          contacts or messages yet; these two routes are for creating
          contacts and sending, not for reading data back out.
        </DocsCallout>

        <h2>Outbound webhooks</h2>
        <p>
          Register a public HTTPS URL under{' '}
          <strong>Settings → Integrations</strong> and choose which events to
          receive:
        </p>
        <DocsFieldTable
          columns={['Event', 'Fires when']}
          rows={[
            { cells: ['message.received', 'A customer sends an inbound WhatsApp message.'] },
            { cells: ['contact.created', 'A new contact is created.'] },
            { cells: ['conversation.assigned', 'A conversation is assigned to a teammate.'] },
            { cells: ['deal.stage_changed', 'A deal moves to a different pipeline stage.'] },
          ]}
        />
        <p>
          Each delivery is a signed <code>POST</code> with the event payload
          as JSON. A signing secret is shown once, at creation time — use it
          to verify the request really came from wacrm rather than trusting
          the payload blindly. If your endpoint doesn&rsquo;t respond
          successfully, delivery is retried several times with a growing
          delay before it&rsquo;s given up on.
        </p>

        <h2>Zapier, Make, n8n</h2>
        <p>
          There&rsquo;s no dedicated app in any of these marketplaces yet —
          connect them the same way any custom system would:{' '}
          <strong>outbound webhooks</strong> as the trigger into your
          automation tool, and the <strong>REST API</strong> (with an API
          key) as the action it calls back into wacrm.
        </p>
      </DocsArticle>

      <DocsPager slug="api-and-integrations" />
    </>
  );
}
