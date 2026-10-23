import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsHero,
  DocsPager,
  DocsWalkthrough,
} from '@/components/docs/docs-components';

export const metadata: Metadata = {
  title: 'Connect your WhatsApp number',
  description:
    'Connect your WhatsApp Business number to Dripo in one Facebook login with Meta Embedded Signup — what you need first, each step, and what Dripo sets up for you.',
  alternates: { canonical: '/docs/connect-whatsapp' },
};

// Step two of getting started: the number. The day-to-day WhatsApp
// settings (phone health, business profile, catalog, calling) stay on
// /docs/whatsapp; this page is only the connection, start to finish.
export default function ConnectWhatsAppDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Getting started"
        title="Connect your WhatsApp number"
        description="Link your WhatsApp Business number to Dripo in one Facebook login — no API keys to copy."
      />

      <DocsArticle>
        <h2>Overview</h2>
        <p>
          Dripo runs on the official WhatsApp Business Platform. You connect
          your number through <strong>Meta Embedded Signup</strong> — a
          guided Facebook login that opens from inside Dripo, so you never
          have to create a developer app or copy credentials around. It takes
          a few minutes.
        </p>

        <h2>Before you start</h2>
        <ul>
          <li>
            <strong>A Facebook account.</strong> You sign in with it to give
            Dripo access. If your business has no Meta Business portfolio
            yet, you can create one during the flow.
          </li>
          <li>
            <strong>A phone number for your business</strong> that can receive
            a verification code by SMS or phone call.
          </li>
          <li>
            <strong>A number that isn&apos;t active on WhatsApp.</strong> A
            number registered on the WhatsApp or WhatsApp Business app
            can&apos;t be connected. Delete the WhatsApp account on that number
            first, or use a different number.
          </li>
          <li>
            <strong>A display name</strong> for your business — the name
            customers see. It should match your business; Meta reviews it.
          </li>
        </ul>

        <h2>Steps to connect</h2>
        <DocsWalkthrough
          steps={[
            {
              title: 'Open Settings → WhatsApp',
              body: (
                <p>
                  In Dripo, go to <strong>Settings → WhatsApp</strong>. Look
                  over the <strong>Before you start</strong> list and click{' '}
                  <strong>I&apos;m ready</strong>. Choose{' '}
                  <strong>I&apos;m new to the WhatsApp Cloud API</strong>, click{' '}
                  <strong>Continue</strong>, then{' '}
                  <strong>Continue with Facebook</strong>. A Facebook window
                  opens — if your browser blocks it, allow pop-ups for Dripo
                  and click again.
                </p>
              ),
            },
            {
              title: 'Log in to Facebook and choose your business',
              body: (
                <p>
                  Sign in with your Facebook account, then pick your{' '}
                  <strong>Meta Business portfolio</strong> — or create one if
                  this is your first time.
                </p>
              ),
            },
            {
              title: 'Choose your WhatsApp Business Account and number',
              body: (
                <>
                  <p>
                    Select an existing <strong>WhatsApp Business Account</strong>{' '}
                    or create a new one. Then add your phone number and display
                    name.
                  </p>
                  <p>
                    Meta sends a verification code to that number by SMS or
                    phone call. Enter it to confirm the number is yours, then
                    finish the steps in the Facebook window.
                  </p>
                </>
              ),
            },
            {
              title: 'Dripo finishes the setup',
              body: (
                <>
                  <p>
                    When the Facebook window closes, Dripo does the rest —
                    you can watch each step tick off on the page:
                  </p>
                  <ul>
                    <li>checks it can reach the WhatsApp Business Account you chose;</li>
                    <li>
                      makes sure the number isn&apos;t already connected to a
                      different Dripo account;
                    </li>
                    <li>
                      subscribes the account so incoming messages reach your
                      inbox, and registers the number for messaging — setting a
                      two-step verification PIN for you. If your number already
                      has a PIN of its own, Dripo asks you for it once;
                    </li>
                    <li>stores the credentials encrypted.</li>
                  </ul>
                  <p>
                    The page then shows your number with a{' '}
                    <strong>Live</strong> badge.
                  </p>
                </>
              ),
            },
          ]}
        />

        <h2>Check it works</h2>
        <p>
          <strong>Live</strong> means Meta is delivering your messages to
          Dripo. Click <strong>Check connection</strong> any time to re-check
          with Meta.
        </p>
        <p>
          If the badge says <strong>One more step</strong>, click{' '}
          <strong>Finish setup</strong>. Dripo retries the registration for
          you; if your number already has a two-step verification PIN, type it
          in there. Forgot it? Reset it in WhatsApp Manager under your
          number&apos;s <strong>Two-step verification</strong>, then enter the
          new one.
        </p>
        <p>
          The quickest real test: send a WhatsApp message to your number from
          another phone. It should appear in the{' '}
          <Link href="/docs/inbox">Shared inbox</Link> within seconds.
        </p>

        <DocsCallout type="warning" title="“Already connected to another account”">
          A number can belong to only one Dripo account. If it&apos;s
          connected somewhere else, disconnect it there first, then connect it
          here.
        </DocsCallout>

        <DocsCallout type="tip" title="Already on the WhatsApp Cloud API?">
          After <strong>I&apos;m ready</strong>, choose{' '}
          <strong>I already use the WhatsApp Cloud API</strong>. Paste a
          system-user access token, click{' '}
          <strong>Find my numbers</strong>, and pick the number — Dripo looks
          up the IDs and registers it for you. A token from a different Meta
          app can send messages but can&apos;t receive replies; Dripo warns
          you if yours is one.
        </DocsCallout>

        <h2>What&apos;s next</h2>
        <ul>
          <li>
            <Link href="/docs/templates">Create message templates</Link> — you
            need an approved template to message a customer first.
          </li>
          <li>
            <Link href="/docs/contacts">Bring in your contacts</Link> — import a
            CSV, or let them arrive as people message you.
          </li>
          <li>
            <Link href="/docs/team">Invite your team</Link> to work the inbox
            with you.
          </li>
          <li>
            <Link href="/docs/whatsapp">WhatsApp channel</Link> — phone
            health, your business profile, catalog and calling.
          </li>
        </ul>
      </DocsArticle>

      <DocsPager slug="connect-whatsapp" />
    </>
  );
}
