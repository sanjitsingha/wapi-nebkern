import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Named vendors, taken from what the code actually calls: Supabase
// (database, auth, storage), Meta (the channels), Razorpay (checkout),
// Google (optional sign-in), and the three BYO-key AI providers. The
// host is a deployment choice the codebase can't know, so it stays a
// placeholder — a subprocessor list naming the wrong host is worse
// than one that visibly needs filling in.
export const metadata: Metadata = {
  title: { absolute: 'Subprocessor List — wacrm' },
  description:
    'The third-party providers wacrm uses to process personal data on behalf of customers — what each one does, what data it sees, and how we notify you of changes.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'what-this-is',
    heading: 'What a subprocessor is',
    blocks: [
      {
        p: 'To run wacrm we rely on other companies — a database provider, the messaging platforms themselves, a payment processor. Where one of them processes personal data on our behalf in the course of providing the Service to you, it is a subprocessor, and you are entitled to know who it is.',
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
          'Supabase — managed PostgreSQL database, authentication and file storage. Sees essentially all workspace data: account and user records, contacts, message history, attachments and avatars. This is where your workspace lives.',
          'Meta Platforms — the WhatsApp Business Platform, Instagram and Messenger. Sees the messages, phone numbers and profile identifiers of every conversation on those channels, necessarily, because it is the network carrying them. Meta acts as an independent controller under its own terms, not merely as our subprocessor.',
          '{{HOSTING}} — application hosting and content delivery for the wacrm web application and its APIs. Processes request data including IP addresses, and handles data in transit.',
        ],
      },
      {
        note: 'Workspace data is hosted in Mumbai, India (ap-south-1). Meta processes message data across its own global infrastructure under its terms, which is outside our control and unavoidable on any WhatsApp Business Platform product.',
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
        p: 'Meta bills conversation charges to your own WhatsApp Business Account separately from your wacrm subscription. That relationship is between you and Meta.',
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
          'Google — sign-in with Google, where you or your team choose it. Sees the email address and basic profile of the person signing in, and only at sign-in.',
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
        p: 'When you connect your own systems, you extend the chain beyond this list and take responsibility for that part of it:',
      },
      {
        ul: [
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
      updated="5 August 2026"
      intro="Every third party that touches your data to make wacrm work — what each one does, what it can see, and how to object if you would rather we did not use one."
      sections={SECTIONS}
    />
  );
}
