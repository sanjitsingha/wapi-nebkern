import type { Metadata } from 'next';
import Link from 'next/link';

import {
  DocsArticle,
  DocsCallout,
  DocsHero,
  DocsPager,
  DocsScreenshot,
  DocsWalkthrough,
} from '@/components/docs/docs-components';

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Create your Dripo account: sign up with Google or your email, verify it, then pick a plan or start your 14-day free trial.',
  alternates: { canonical: '/docs/getting-started' },
};

// Step one of getting started: the account, and nothing else. Connecting
// the WhatsApp number is its own guide (/docs/connect-whatsapp), and
// roles live with the team docs.
//
// The flow it describes: /signup → (email) six-digit code, or (Google)
// /welcome "Almost there" → /onboarding "Pick the plan that fits" →
// /dashboard. Keep it in step with src/middleware.ts's two gates.
export default function GettingStartedDocsPage() {
  return (
    <>
      <DocsHero
        eyebrow="Getting started"
        title="Create your account"
        description="Sign up, verify your email, then pick a plan or start your 14-day free trial."
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
                      the WhatsApp number you&apos;ll use in Dripo — you
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
                    Then click <strong>Create account</strong>.
                  </p>
                </>
              ),
              image: {
                src: '/images/docs/getting-started/sign-up.png',
                alt: 'The Dripo sign-up form: Sign up with Google, then Full name, Organization, Phone number, Email and Password fields, and a Create account button.',
                width: 450,
                height: 900,
                caption: 'The sign-up screen',
              },
            },
            {
              title: 'Verify your email (email sign-up)',
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
                  <p>Signing up with Google skips this step.</p>
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
            {
              title: 'Tell us about yourself (Google sign-up)',
              body: (
                <>
                  <p>
                    Google gives us your name and email, but not the rest. On
                    the <strong>Almost there</strong> screen, fill in:
                  </p>
                  <ul>
                    <li>
                      <strong>Full name</strong> and{' '}
                      <strong>Phone number</strong>, as on the sign-up form.
                    </li>
                    <li>
                      <strong>Organization</strong> — your business&apos;s
                      name, which names your workspace.
                    </li>
                    <li>
                      <strong>Where did you find us?</strong> — pick one. It
                      helps us learn where people hear about Dripo.
                    </li>
                  </ul>
                  <p>
                    Then continue. Signing up with email skips this step — the
                    sign-up form already asked.
                  </p>
                </>
              ),
            },
            {
              title: 'Pick a plan, or start your free trial',
              body: (
                <>
                  <p>
                    On <strong>Pick the plan that fits</strong>, either:
                  </p>
                  <ul>
                    <li>
                      choose a plan and pay for it there, or
                    </li>
                    <li>
                      click <strong>Skip and start a 14-day free trial</strong>{' '}
                      at the bottom — no card needed.
                    </li>
                  </ul>
                  <p>
                    Start on the trial and you can upgrade any time from{' '}
                    <strong>Settings → Profile → Plan</strong>.
                  </p>
                </>
              ),
            },
          ]}
        />
        <p>
          That&apos;s it — you&apos;re in your new workspace as its{' '}
          <strong>owner</strong>.
        </p>
        <p>
          You land on the <strong>Dashboard</strong>. Until a WhatsApp number
          is connected, it shows the four steps to connect one and a{' '}
          <strong>Connect WhatsApp</strong> button that takes you straight
          there. Below it, quick links open every main feature and its
          guide. Next,{' '}
          <Link href="/docs/connect-whatsapp">connect your WhatsApp number</Link>.
        </p>
        <DocsScreenshot
          image={{
            src: '/images/docs/getting-started/dashboard.webp',
            alt: 'The Dripo Dashboard before WhatsApp is connected: a Connect your WhatsApp number panel with four steps — Open Settings → WhatsApp, Log in to Facebook, Add your number, You’re live — then Connect WhatsApp and Documentation buttons, and quick links below.',
            width: 2880,
            height: 1800,
            caption: 'The Dashboard before WhatsApp is connected',
          }}
        />
        <p>
          Once your number is connected, that panel makes way for the
          last 30 days at a glance — new conversations and contacts, open
          deal value, messages sent and failed deliveries — and who on your
          team is online.
        </p>

        <DocsCallout type="info" title="Invited to someone else's account?">
          Open the invite link and sign up (or log in) as usual. The sign-up
          form has no <strong>Organization</strong> field — you&apos;re
          joining their workspace, not creating one — and there&apos;s no
          plan to pick: once you&apos;re verified, you land on the invite and
          join with the role they gave you.
        </DocsCallout>

        <h2>Your 14-day free trial</h2>
        <p>
          The trial starts when you click{' '}
          <strong>Skip and start a 14-day free trial</strong>, and gives you
          full access for 14 days — no feature is held back and no card is
          needed. It&apos;s a one-time offer for each workspace.
        </p>
        <p>
          While it runs, an amber <strong>days left</strong> chip sits in
          the top bar. When it ends:
        </p>
        <ul>
          <li>
            The app pauses: every page shows{' '}
            <strong>Choose a plan to keep going</strong> until you pick a
            plan.
          </li>
          <li>
            <strong>Settings</strong> and your invoices stay open, so you
            can choose a plan and see what you&apos;ve paid.
          </li>
          <li>
            Nothing is deleted — your contacts, conversations, campaigns and
            automations are all there when you come back.
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
