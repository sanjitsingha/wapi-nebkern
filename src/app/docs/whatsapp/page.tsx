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

export const metadata: Metadata = { title: 'WhatsApp channel' };

export default function WhatsAppDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Channels"
        title="WhatsApp channel"
        description="Connect your WhatsApp Business number, keep it healthy, and set up your profile, catalog, and calling."
      />

      <DocsArticle>
        <h2>Connecting your number (Embedded Signup)</h2>
        <p>
          The recommended way to connect is <strong>Embedded Signup</strong>{' '}
          under <strong>Settings → WhatsApp</strong> — a guided Facebook login
          that hands the whole setup to wacrm rather than asking you to copy
          API credentials around. Behind the scenes it runs through several
          steps automatically:
        </p>
        <DocsSteps
          steps={[
            {
              title: 'Log in and pick your WhatsApp Business Account',
              description:
                'You authorize wacrm through a Facebook consent screen and select which WhatsApp Business Account (WABA) and phone number to connect.',
            },
            {
              title: 'wacrm verifies access',
              description:
                'It confirms the granted token can actually read the WABA you selected, and resolves the exact phone number to use — falling back to the WABA’s first number if needed.',
            },
            {
              title: 'Ownership check',
              description:
                'If that phone number is already connected to a different wacrm account, the connection is rejected rather than silently taking it over.',
            },
            {
              title: 'Subscribe and register',
              description:
                'wacrm subscribes the WABA to receive messages, registers the phone number for Cloud API messaging (setting a 2-step verification PIN — reused if you had one, freshly generated otherwise), and confirms the number reports as live.',
            },
            {
              title: 'Credentials saved, encrypted',
              description:
                'The access token, verify token, and PIN are encrypted before being stored — nothing is kept in plain text.',
            },
          ]}
        />

        <DocsCallout type="tip" title="Already have your own Meta app?">
          A manual connection form is available as a fallback: Phone Number
          ID, WhatsApp Business Account ID, Access Token, Verify Token, and a
          2-step verification PIN. Use this if you&apos;re managing your own
          Meta developer app rather than going through Embedded Signup.
        </DocsCallout>

        <p>
          Once connected, a <strong>Registration status</strong> panel on the
          same page separately confirms that Meta will actually deliver
          message events to wacrm — distinct from &ldquo;the credentials
          are valid&rdquo; — with a one-click &ldquo;Verify with Meta&rdquo;
          check if something seems off.
        </p>

        <h2>Phone health</h2>
        <p>
          Your account menu shows a live read of two numbers Meta tracks for
          your phone number:
        </p>
        <ul>
          <li>
            <strong>Quality rating</strong> — Meta&apos;s assessment of how
            recipients respond to your messages (blocks, reports, opt-outs
            factor in). A dropping rating is worth acting on before it
            affects your sending limit.
          </li>
          <li>
            <strong>Messaging limit tier</strong> — how many customers you
            can message in a rolling 24 hours, which Meta raises over time as
            your quality rating holds up.
          </li>
        </ul>
        <p>
          If Meta can&apos;t be reached, these badges simply disappear rather
          than showing an error — they&apos;re a health indicator, not a
          blocking gate.
        </p>

        <h2>Business profile</h2>
        <p>
          Under <strong>Settings → Business Profile</strong>, editable fields
          are:
        </p>
        <DocsFieldTable
          rows={[
            { cells: ['About', '139 characters', 'The short line under your name in a chat.'] },
            { cells: ['Description', '512 characters', 'Longer description shown on your business profile screen.'] },
            { cells: ['Address', '256 characters', 'Physical address, if you have one to show.'] },
            { cells: ['Email', '128 characters', 'Support/contact email.'] },
            { cells: ['Websites', 'Up to 2, 256 characters each', 'Must start with http:// or https://.'] },
            { cells: ['Category', '19 preset options', 'e.g. Retail, Restaurant, Medical & health, Professional services — matched to Meta’s business categories.'] },
            { cells: ['Profile photo', 'JPEG/PNG, ≤5 MB', 'Uploaded through a separate endpoint from the text fields.'] },
          ]}
        />
        <DocsCallout type="info">
          There&apos;s no editable &ldquo;display name&rdquo; field here —
          your WhatsApp display name comes from the verified name Meta attached to the
          phone number itself, set during number verification, not from this
          profile form.
        </DocsCallout>
        <p>
          Editing the business profile requires an <strong>admin or owner</strong>{' '}
          role; agents and viewers see it read-only.
        </p>

        <h3>Catalog</h3>
        <p>
          The <strong>Catalogue</strong> tab (next to Profile, under Business
          Profile) connects to Meta Commerce: it shows your catalog&apos;s name
          and product count, lets you toggle whether customers can add items
          to a cart and whether the catalog is visible in your WhatsApp
          profile, browse and delete products, and add new ones. If you
          don&apos;t have a catalog yet, it links out to Meta Commerce
          Manager to create one — catalog creation itself happens on
          Meta&apos;s side.
        </p>

        <h2>Calling</h2>
        <p>
          <strong>Settings → Calling</strong> lets you turn on the call icon
          in your WhatsApp chat, so customers can tap to call your business
          number directly from the conversation. Turning it on asks Meta to
          show that icon and enables call events on the number; turning it
          off is always available, even if your plan no longer includes the
          feature.
        </p>
        <DocsCallout type="warning" title="What this does — and doesn't — do yet">
          This setting controls <strong>whether the call button appears</strong>{' '}
          for customers and whether Meta reports call events into wacrm. It
          does <strong>not</strong> yet let your team answer or place calls
          from inside wacrm — an incoming call currently shows up as a call
          entry in the conversation, not a live in-app call you can pick up.
          Full in-app calling is on the roadmap.
        </DocsCallout>
        <p>
          Calling is a plan-gated feature — see{' '}
          <Link href="/docs/billing">Billing &amp; plans</Link> if the toggle
          shows as locked.
        </p>
      </DocsArticle>

      <DocsPager slug="whatsapp" />
    </>
  );
}
