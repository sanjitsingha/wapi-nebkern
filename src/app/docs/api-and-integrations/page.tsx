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
        description="Create contacts and send messages from your own systems, and get notified the moment something happens in Instant."
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
          to verify the request really came from Instant rather than trusting
          the payload blindly. If your endpoint doesn&rsquo;t respond
          successfully, delivery is retried several times with a growing
          delay before it&rsquo;s given up on.
        </p>

        <h2>Zoho CRM</h2>
        <p>
          Let Zoho events — a new lead, a deal stage change, an overdue
          invoice — send WhatsApp messages through Instant. It works in two
          halves: connect the account once, then point a Zoho{' '}
          <strong>Workflow Rule</strong> at Instant so it delivers the event.
        </p>

        <h3>1. Connect Zoho in Instant</h3>
        <p>
          Go to <strong>Settings → Integrations → Zoho CRM → Connect</strong>{' '}
          and approve read access. After connecting, open{' '}
          <strong>Manage</strong> on the same card — it shows a{' '}
          <strong>webhook URL</strong> ending in{' '}
          <code>/api/integrations/zoho/webhook/…</code>. Copy it; you&rsquo;ll
          paste it into Zoho in the next step.
        </p>

        <h3>2. Create the Workflow Rule in Zoho</h3>
        <p>
          In Zoho CRM, go to{' '}
          <strong>
            Setup → Automation → Workflow Rules → Create Rule
          </strong>
          . Pick the module (Leads, Contacts, Deals…) and when it should
          fire (record created, edited, a field changes). Then, under{' '}
          <strong>Instant Actions → Webhooks</strong>, create a new webhook and
          fill it in:
        </p>
        <DocsFieldTable
          columns={['Field', 'What to enter']}
          rows={[
            { cells: ['Method', 'POST'] },
            {
              cells: [
                'URL to Notify',
                'The webhook URL copied from Instant (the Manage view).',
              ],
            },
            { cells: ['Authorization Type', 'General'] },
            {
              cells: [
                'Module Parameters',
                'Add the record fields to send. Include the phone (Phone and/or Mobile) — plus Full Name / Last Name, Email, and any field you want to use in the message.',
              ],
            },
            {
              cells: [
                'Custom Parameters',
                'Optional static values, e.g. event = lead_created (becomes {{vars.event}}).',
              ],
            },
            { cells: ['Body → Type', 'None — the parameters travel in the URL.'] },
          ]}
        />
        <p>
          Save the webhook, associate it with the Workflow Rule, and save the
          rule. Zoho now calls Instant every time the rule fires.
        </p>

        <DocsCallout type="info">
          A phone number is required to reach anyone. If the fields you add
          carry no phone (Phone or Mobile), Instant records the event so you
          can inspect it, but no message goes out — add the phone field to the
          Module Parameters and the number needs its country code (Indian
          10-digit numbers are auto-prefixed with 91).
        </DocsCallout>

        <h3>3. Build the automation in Instant</h3>
        <p>
          Create an <Link href="/docs/automations">Automation</Link> with the
          trigger <strong>Zoho event</strong>. Every field you added in the
          Workflow Rule is available as{' '}
          <code>{'{{vars.field_name}}'}</code> — lowercased with spaces turned
          into underscores, so Zoho&rsquo;s <code>Deal Name</code> becomes{' '}
          <code>{'{{vars.deal_name}}'}</code>. Three are always present
          whatever the rule sent: <code>{'{{vars.zoho_module}}'}</code>,{' '}
          <code>{'{{vars.zoho_record_id}}'}</code> and{' '}
          <code>{'{{vars.zoho_event}}'}</code>.
        </p>

        <h2>Zapier, Make, n8n</h2>
        <p>
          There&rsquo;s no dedicated app in any of these marketplaces yet —
          connect them the same way any custom system would:{' '}
          <strong>outbound webhooks</strong> as the trigger into your
          automation tool, and the <strong>REST API</strong> (with an API
          key) as the action it calls back into Instant.
        </p>
      </DocsArticle>

      <DocsPager slug="api-and-integrations" />
    </>
  );
}
