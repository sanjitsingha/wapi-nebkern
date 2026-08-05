import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Short by design, and honest about what this app actually sets. wacrm
// is a logged-in tool, not an ad-funded site: the cookies that matter
// are Supabase's auth cookies and a couple of UI preferences. Padding
// this page with advertising-cookie boilerplate we don't use would be
// its own kind of misleading — and reviewers do read it.
export const metadata: Metadata = {
  title: { absolute: 'Cookie Policy — wacrm' },
  description:
    'The cookies and local storage wacrm uses — what each one is for, how long it lasts, and how to control them.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'what-cookies-are',
    heading: 'What this covers',
    blocks: [
      {
        p: 'A cookie is a small file a site stores in your browser so it can recognise you on the next request. Related technologies — local storage and session storage — do much the same job with different plumbing. This policy covers all of them, and applies to the wacrm website and web application operated by {{COMPANY}}.',
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
        p: 'wacrm is a tool you log into, not an ad-supported website. That shapes this list — it is short, and most of it exists so that being logged in survives a page refresh.',
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
        note: 'We do not use advertising cookies, cross-site tracking pixels, or third-party marketing trackers in the application. If that ever changes, this page changes first and you will be asked before any non-essential cookie is set.',
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
          'Analytics — aggregate, de-identified page-view counts, where enabled on this deployment. We use Umami, which is cookieless by design: it records that a page was viewed, not who viewed it, and sets nothing on your device. Used to see which pages get used, never to build a profile of you.',
          'Advertising — not used.',
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
      intro="A logged-in tool needs surprisingly few cookies. Here is every one wacrm sets, what it does, and how to switch off the ones that are optional."
      sections={SECTIONS}
    />
  );
}
