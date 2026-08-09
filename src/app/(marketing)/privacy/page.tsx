import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Indexed. The root layout sets `robots: index:false` app-wide, so
// this override is what makes the page crawlable — and legal pages
// need to be: payment providers and Meta's app reviewers both check
// that they resolve publicly, and there's no other copy of this text
// to duplicate.
export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy — Instant' },
  description:
    'How Instant collects, uses, shares and protects personal data — including WhatsApp message data processed on behalf of our customers.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    heading: 'Who we are and what this covers',
    blocks: [
      {
        p: 'Instant is a customer-relationship platform for businesses that talk to their customers over WhatsApp, Instagram and Messenger. It is operated by {{COMPANY}}, registered at {{ADDRESS}}. In this policy, "we", "us" and "our" mean {{COMPANY}}, and "the Service" means the Instant web application, its APIs and any related tooling.',
      },
      {
        p: 'This policy explains what personal data we handle, why, who we share it with and what rights you have. It covers our website and the Service. It does not cover the practices of the businesses that use Instant to message their own customers — for that, see the controller/processor split in section 4.',
      },
    ],
  },
  {
    id: 'what-we-collect',
    heading: 'Data we collect',
    blocks: [
      { p: 'We collect four broad categories of data.' },
      {
        ul: [
          'Account data you give us: name, work email, password hash, business name, phone number, team members you invite, and your role and permissions.',
          'Conversation data: messages, attachments, contact names and phone numbers, notes, tags, custom fields, deal stages and call records that flow through your connected WhatsApp, Instagram or Messenger channels. This is the data you and your customers create — we hold it on your behalf.',
          'Billing data: your plan, invoices, billing address and tax identifiers. Card and UPI details are entered directly with our payment processor and are never stored on our servers.',
          'Technical and usage data: IP address, browser and device information, pages and features used, timestamps, session and device records used for security, and error diagnostics.',
        ],
      },
      {
        p: 'We do not buy contact lists, and we do not ask you for special-category data (health, biometrics, political views and so on). If such data ends up in a conversation, we process it only as part of holding your messages for you.',
      },
    ],
  },
  {
    id: 'how-we-use-it',
    heading: 'How and why we use it',
    blocks: [
      {
        ul: [
          'To provide the Service — deliver and store messages, run your automations and AI agents, keep your pipelines and contacts in sync, and show you your own data.',
          'To bill you, under our contract with you, and to meet tax and accounting obligations.',
          'To keep accounts secure — detect suspicious sign-ins, enforce rate limits, maintain device and session records, and investigate abuse.',
          'To support you when you contact us, which may mean looking at the specific records you ask us about.',
          'To improve the Service, using aggregated or de-identified usage patterns rather than the contents of your conversations.',
          'To send service notices (billing, security, breaking changes). Marketing email is separate and you can opt out of it at any time.',
        ],
      },
      {
        note: 'We do not use the contents of your customer conversations to train general-purpose AI models. Your AI agent is grounded on the knowledge base you upload, and it works only for your workspace.',
      },
    ],
  },
  {
    id: 'controller-processor',
    heading: 'Who is responsible for what',
    blocks: [
      {
        p: 'This distinction matters, because most of the personal data in Instant is not ours.',
      },
      {
        ul: [
          'For your customers’ data — the contacts, phone numbers and messages inside your workspace — you are the controller and we are the processor. You decide who to message, on what basis, and for how long the records are kept. We process it on your documented instructions, which are the Terms and the settings you choose in the product.',
          'For your own account, billing and usage data, we are the controller.',
        ],
      },
      {
        p: 'As controller of your customers’ data, you are responsible for having a lawful basis to message them, for honouring their opt-outs, and for answering their privacy requests. We will help you do that — every contact record can be exported and deleted from the app. See our Acceptable Use Policy for the consent rules that apply to WhatsApp specifically.',
      },
    ],
  },
  {
    id: 'sharing',
    heading: 'Who we share data with',
    blocks: [
      {
        p: 'We do not sell personal data. We share it only with providers who help us run the Service, each under contract and only for that purpose.',
      },
      {
        ul: [
          'Meta Platforms — WhatsApp Business Platform, Instagram and Messenger. Messages you send and receive necessarily pass through Meta, under its own terms and privacy policy.',
          'Our cloud hosting and database provider, which stores your workspace data.',
          'Our payment processor, which handles card and UPI transactions and holds the payment details we never see.',
          'Our transactional email and, where enabled, error-monitoring providers.',
          'AI model providers, where you enable AI agent features — limited to the prompts, knowledge-base content and message text needed to generate a reply.',
          'Professional advisers, acquirers in a merger or sale, and authorities where we are legally compelled. We will tell you about a compelled disclosure unless we are prohibited from doing so.',
        ],
      },
    ],
  },
  {
    id: 'cookies',
    heading: 'Cookies and similar technologies',
    blocks: [
      {
        p: 'We keep this deliberately small. We use strictly necessary cookies to hold your login session, remember your workspace and theme preference, and protect forms against cross-site request forgery. These are required for the app to work and cannot be switched off from within it.',
      },
      {
        p: 'We do not run third-party advertising or cross-site tracking cookies on the Service. If we later add analytics that are not strictly necessary, we will ask for consent first and list them here. You can clear or block cookies in your browser, but you will not be able to stay signed in.',
      },
    ],
  },
  {
    id: 'retention',
    heading: 'How long we keep it',
    blocks: [
      {
        ul: [
          'Conversation and contact data: for as long as your workspace is active. You can delete individual records at any time, and deletion in the app removes them from our live systems.',
          'After you close your account: we delete or anonymise workspace data within 90 days, except where we must keep it longer by law.',
          'Invoices and tax records: as long as tax law requires, typically several years.',
          'Security logs and device sessions: a rolling window sufficient to investigate incidents.',
          'Backups: encrypted and cycled out on a rolling schedule, so deleted data can persist in backups briefly after removal from live systems.',
        ],
      },
    ],
  },
  {
    id: 'security',
    heading: 'How we protect it',
    blocks: [
      {
        p: 'Data is encrypted in transit with TLS and at rest by our hosting provider. Access to workspace data is enforced at the database level by row-level security, so one workspace cannot read another’s. Internal access is limited to staff who need it, over authenticated accounts, and API keys are scoped and revocable.',
      },
      {
        p: 'No system is perfectly secure. If a breach affects your personal data and creates a real risk to you, we will notify you and the relevant regulator within the timeframes the law requires.',
      },
    ],
  },
  {
    id: 'transfers',
    heading: 'International transfers',
    blocks: [
      {
        p: 'Our providers may process data outside your country, including in the United States and the European Union. Where we move personal data across borders, we rely on an appropriate safeguard — standard contractual clauses, an adequacy decision, or your consent where neither applies. You can ask us which mechanism covers a specific provider.',
      },
    ],
  },
  {
    id: 'your-rights',
    heading: 'Your rights',
    blocks: [
      {
        p: 'Depending on where you live, you may have the right to access your data, correct it, delete it, restrict or object to processing, withdraw consent, receive a portable copy, and not be subject to solely automated decisions with legal effect. Indian users have equivalent rights under the Digital Personal Data Protection Act, including the right to nominate someone to exercise them.',
      },
      {
        p: 'To exercise any of these, email {{EMAIL}}. We will respond within 30 days, and we may need to verify your identity first. You can also complain to your local data protection authority.',
      },
      {
        note: 'If you are a customer of a business that uses Instant and you want your data changed or removed, please contact that business directly — they control it. If you contact us, we will pass your request on to them.',
      },
    ],
  },
  {
    id: 'children',
    heading: 'Children',
    blocks: [
      {
        p: 'The Service is for businesses and is not directed at children. We do not knowingly collect personal data from anyone under 18. If you believe a child’s data has reached us, email {{EMAIL}} and we will delete it.',
      },
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    blocks: [
      {
        p: 'We may update this policy as the Service changes. We will update the "last updated" date above, and for material changes we will email account owners or show a notice in the app before the change takes effect.',
      },
    ],
  },
  {
    id: 'contact',
    heading: 'Contact and grievances',
    blocks: [
      {
        p: 'For any privacy question or request, email {{EMAIL}} or write to {{COMPANY}}, {{ADDRESS}}.',
      },
      {
        p: 'As required under Indian law, our Grievance Officer is {{GRIEVANCE}}, reachable at {{EMAIL}}. Grievances are acknowledged within 24 hours and resolved within 15 days.',
      },
    ],
  },
];

export default function Lp2PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      hue="sky"
      updated="25 July 2026"
      intro="What we collect, why we have it, who else sees it, and how to get it back or get it deleted. Written to be read, not to be survived."
      sections={SECTIONS}
    />
  );
}
