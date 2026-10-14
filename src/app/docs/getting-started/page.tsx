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
  title: 'Create your account',
  description:
    'Create your Instant account: sign up with Google or your email, verify it with a six-digit code, and start your 14-day free trial.',
  alternates: { canonical: '/docs/getting-started' },
};

// Step one of getting started: the account, and nothing else. Connecting
// the WhatsApp number is its own guide (/docs/connect-whatsapp), and
// roles live with the team docs.
export default function GettingStartedDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Getting started"
        title="Create your account"
        description="Sign up, verify your email, and your workspace is ready — with a 14-day free trial."
      />

      <DocsArticle>
        <h2>Overview</h2>
        <p>
          Creating an account creates one <strong>account</strong> (what the
          rest of these docs call your workspace) with you as its{' '}
          <strong>owner</strong>. Everything you build — contacts,
          conversations, campaigns, automations — belongs to that account,
          and teammates you invite later join the same one with the role you
          give them. See{' '}
          <Link href="/docs/team">Team members &amp; roles</Link> for how
          invites and roles work.
        </p>

        <h2>Set up your account</h2>
        <DocsWalkthrough
          steps={[
            {
              title: 'Sign up with Google or your email',
              body: (
                <>
                  <p>
                    Open the <Link href="/signup">sign-up page</Link> and
                    either click <strong>Sign up with Google</strong>, or fill
                    in the form:
                  </p>
                  <ul>
                    <li>
                      <strong>Full name</strong> — how you appear to your
                      teammates.
                    </li>
                    <li>
                      <strong>Organization</strong> — your business&apos;s
                      name. It names your workspace.
                    </li>
                    <li>
                      <strong>Phone number</strong> — your own number, so we
                      can reach you. An Indian mobile needs no{' '}
                      <code>+91</code>; anywhere else, start with{' '}
                      <code>+</code> and your country code. This isn&apos;t
                      the WhatsApp number you&apos;ll use in Instant — you
                      connect that later.
                    </li>
                    <li>
                      <strong>Email</strong> and <strong>Password</strong> —
                      the password needs at least 8 characters, with a
                      lowercase and an uppercase letter, a number and a
                      special character. A <strong>Confirm password</strong>{' '}
                      field appears once you start typing.
                    </li>
                  </ul>
                  <p>
                    Then click <strong>Create account</strong>. Signing up
                    with Google skips the password and the email code —
                    you&apos;re asked for your organization and phone number
                    on the next screen instead.
                  </p>
                </>
              ),
              image: {
                src: '/images/docs/getting-started/sign-up.png',
                alt: 'The Instant sign-up form: Sign up with Google, then Full name, Organization, Phone number, Email and Password fields, and a Create account button.',
                width: 450,
                height: 900,
                caption: 'The sign-up screen',
              },
            },
            {
              title: 'Verify your email',
              body: (
                <>
                  <p>
                    We email a <strong>six-digit code</strong> to the address
                    you entered. Type it in and click{' '}
                    <strong>Verify and continue</strong>.
                  </p>
                  <ul>
                    <li>
                      No email? Check your spam or promotions folder. After 60
                      seconds you can click <strong>Resend code</strong>.
                    </li>
                    <li>
                      Typed the wrong address? Click{' '}
                      <strong>Use another email</strong> to go back and fix
                      it.
                    </li>
                    <li>
                      Codes expire. If yours has, resend and use the new one.
                    </li>
                  </ul>
                </>
              ),
              image: {
                src: '/images/docs/getting-started/verify-email.png',
                alt: 'The Verify your email screen: six boxes for the code, a Verify and continue button, and Use another email and Resend links.',
                width: 450,
                height: 460,
                caption: 'Verifying your email with a six-digit code',
              },
            },
          ]}
        />
        <p>
          That&apos;s it — you&apos;re signed in to your new workspace as its{' '}
          <strong>owner</strong>, and your free trial has started. Next,{' '}
          <Link href="/docs/connect-whatsapp">connect your WhatsApp number</Link>.
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
      </DocsArticle>

      <DocsPager slug="getting-started" />
    </>
  );
}
