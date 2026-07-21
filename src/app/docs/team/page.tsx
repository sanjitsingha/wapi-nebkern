import type { Metadata } from 'next';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Team members & roles' };

export default function TeamDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Account"
        title="Team members & roles"
        description="Invite teammates, control what each of them can do, and hand off ownership if it's ever needed."
      />

      <DocsArticle>
        <h2>Roles</h2>
        <DocsFieldTable
          columns={['Role', 'Can do']}
          rows={[
            { cells: ['Owner', 'Everything — the only role that can transfer ownership or delete the account. Exactly one per account.'] },
            { cells: ['Admin', 'Manage settings, team members, and billing, plus everything an agent can.'] },
            { cells: ['Agent', 'Send messages, work the inbox, run campaigns and automations — no settings access.'] },
            { cells: ['Viewer', 'Read-only.'] },
          ]}
        />

        <h2>Inviting someone</h2>
        <p>
          From <strong>Settings → Team members</strong> (admin or owner
          only), invite by generating a link — there&rsquo;s no email sent
          automatically; you share the link yourself however you&rsquo;d
          like. It expires after a set number of days if unused. You can
          invite someone as admin, agent, or viewer, but not directly as
          owner.
        </p>
        <DocsCallout type="info">
          Your plan caps how many people can be on the account at once —
          counting both active members and outstanding invites. If
          you&rsquo;re at the limit, upgrade or free up a seat before
          inviting.
        </DocsCallout>

        <h2>Changing a role</h2>
        <p>
          An admin or owner can change any other member&rsquo;s role, or
          remove them from the account entirely, from the same Team members
          page.
        </p>

        <h2>Transferring ownership</h2>
        <p>
          Only the current owner can hand ownership to someone else. Doing
          so moves the previous owner down to admin automatically — there is
          always exactly one owner on the account, never zero and never two.
        </p>
      </DocsArticle>

      <DocsPager slug="team" />
    </>
  );
}
