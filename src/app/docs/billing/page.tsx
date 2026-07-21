import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsFieldTable,
  DocsHero,
  DocsPager,
} from '@/components/docs/docs-components';

export const metadata: Metadata = { title: 'Billing & plans' };

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
          Every account gets 14 days of full access from the moment it&rsquo;s
          created — no feature held back, no credit card needed to start.
          You&rsquo;ll see a countdown in the app the whole time.
        </p>
        <p>
          Once the trial ends, everything you&rsquo;ve built stays fully
          visible — nothing is deleted or hidden. What pauses is{' '}
          <strong>sending</strong>: new outbound messages and campaigns are
          blocked until you choose a plan. Reading your conversations,
          contacts, and history is never affected.
        </p>

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
          <Link href="/#pricing">pricing section</Link> of the homepage.
        </p>

        <h2>Choosing a plan</h2>
        <p>
          Checkout is handled through Razorpay, supporting cards, UPI, and
          the usual range of Indian payment methods. Only an admin or owner
          can complete a purchase. Once payment is confirmed, your plan is
          active immediately — no waiting.
        </p>

        <h2>Activation codes</h2>
        <p>
          If you&rsquo;ve been given an activation code — for a promotion, a
          partner arrangement, or by our support team — redeem it from{' '}
          <strong>Settings → Billing</strong> to apply a plan directly,
          without going through checkout. An admin or owner can redeem a
          code.
        </p>

        <h2>Invoices</h2>
        <p>
          Every completed payment appears under{' '}
          <strong>Settings → Billing</strong>, viewable by anyone on the
          account.
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
