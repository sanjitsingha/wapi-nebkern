import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Named vendors, taken from what the code actually calls: Supabase
// (database, auth, storage), Meta (the channels), Razorpay (checkout),
// Google (optional sign-in), and the three BYO-key AI providers. The
// host is a deployment choice the codebase can't know, so it stays a
// placeholder — a subprocessor list naming the wrong host is worse
// than one that visibly needs filling in.
export const metadata: Metadata = {
  alternates: { canonical: '/subprocessors' },
  title: { absolute: 'Subprocessor List — Instant for WhatsApp Business' },
  description:
    'The third-party providers Instant uses to process personal data for customers — what each does, what data it sees, and how we notify you of changes.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'what-this-is',
    heading: 'What a subprocessor is',
    blocks: [
      {
        p: 'To run Instant we rely on other companies — a database provider, the messaging platforms themselves, a payment processor. Where one of them processes personal data on our behalf in the course of providing the Service to you, it is a subprocessor, and you are entitled to know who it is.',
      },
      {
        p: 'This page is that list. It forms part of our Data Processing Agreement, and the authorisation you give us there is an authorisation to use the providers named below.',
      },
      {
        p: 'Each is engaged under a written contract with data protection obligations no less protective than those in our DPA, and we remain responsible to you for what they do with your data.',
      },
    ],
  },
  {
    id: 'core',
    heading: 'Core platform subprocessors',
    blocks: [
      {
        p: 'These are engaged for every customer — the Service cannot run without them.',
      },
      {
        ul: [
          'Supabase (Mumbai, India) — managed PostgreSQL database, authentication and file storage. Holds essentially all workspace data: account and user records, contacts, message history, attachments and avatars. This is where your workspace lives.',
          'Cloudonfire — the servers that run the {{PRODUCT}} web application and its APIs. Processes request data, including IP addresses, and handles workspace data in transit.',
          'Cloudflare — R2 object storage and delivery for message media, and Turnstile bot protection on our public forms. Holds the media files exchanged in conversations; Turnstile sees the technical details of a form visit, not workspace data.',
          'DeoMail — delivery of the emails we send: sign-in and verification links, account, billing and security notices, and newsletters you subscribe to. Sees the recipient’s email address and the content of those emails.',
          'Meta Platforms — the WhatsApp Business Platform, Instagram and Messenger. Sees the messages, phone numbers and profile identifiers of every conversation on those channels, necessarily, because it is the network carrying them. Meta acts as an independent controller under its own terms, not merely as our subprocessor.',
        ],
      },
      {
        note: 'Workspace data is hosted in Mumbai, India (ap-south-1). Meta, Google and Cloudflare process data across their own global infrastructure under their terms, which is unavoidable on any WhatsApp Business Platform product.',
      },
    ],
  },
  {
    id: 'billing',
    heading: 'Billing',
    blocks: [
      {
        ul: [
          'Razorpay — payment processing for subscriptions. Sees your billing name, email, and the payment instrument details you enter directly with it. Card and UPI details go straight to Razorpay and are never stored on our servers; we retain only the plan, invoice and transaction reference.',
        ],
      },
      {
        p: 'Meta bills its WhatsApp message charges to your own WhatsApp Business Account, separately from your {{PRODUCT}} subscription. That relationship is between you and Meta.',
      },
    ],
  },
  {
    id: 'conditional',
    heading: 'Used only if you enable the feature',
    blocks: [
      {
        p: 'These process data only when you switch on the feature that needs them. Leave the feature off and no data reaches them.',
      },
      {
        ul: [
          'Google — three separate things, all optional. Sign in with Google, where you or your team choose it, sees the email address and basic profile of the person signing in, and only at sign-in. Google Sheets, when you connect it, receives the contact and event rows you set up, written only to spreadsheets {{PRODUCT}} creates or you choose (the "drive.file" permission). Google Analytics 4 runs on the public marketing pages only, and only for visitors who accept cookies.',
          'Umami — cookieless page-view analytics, where enabled on this deployment. Sees the page visited plus the coarse technical details any web request carries (browser, device type, approximate country from IP). It sets no cookies, does not follow visitors between sites, and does not receive any of your workspace data.',
          'OpenAI — AI reply generation and embeddings, when you configure an OpenAI key. Sees the prompts, knowledge-base content and message text needed to draft a reply.',
          'Anthropic — AI reply generation, when you configure an Anthropic key. Same scope as above.',
          'OpenRouter — AI model routing, when you configure an OpenRouter key. Same scope, forwarded to the model provider you select there.',
        ],
      },
      {
        note: 'AI is bring-your-own-key: the model provider is your account and your contract with them, and we send only what is needed to answer the specific message. We do not use your conversations to train general-purpose models, and neither arrangement gives us a right to.',
      },
    ],
  },
  {
    id: 'your-own',
    heading: 'Providers you introduce yourself',
    blocks: [
      {
        p: 'When you connect your own accounts and systems, you extend the chain beyond this list and take responsibility for that part of it. Each provider below acts under its own terms with you:',
      },
      {
        ul: [
          'Zoho CRM — when you connect it, leads, contacts, deals and conversation notes are exchanged between {{PRODUCT}} and your Zoho organisation.',
          'Shopify and WooCommerce — when you connect a store, its order events and customer contact details are sent to {{PRODUCT}}.',
          'Outbound webhooks deliver event data to endpoints you nominate — Zapier, Make, n8n or your own backend.',
          'API keys let software you choose read and write your workspace data.',
          'Data you export leaves the Service entirely.',
        ],
      },
      {
        p: 'We are not the processor for what happens downstream of those, and they are not covered by this list.',
      },
    ],
  },
  {
    id: 'changes',
    heading: 'Changes and how to object',
    blocks: [
      {
        ul: [
          'We will give reasonable advance notice before adding or replacing a subprocessor, so you have time to consider it. The "last updated" date above tracks changes to this page.',
          'To be told directly rather than checking here, email {{EMAIL}} asking to be added to subprocessor change notifications.',
          'If you object on reasonable data protection grounds, write to us within 30 days of the notice. We will try to find a workable alternative; if there is none, you may terminate the affected part of the Service and we will refund prepaid fees for the unused period.',
        ],
      },
      {
        p: 'Questions about anything on this list: {{EMAIL}}.',
      },
    ],
  },
];

export default function Lp2SubprocessorsPage() {
  return (
    <LegalPage
      title="Subprocessor List"
      hue="pop"
      updated="14 October 2026"
      intro="Every third party that touches your data to make Instant work — what each one does, what it can see, and how to object if you would rather we did not use one."
      sections={SECTIONS}
    />
  );
}
