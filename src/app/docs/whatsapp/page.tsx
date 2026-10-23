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
  title: 'WhatsApp channel',
  description: "WhatsApp channel in Dripo: Connect your WhatsApp Business number, catalog, and calling. A step-by-step guide for teams selling on WhatsApp.",
  alternates: { canonical: '/docs/whatsapp' },
};

export default function WhatsAppDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Channels"
        title="WhatsApp channel"
        description="Connect your WhatsApp Business number, keep it healthy, and set up your profile, catalog, and calling."
      />

      <DocsArticle>
        <h2>Connecting your number</h2>
        <p>
          Connecting is a one-time Facebook login from{' '}
          <strong>Settings → WhatsApp</strong>. The full walkthrough — what
          you need first, each step, and what Dripo sets up for you — is in{' '}
          <Link href="/docs/connect-whatsapp">Connect your WhatsApp number</Link>.
        </p>

        <p>
          Once connected, the same page shows whether your number is{' '}
          <strong>Live</strong> — Meta actually delivering message events to
          Dripo, not just accepting the credentials — with a one-click{' '}
          <strong>Check connection</strong> if something seems off.
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
          for customers and whether Meta reports call events into Dripo. It
          does <strong>not</strong> yet let your team answer or place calls
          from inside Dripo — an incoming call currently shows up as a call
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
