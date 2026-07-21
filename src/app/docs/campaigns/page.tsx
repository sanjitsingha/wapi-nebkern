import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
  DocsSteps,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Campaigns' };

export default function CampaignsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Growth"
        title="Campaigns"
        description="Bulk WhatsApp messages on approved templates, targeted and tracked from send to reply."
      />

      <DocsArticle>
        <p>
          Every campaign runs on a Meta-approved{' '}
          <Link href="/docs/templates">message template</Link> — WhatsApp
          doesn&apos;t allow bulk free-form text, so the template picker only ever
          shows templates that have actually been approved. Building one
          walks through four steps: choose a template, select your audience,
          personalize the message, and review before sending.
        </p>

        <h2>Choosing an audience</h2>
        <DocsFieldTable
          columns={['Option', 'What it targets']}
          rows={[
            { cells: ['All contacts', 'Every contact on the account.'] },
            { cells: ['Tags', 'Anyone carrying one or more chosen tags.'] },
            { cells: ['Custom field', 'A custom field matched by is / is not / contains.'] },
            { cells: ['Segment', 'A saved segment, re-evaluated live at send time.'] },
            { cells: ['Upload CSV', 'A one-off list of phone numbers — creates any contact that doesn’t already exist.'] },
          ]}
        />
        <p>
          Whichever audience you pick, you can also layer an{' '}
          <strong>exclude by tag</strong> list on top — useful for keeping,
          say, existing customers out of a new-lead campaign. Anyone who has
          opted out of marketing is always excluded automatically,
          regardless of audience type.
        </p>

        <h2>Personalizing the message</h2>
        <p>
          Each <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… placeholder in
          your template can be filled from three sources per recipient:
          fixed static text, a built-in contact field (name, phone, email,
          company), or one of your custom fields — resolved individually for
          every recipient when the campaign sends.
        </p>

        <h2>Sending now or scheduling</h2>
        <p>
          Send immediately and the campaign goes out right away in small
          batches with a short pause between each, so it doesn&apos;t hit
          WhatsApp&apos;s rate limits all at once. Schedule it instead and wacrm
          locks in your audience at scheduling time, then dispatches it
          automatically when the scheduled time arrives.
        </p>
        <DocsCallout type="warning">
          Sending requires an active plan — campaigns started after your
          trial has ended are blocked until you choose a plan, same as
          regular message sending. See{' '}
          <Link href="/docs/billing">Billing &amp; plans</Link>.
        </DocsCallout>

        <h2>What you can track</h2>
        <p>
          Every campaign&apos;s detail page shows six live counts:{' '}
          <strong>total recipients, sent, delivered, read, replied,</strong>{' '}
          and <strong>failed</strong> — updated as WhatsApp reports each
          message&apos;s status. A reply from someone the campaign reached is
          automatically credited back to it, so you can see which campaigns
          actually started conversations, not just which ones sent.
        </p>

        <DocsSteps
          steps={[
            {
              title: 'Choose a template',
              description: 'Only approved templates are selectable.',
            },
            {
              title: 'Select your audience',
              description:
                'All contacts, tags, a custom field match, a segment, or a CSV upload — plus an optional tag-based exclusion.',
            },
            {
              title: 'Personalize the message',
              description:
                'Fill each template variable with static text or a per-recipient contact field.',
            },
            {
              title: 'Review and send',
              description:
                'Send immediately or schedule it, then watch delivery, read, and reply counts update live.',
            },
          ]}
        />
      </DocsArticle>

      <DocsPager slug="campaigns" />
    </>
  );
}
