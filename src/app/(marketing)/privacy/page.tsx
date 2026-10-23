import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Indexed. The root layout sets `robots: index:false` app-wide, so
// this override is what makes the page crawlable — and legal pages
// need to be: payment providers and Meta's app reviewers both check
// that they resolve publicly, and there's no other copy of this text
// to duplicate.
export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: { absolute: 'Privacy Policy — Dripo WhatsApp for Business' },
  description:
    'How Dripo by Nebkern Technology collects, uses, shares, protects and deletes personal data — including data received from Meta (WhatsApp, Instagram, Messenger) and Google.',
  robots: { index: true, follow: true },
};

// Kept in agreement with the Terms, Cookie Policy, Data Retention &
// Deletion Policy, Data Deletion instructions and Subprocessor List.
// Meta's App Review and Google's OAuth verification both read this page
// against what the app actually does — sections 4 and 5 are written for
// them, and must stay true to the code (scopes, deletion flow, tokens).
const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    heading: 'Who we are and what this policy covers',
    blocks: [
      {
        p: '{{PRODUCT}} ({{SITE}}) is a customer-messaging and CRM platform that lets businesses talk to their customers over WhatsApp, Instagram and Facebook Messenger. It is owned and operated by {{COMPANY}}, {{ENTITY}}, with its registered address at {{ADDRESS}}. In this policy, "we", "us" and "our" mean {{COMPANY}}, and "the Service" means the {{PRODUCT}} website, web application, APIs and the {{PRODUCT}} app on Meta’s platform.',
      },
      {
        p: 'This policy explains what personal data we collect, how we use it, who we share it with, how long we keep it, how we protect it, and the rights you have over it. It applies to everyone who visits our website or uses the Service.',
      },
      {
        note: 'In short: we use your data only to run the Service for you. We do not sell personal data, we do not use it for advertising, and you can delete your account and everything in it at any time — see our Data Deletion page at {{SITE}}/data-deletion.',
      },
    ],
  },
  {
    id: 'what-we-collect',
    heading: 'Information we collect',
    blocks: [
      { p: 'We collect the following categories of information.' },
      {
        ul: [
          'Account information — your name, email address, password (stored only as a secure hash), business name, phone number, profile picture, the team members you invite, and their roles and permissions.',
          'Information from Meta, when you connect a WhatsApp Business, Instagram or Facebook Page account — described in detail in section 4.',
          'Conversation and customer data — the messages, media, voice notes and call records exchanged with your customers on your connected channels, and the contacts, names, phone numbers, notes, tags, custom fields, deals and campaign data you keep in {{PRODUCT}}. We hold this on your behalf; see section 7.',
          'Information from other services you connect — such as Google (Sign in with Google and Google Sheets, described in section 5), Zoho CRM, Shopify, WooCommerce, or an AI model provider whose API key you add. We receive only what each connection needs to work.',
          'Billing information — your plan, invoices, billing name, address and tax details. Card, UPI and bank details are entered directly with our payment processor, Razorpay, and never reach or are stored on our servers.',
          'Technical and usage information — IP address, browser and device type, pages and features used, timestamps, sign-in sessions and devices, and error logs, used to run and secure the Service.',
          'Information you send through our website — contact and enquiry forms, newsletter sign-ups, and our free tools. When you use the free WhatsApp QR code generator, we record the number and pre-filled message you enter with a timestamp.',
        ],
      },
      {
        p: 'We do not buy personal data, and we do not ask for sensitive personal data such as health, financial account, biometric or religious information. If such data appears inside a conversation, we process it only as part of storing that conversation for you.',
      },
    ],
  },
  {
    id: 'how-we-use-it',
    heading: 'How we use information',
    blocks: [
      {
        ul: [
          'To provide the Service — send and receive messages, display your inbox, run the automations, campaigns, chatbots and AI features you set up, keep your contacts and connected tools in sync, and show you reports about your own account.',
          'To process payments, issue invoices and meet our tax and accounting obligations.',
          'To keep the Service and your account secure — verify sign-ins, prevent fraud, spam and abuse, enforce rate limits and investigate incidents.',
          'To give you support when you ask for it, which may mean viewing the specific records you ask us about.',
          'To maintain and improve the Service using aggregated, de-identified usage statistics — never the content of your conversations.',
          'To send you service messages, such as account, billing and security notices. Marketing emails are separate, and every one has an unsubscribe link.',
          'To comply with the law and respond to lawful requests from authorities.',
        ],
      },
      {
        p: 'We process your personal data on the basis of your consent, to perform our contract with you, to comply with legal obligations, and for other legitimate uses permitted by India’s Digital Personal Data Protection Act, 2023. Where we rely on consent, you can withdraw it at any time.',
      },
      {
        note: 'We do not use the content of your customer conversations to train AI models. AI features in {{PRODUCT}} run on an AI provider account that you connect with your own API key, and only for your own workspace.',
      },
    ],
  },
  {
    id: 'meta-data',
    heading: 'Information we receive from Meta (WhatsApp, Instagram and Messenger)',
    blocks: [
      {
        p: 'When you connect a WhatsApp Business account, an Instagram professional account or a Facebook Page to {{PRODUCT}}, you sign in with Meta and grant {{PRODUCT}} the permissions shown on Meta’s consent screen. Through that connection we receive:',
      },
      {
        ul: [
          'Business and account identifiers — your Meta business ID, WhatsApp Business Account ID, phone number ID, display phone number, verified business name, Facebook Page ID and name, and Instagram account ID and username.',
          'Account status — phone number quality rating, messaging limits, and your message templates and their approval status.',
          'Access tokens that allow {{PRODUCT}} to act on these accounts on your behalf. They are stored encrypted and are never shown in the app.',
          'Messages and events — messages, media and reactions your customers send to your connected accounts, delivery and read receipts for the messages you send, call events, and the profile name and WhatsApp number, Instagram-scoped ID or Messenger-scoped ID of each person who contacts you.',
        ],
      },
      { p: 'How we use and protect it:' },
      {
        ul: [
          'We use this information only to provide the features you use in {{PRODUCT}} — sending and receiving messages, managing templates, showing conversations in your inbox, running your automations and reports, and keeping your connection working.',
          'We do not sell it, rent it, or use it for advertising or marketing; we do not share it with data brokers; and we do not combine it across different businesses to build profiles of individuals.',
          'We share it only with the service providers needed to run {{PRODUCT}} (see section 8 and our Subprocessor List), each bound to use it only for that purpose.',
          'We handle it in accordance with the Meta Platform Terms, Meta’s Developer Policies, and the WhatsApp Business terms and policies.',
          'When you disconnect a WhatsApp, Instagram or Messenger account in {{PRODUCT}}, we immediately delete its access token and connection settings. Conversation history you already have stays in your workspace until you delete it or your account.',
        ],
      },
      {
        p: 'To delete the data we hold that came from Meta — or your whole account — follow the steps on our Data Deletion page at {{SITE}}/data-deletion, or email {{EMAIL}}. You can also remove {{PRODUCT}}’s access at any time from your Facebook settings (Business integrations) or from Meta Business Suite.',
      },
    ],
  },
  {
    id: 'google-data',
    heading: 'Information we receive from Google',
    blocks: [
      {
        ul: [
          'Sign in with Google — if you choose it, Google shares your name, email address and profile picture so we can create and sign in to your account. We use it for nothing else.',
          'Google Sheets — if you connect Google Sheets, {{PRODUCT}} uses the Google "drive.file" permission, which gives access only to spreadsheets that {{PRODUCT}} creates or that you choose to open with it. We use it to create those spreadsheets and write the contact and event rows you set up. We cannot see any other file in your Google Drive.',
        ],
      },
      {
        note: '{{PRODUCT}}’s use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
      },
      {
        p: 'We do not use Google user data for advertising, we do not sell it, we do not let humans read it except with your permission, for security, or where the law requires, and we do not use it to train AI models. You can revoke access at any time from your Google Account (Security → Third-party connections) or by disconnecting Google Sheets in {{PRODUCT}}.',
      },
    ],
  },
  {
    id: 'other-integrations',
    heading: 'Other services you connect',
    blocks: [
      {
        p: 'You can choose to connect {{PRODUCT}} to other tools. Each connection is optional, starts only when you set it up, and can be removed at any time.',
      },
      {
        ul: [
          'Zoho CRM — keeps your Zoho leads, contacts and deals in sync with {{PRODUCT}}, and can save your conversations as notes on the matching Zoho record.',
          'Shopify and WooCommerce — receive your store’s order events so you can send order updates to your customers.',
          'AI model providers (OpenAI, Anthropic, OpenRouter) — when you add your own API key, we send them only the text needed to draft or send a reply: the recent conversation, your instructions and relevant knowledge-base content.',
          'Webhooks, the API, Zapier, Make and n8n — deliver data to the systems you nominate.',
        ],
      },
      {
        p: 'Access credentials for these services are stored encrypted. What a connected service does with the data it receives is governed by its own terms and privacy policy.',
      },
    ],
  },
  {
    id: 'controller-processor',
    heading: 'Our role for your customers’ data',
    blocks: [
      {
        p: 'Much of the personal data in {{PRODUCT}} belongs to the people your business talks to. For that data — your contacts, their numbers and your conversations with them — your business decides why and how it is processed, and we process it only on your instructions. Under India’s DPDP Act your business is the Data Fiduciary and we are its Data Processor; under the GDPR, the controller and processor. For your own account, billing and usage data, we are the Data Fiduciary (controller).',
      },
      {
        p: 'As a business using {{PRODUCT}}, you are responsible for having a valid basis — usually opt-in consent — to message your customers, for honouring their requests to stop, and for answering their privacy requests. Our Acceptable Use and WhatsApp policies explain what that requires, and the app lets you export or delete any contact and their conversation history.',
      },
    ],
  },
  {
    id: 'sharing',
    heading: 'How we share information',
    blocks: [
      {
        p: 'We do not sell personal data, and we do not share it for advertising. We share it only as follows:',
      },
      {
        ul: [
          'Meta — messages you send and receive pass through the WhatsApp Business Platform, Instagram and Messenger, which Meta operates under its own terms and privacy policy.',
          'Service providers who run the Service for us, under contract and only for that purpose: Cloudonfire (application servers), Supabase (database, authentication and file storage, in Mumbai, India), Cloudflare (media storage and delivery, and bot protection on our forms), Razorpay (payments) and DeoMail (email delivery). The full list is on our Subprocessor List.',
          'Services you choose to connect, as described in sections 5 and 6.',
          'Professional advisers, and a buyer or successor if our business is sold or reorganised, who must protect the data as this policy does.',
          'Government or law-enforcement authorities, where the law requires it. Unless we are prohibited from doing so, we will tell you about such a request.',
        ],
      },
    ],
  },
  {
    id: 'cookies',
    heading: 'Cookies and analytics',
    blocks: [
      {
        p: 'The app uses only cookies and browser storage that are strictly necessary — to keep you signed in, protect your account and remember your interface preferences. On our public website we measure visits with Umami, which sets no cookies, and with Google Analytics 4, which sets cookies and loads only if you accept them. We do not use advertising or cross-site tracking cookies anywhere. Our Cookie Policy lists every cookie and how to control it.',
      },
    ],
  },
  {
    id: 'storage-transfers',
    heading: 'Where your data is stored',
    blocks: [
      {
        p: 'Your workspace data — accounts, contacts and conversations — is stored in Supabase’s data centre in Mumbai, India. Media files are stored with Cloudflare R2, and the application runs on servers operated by Cloudonfire. Some providers, including Meta, Google, Cloudflare and the AI provider you connect, process data on infrastructure outside India. We transfer data abroad only as permitted by Indian law, and never to a country the Government of India has restricted.',
      },
    ],
  },
  {
    id: 'retention',
    heading: 'How long we keep information',
    blocks: [
      {
        ul: [
          'Conversation and contact data — for as long as your account is active. You can delete any contact or conversation at any time, and it is removed from our live systems.',
          'Connected channel credentials — until you disconnect the channel, when they are deleted immediately.',
          'When you delete your account — the account is locked at once and can be restored for 30 days. After that, all workspace data, including data received from Meta and Google, is permanently deleted from our live systems.',
          'Backups — deleted data can remain in encrypted backups for up to 30 days, until they expire.',
          'Invoices and payment records — for as long as Indian tax and accounting law requires, generally up to 8 years.',
          'Security logs — for a limited period, generally no more than 90 days.',
        ],
      },
      {
        p: 'Our Data Retention & Deletion Policy has the full detail.',
      },
    ],
  },
  {
    id: 'security',
    heading: 'How we protect information',
    blocks: [
      {
        p: 'Data is encrypted in transit with TLS and at rest. Access tokens and integration credentials are additionally encrypted before they are stored. Each business’s data is kept separate by row-level security enforced in the database, so one workspace can never read another’s. Staff access is limited to what is needed to run and support the Service. Our Security Policy describes these controls in detail.',
      },
      {
        p: 'No system is completely secure. If a personal data breach affects you, we will notify you, and the Data Protection Board of India where required, without undue delay.',
      },
    ],
  },
  {
    id: 'your-rights',
    heading: 'Your rights',
    blocks: [
      {
        p: 'Under India’s Digital Personal Data Protection Act, 2023, you have the right to:',
      },
      {
        ul: [
          'Obtain a summary of the personal data we hold about you and how we process it.',
          'Have inaccurate or incomplete data corrected, completed or updated.',
          'Have your personal data erased, unless we must keep it by law.',
          'Withdraw consent you have given, as easily as you gave it.',
          'Have your grievances addressed by our Grievance Officer.',
          'Nominate another person to exercise these rights on your behalf in case of death or incapacity.',
        ],
      },
      {
        p: 'You can view, edit, export and delete most of your data yourself in the app. For anything else, email {{EMAIL}}. We may need to verify your identity, and we respond within 30 days. If you are not satisfied with our response, you may complain to the Data Protection Board of India. If you are located outside India, you may have similar rights under your local law, and we will honour them.',
      },
      {
        note: 'If you are a customer of a business that uses {{PRODUCT}} and want your data corrected or deleted, please contact that business — it controls your data. If you contact us, we will forward your request to the business and help it respond.',
      },
    ],
  },
  {
    id: 'children',
    heading: 'Children',
    blocks: [
      {
        p: 'The Service is for businesses and is not directed at anyone under 18. We do not knowingly collect personal data from children. If you believe a child’s data has reached us, email {{EMAIL}} and we will delete it.',
      },
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    blocks: [
      {
        p: 'We may update this policy as the Service or the law changes. We will change the "Last updated" date above and, for significant changes, notify account owners by email or in the app before the change takes effect.',
      },
    ],
  },
  {
    id: 'contact',
    heading: 'Contact us and Grievance Officer',
    blocks: [
      {
        p: 'For any question or request about this policy or your personal data, contact {{COMPANY}} at {{EMAIL}}, call {{PHONE}}, or write to {{ADDRESS}}.',
      },
      {
        p: 'In accordance with the Information Technology Act, 2000, the rules made under it, and the Digital Personal Data Protection Act, 2023, our Grievance Officer is {{GRIEVANCE}} — email {{EMAIL}}, phone {{PHONE}}, address {{ADDRESS}}. Grievances are acknowledged within 24 hours and resolved within 15 days.',
      },
    ],
  },
];

export default function Lp2PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      hue="sky"
      updated="14 October 2026"
      intro="What we collect, why we collect it, who we share it with, and how you can see, change or delete it — including the data we receive from Meta and Google."
      sections={SECTIONS}
    />
  );
}
