import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = {
  title: 'Billing & plans',
  description: "Billing & plans in Instant: the 14-day trial, how long a plan lasts and how to renew it, what pauses when it ends, activation codes and invoices.",
  alternates: { canonical: '/docs/billing' },
};

export default function BillingDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Account"
        title="Billing & plans"
        description="The free trial, what each plan includes, checkout, and where to find your invoices."
      />

      <DocsArticle>
        <h2>The 14-day trial</h2>
        <p>
          Every workspace can have one 14-day trial with full access — no
          feature held back, no card needed. It starts when you click{' '}
          <strong>Skip and start a 14-day free trial</strong> on the plan
          screen after signing up, and a <strong>days left</strong> chip
          sits in the top bar while it runs.
        </p>

        <h2>How long a plan lasts</h2>
        <p>
          Each purchase covers one billing period — a month, or a year on a
          yearly plan — and plans don&rsquo;t renew by themselves. A week
          before yours ends, a <strong>Plan ends in N days</strong> chip
          appears in the top bar. To keep going, open{' '}
          <strong>Settings → Profile → Plan</strong> and click{' '}
          <strong>Renew</strong>:
        </p>
        <ul>
          <li>
            Paying for the <strong>same plan</strong> adds another period
            after your current one ends, so renewing early never loses a day.
          </li>
          <li>
            Choosing a <strong>different plan</strong> starts it today, in
            place of the current one.
          </li>
        </ul>

        <h2>When a trial or plan ends</h2>
        <ul>
          <li>
            The app pauses: every page shows{' '}
            <strong>Choose a plan to keep going</strong>, and sending,
            campaigns, automations, flows, Maya&rsquo;s replies and the API
            stop.
          </li>
          <li>
            <strong>Settings</strong> and your invoices stay open, so you can
            pay from there.
          </li>
          <li>
            Nothing is deleted. Choose a plan and everything picks up where
            it left off.
          </li>
        </ul>

        <h2>What differs between plans</h2>
        <p>Plans can vary on:</p>
        <DocsFieldTable
          columns={['Dimension', 'Notes']}
          rows={[
            { cells: ['Team size', 'How many members and pending invites you can have at once.'] },
            { cells: ['Contacts', 'A cap on total contacts, if the plan has one.'] },
            { cells: ['Storage', 'How much media you can upload account-wide.'] },
            { cells: ['Calling', 'Whether the WhatsApp calling toggle is available — see the WhatsApp channel page.'] },
            { cells: ['Automations & Flows', 'Whether these features are unlocked at all.'] },
            { cells: ['Integrations', 'Whether API keys and outbound webhooks can be created.'] },
          ]}
        />
        <p>
          Current pricing and what&rsquo;s included in each tier is always
          shown live on the{' '}
          <Link href="/pricing">pricing page</Link>.
        </p>

        <h2>Paying for a plan</h2>
        <p>
          Checkout is handled through Razorpay, supporting cards, UPI, and
          the usual range of Indian payment methods. Only an admin or owner
          can pay. Once payment is confirmed, your plan is active
          immediately — no waiting.
        </p>

        <h2>Activation codes</h2>
        <p>
          If you&rsquo;ve been given an activation code — for a promotion, a
          partner arrangement, or by our support team — enter it where you
          choose a plan: under <strong>Have an activation code?</strong> on
          the plan screen after signing up, or in the{' '}
          <strong>Renew</strong> / <strong>Choose a plan</strong> window in{' '}
          <strong>Settings → Profile → Plan</strong>. The plan turns on at
          once. An admin or owner can redeem a code.
        </p>

        <h2>Invoices</h2>
        <p>
          Every payment appears under{' '}
          <strong>Settings → Profile → Plan</strong>, each opening a
          printable copy.
        </p>

        <DocsCallout type="tip">
          Not sure which plan fits? Start the trial first — every feature is
          unlocked during it, so you can see exactly what you&rsquo;d use
          before comparing tiers. See{' '}
          <Link href="/docs/getting-started">Getting started</Link>.
        </DocsCallout>
      </DocsArticle>

      <DocsPager slug="billing" />
    </>
  );
}
