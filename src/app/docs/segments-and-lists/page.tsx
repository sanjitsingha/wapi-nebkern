import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Segments & lists' };

export default function SegmentsAndListsDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Conversations & CRM"
        title="Segments & lists"
        description="Two different ways to group contacts for targeting — pick the one that fits how the group is defined."
      />

      <DocsArticle>
        <h2>Lists — a group you build by hand</h2>
        <p>
          A <strong>List</strong> is a named collection with explicit
          membership: you add contacts to it yourself, one by one or several
          at once from a contact picker. It stores no rules — just
          references to whichever contacts you put in it, plus a running
          total count. Removing a contact from a list only removes that
          membership; the contact itself is untouched. Lists can be marked
          active or archived.
        </p>
        <p>
          Use a list when the group is something <strong>you</strong> curate
          — &ldquo;customers I met at this trade show,&rdquo; &ldquo;VIP
          accounts,&rdquo; a hand-picked set for a one-off campaign.
        </p>

        <h2>Segments — a group defined by rules</h2>
        <p>
          A <strong>Segment</strong> stores no contacts at all — only a set
          of filter rules. Every time you view it (or target a campaign with
          it), wacrm evaluates those rules against your current contacts on
          the spot, so membership is always up to date automatically. A
          cached estimated count is shown for convenience, but it&apos;s a
          display hint, never the source of truth.
        </p>
        <p>
          Rules combine with <strong>AND</strong>/<strong>OR</strong> and can
          be nested into groups. The fields you can filter on:
        </p>
        <DocsFieldTable
          columns={['Field', 'Operators']}
          rows={[
            {
              cells: [
                'Name, phone, email, company, city, state, PIN code',
                'equals, not equals, contains, not contains, starts with, ends with, is set, is not set',
              ],
            },
            { cells: ['Marketing opted-in', 'is true / is false'] },
            { cells: ['Tag', 'has tag / doesn’t have tag'] },
            { cells: ['List membership', 'in list / not in list'] },
            {
              cells: [
                'Created / updated date',
                'before, after, today, yesterday, last 7 days, last 30 days, this month, last month',
              ],
            },
            { cells: ['Any custom field', 'equals, not equals, contains, is set, is not set'] },
          ]}
        />
        <p>
          Use a segment when the group is a <strong>standing definition</strong>{' '}
          you want to stay current on its own — &ldquo;everyone tagged Lead
          who hasn&apos;t replied in 30 days,&rdquo; &ldquo;opted-in contacts
          in Karnataka.&rdquo;
        </p>

        <DocsCallout type="tip" title="Which one for a campaign?">
          If the audience changes on its own as contacts come and go, use a
          segment. If you&apos;re hand-picking exactly who&apos;s included,
          build a list. Both are valid targeting options when you launch a{' '}
          <Link href="/docs/campaigns">campaign</Link>.
        </DocsCallout>
      </DocsArticle>

      <DocsPager slug="segments-and-lists" />
    </>
  );
}
