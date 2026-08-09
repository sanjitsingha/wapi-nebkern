import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Short by design, and honest about what this app actually sets. Instant
// is a logged-in tool, not an ad-funded site: the cookies that matter
// are Supabase's auth cookies and a couple of UI preferences. Padding
// this page with advertising-cookie boilerplate we don't use would be
// its own kind of misleading — and reviewers do read it.
export const metadata: Metadata = {
  title: { absolute: 'Cookie Policy — Instant' },
  description:
    'The cookies and local storage Instant uses — what each one is for, how long it lasts, and how to control them.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'what-cookies-are',
    heading: 'What this covers',
    blocks: [
      {
        p: 'A cookie is a small file a site stores in your browser so it can recognise you on the next request. Related technologies — local storage and session storage — do much the same job with different plumbing. This policy covers all of them, and applies to the Instant website and web application operated by {{COMPANY}}.',
      },
      {
        p: 'It sits alongside our Privacy Policy, which explains the wider picture of what personal data we hold and why.',
      },
    ],
  },
  {
    id: 'what-we-use',
    heading: 'What we actually use',
    blocks: [
      {
        p: 'Instant is a tool you log into, not an ad-supported website. That shapes this list — it is short, and most of it exists so that being logged in survives a page refresh.',
      },
      {
        ul: [
          'Authentication cookies, set by our database and auth provider when you sign in. They hold your session and refresh tokens, and identify you on every subsequent request. Without them you cannot stay logged in.',
          'Security cookies, used to verify sign-in flows, protect against cross-site request forgery, and keep the session and device records shown in your Profile settings accurate.',
          'Preference storage, which remembers small interface choices — whether the sidebar is collapsed, which inbox tab you last used, and similar. This is browser storage rather than a cookie in most cases, and it never leaves your device.',
          'A cookie-consent record, where consent is required in your jurisdiction, so we do not ask you the same question on every page.',
        ],
      },
      {
        note: 'We do not use advertising cookies, cross-site tracking pixels, or remarketing trackers anywhere on this site or in the application. We do use Google Analytics on the public marketing pages, which does set cookies — it is described in full below, and it does not load until you accept.',
      },
    ],
  },
  {
    id: 'categories',
    heading: 'Strictly necessary, and everything else',
    blocks: [
      {
        p: 'Privacy law generally splits cookies into ones a service cannot work without and ones it can. The distinction decides whether we need your consent.',
      },
      {
        ul: [
          'Strictly necessary — authentication, security and load balancing. These are set because you asked for a service that requires them, so they do not need consent. Blocking them breaks the login.',
          'Functional — interface preferences that make the app pleasant rather than possible. Blocking them means the app forgets your layout choices.',
          'Analytics — two of them, and they behave differently. Umami is cookieless by design: it records that a page was viewed, not who viewed it, and sets nothing on your device, so it runs everywhere without asking. Google Analytics 4 does set cookies, so it needs your consent and does not load until you give it.',
          'Advertising — not used. Google Analytics is configured for measurement only; we do not run Google Ads, remarketing audiences or Google Signals against it.',
        ],
      },
    ],
  },
  {
    id: 'third-parties',
    heading: 'Third parties that may set cookies',
    blocks: [
      {
        p: 'A few cookies are set by the providers we depend on rather than by us directly. We list them here because they are still your business:',
      },
      {
        ul: [
          'Our database and authentication provider, for the session cookies described above.',
          'Google, for Google Analytics 4 on the public marketing pages — only after you accept. It sets `_ga` and `_ga_<id>`, which distinguish one browser from another so a returning visit is not counted as a new one. They last up to two years, are never set inside the signed-in app, and declining means they are never set at all.',
          'Meta, when you connect a WhatsApp, Instagram or Facebook Page account. Its login window runs on Meta’s own domain, under Meta’s cookie policy, and we never see those cookies.',
          'Google, if you sign in with Google. The consent screen is Google’s and so are its cookies.',
          'Our payment processor, during checkout, for fraud prevention and to complete the transaction.',
        ],
      },
      {
        p: 'The full list of providers, what each one does and where it operates is on our Subprocessor List.',
      },
    ],
  },
  {
    id: 'managing',
    heading: 'How to control them',
    blocks: [
      {
        ul: [
          'Every major browser can block or delete cookies, per site or globally — look under Privacy or Site settings. Blocking cookies for this domain will log you out and keep you logged out.',
          'Where we show a consent banner, you can change your answer at any time from the link in the footer, and we will act on the change immediately.',
          'Browser "Do Not Track" and Global Privacy Control signals are honoured where the law requires us to honour them.',
          'Clearing your browser storage also clears saved interface preferences. Nothing in your workspace data is affected — that lives on our servers, not in your browser.',
        ],
      },
    ],
  },
  {
    id: 'changes',
    heading: 'Changes and contact',
    blocks: [
      {
        p: 'If we add a cookie category — analytics on a new deployment, say — we will update this page and, where consent is required, ask before setting it. The "last updated" date above always reflects the current version.',
      },
      {
        p: 'Questions about anything on this page: {{EMAIL}}.',
      },
    ],
  },
];

export default function Lp2CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      hue="lemon"
      updated="5 August 2026"
      intro="A logged-in tool needs surprisingly few cookies. Here is every one Instant sets, what it does, and how to switch off the ones that are optional."
      sections={SECTIONS}
    />
  );
}
