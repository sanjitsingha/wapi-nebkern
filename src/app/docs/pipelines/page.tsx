import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Pipelines & deals' };

export default function PipelinesDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Conversations & CRM"
        title="Pipelines & deals"
        description="A drag-and-drop sales CRM built around the conversations you're already having."
      />

      <DocsArticle>
        <h2>Pipelines and stages</h2>
        <p>
          You can run more than one pipeline — separate boards for different
          sales processes if you need them. Every pipeline is a set of{' '}
          <strong>stages</strong> (columns), and stages are fully yours to
          customize: add, rename, recolor, reorder, or delete them from that
          pipeline&apos;s own settings (the gear icon on its board), not from the
          main Settings area.
        </p>
        <p>A new pipeline starts with five default stages:</p>
        <ul>
          <li>New Lead</li>
          <li>Qualified</li>
          <li>Proposal Sent</li>
          <li>Negotiation</li>
          <li>Won</li>
        </ul>
        <p>
          Deals move between stages by dragging their card on the Kanban
          board — drop it in a new column and it&apos;s saved immediately.
        </p>

        <h2>What&apos;s on a deal</h2>
        <DocsFieldTable
          rows={[
            { cells: ['Title', 'Free text.'] },
            { cells: ['Value & currency', 'A number plus a currency, defaulting to your account currency.'] },
            { cells: ['Contact', 'The person the deal is tied to — optional, and if that contact is later deleted, the deal stays with its link cleared rather than disappearing.'] },
            { cells: ['Conversation', 'Optionally linked back to the chat it came from.'] },
            { cells: ['Assigned to', 'Which teammate owns it.'] },
            { cells: ['Notes, expected close date', 'Free text and an optional target date.'] },
            { cells: ['Status', 'Open, won, or lost.'] },
          ]}
        />

        <h2>Currency</h2>
        <p>
          Your account has one default currency, set under{' '}
          <strong>Settings → Customization → Deals &amp; currency</strong>{' '}
          (admin/owner only). New deals use that currency automatically, and
          pipeline and dashboard totals are shown in it.
        </p>
        <DocsCallout type="warning">
          Changing the account&apos;s default currency does <strong>not</strong>{' '}
          retroactively convert existing deals — each deal keeps whatever
          currency it was created with.
        </DocsCallout>

        <p>
          Every stage change on a deal fires a <code>deal.stage_changed</code>{' '}
          event to your configured webhooks — see{' '}
          <Link href="/docs/api-and-integrations">API &amp; integrations</Link>{' '}
          if you want to react to it elsewhere.
        </p>
      </DocsArticle>

      <DocsPager slug="pipelines" />
    </>
  );
}
