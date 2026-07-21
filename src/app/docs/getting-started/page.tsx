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

export const metadata: Metadata = { title: 'Getting started' };

export default function GettingStartedDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Getting started"
        title="Getting started"
        description="From creating an account to your first message in the shared inbox."
      />

      <DocsArticle>
        <h2>Create your account</h2>
        <p>
          Sign up with your name, email, and a password (6 characters
          minimum), or continue with Google. After signing up with email you
          land on a &ldquo;check your email&rdquo; screen — there&apos;s no
          automatic sign-in until you confirm the address.
        </p>
        <p>
          Creating an account creates one <strong>account</strong> (what the
          rest of these docs call your workspace) with you as its{' '}
          <strong>owner</strong>. Everything you build — contacts,
          conversations, campaigns, automations — belongs to that account,
          and teammates you invite later join the same one. See{' '}
          <Link href="/docs/team">Team members &amp; roles</Link> for how
          invites and roles work.
        </p>

        <DocsCallout type="info" title="Invited to someone else's account?">
          If you followed a teammate&apos;s invite link, finish the same
          signup or log-in flow — you&apos;ll land on the invite acceptance
          page automatically afterward instead of creating a new account.
        </DocsCallout>

        <h2>Your 14-day free trial</h2>
        <p>
          Every new account starts on a <strong>14-day free trial</strong>{' '}
          with full access — no feature is held back and no credit card is
          required to start. The countdown begins the moment your account is
          created.
        </p>
        <p>
          While the trial is active you&apos;ll see a &ldquo;days
          left&rdquo; banner in the app. Once it ends:
        </p>
        <ul>
          <li>
            Everything you&apos;ve built stays fully visible — contacts,
            conversation history, campaigns, automations, all of it.
          </li>
          <li>
            Sending new messages and launching broadcasts pauses until you
            choose a plan.
          </li>
        </ul>
        <p>
          See <Link href="/docs/billing">Billing &amp; plans</Link> for what
          each plan includes and how checkout works.
        </p>

        <h2>The four steps to your first conversation</h2>
        <DocsSteps
          steps={[
            {
              title: 'Connect your WhatsApp number',
              description: (
                <>
                  Go to <strong>Settings → WhatsApp</strong> and use{' '}
                  <strong>Embedded Signup</strong> to link your WhatsApp
                  Business number through a guided Facebook login — no manual
                  API credentials needed. See{' '}
                  <Link href="/docs/whatsapp">WhatsApp channel</Link> for the
                  full walkthrough and the manual-setup fallback.
                </>
              ),
            },
            {
              title: 'Bring in your contacts',
              description: (
                <>
                  Import an existing list by CSV (a <code>phone</code> column
                  is required; name, email, company, and tags are optional),
                  or simply wait — anyone who messages your number becomes a
                  contact automatically. Details in{' '}
                  <Link href="/docs/contacts">Contacts</Link>.
                </>
              ),
            },
            {
              title: 'Invite your team',
              description: (
                <>
                  Add teammates from <strong>Settings → Team members</strong>{' '}
                  and give each one a role — admin, agent, or viewer. See{' '}
                  <Link href="/docs/team">Team members &amp; roles</Link>.
                </>
              ),
            },
            {
              title: 'Open the inbox',
              description: (
                <>
                  Every conversation lands in one shared inbox your whole
                  team works from. Read{' '}
                  <Link href="/docs/inbox">Shared inbox</Link> for how
                  assignment, tags, and the reply window work.
                </>
              ),
            },
          ]}
        />

        <h2>Roles at a glance</h2>
        <p>
          Every teammate has exactly one role on the account, which decides
          what they can do:
        </p>
        <DocsFieldTable
          columns={['Role', 'Can do']}
          rows={[
            {
              cells: [
                'Owner',
                'Everything, including transferring ownership or deleting the account. Exactly one per account.',
              ],
            },
            {
              cells: [
                'Admin',
                'Manage settings, team members, and billing; everything an agent can do.',
              ],
            },
            {
              cells: [
                'Agent',
                'Send messages, work the inbox, run campaigns and automations — day-to-day work, no settings access.',
              ],
            },
            {
              cells: [
                'Viewer',
                'Read-only — see conversations and data without being able to send or change anything.',
              ],
            },
          ]}
        />

        <p>
          More on inviting people and what each role can reach in{' '}
          <Link href="/docs/team">Team members &amp; roles</Link>.
        </p>
      </DocsArticle>

      <DocsPager slug="getting-started" />
    </>
  );
}
