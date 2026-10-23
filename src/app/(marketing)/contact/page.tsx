import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Bundled with the legal set rather than the marketing pages because
// that's the role it plays: Indian payment gateways require a reachable
// "Contact us" page with a real address and phone number alongside the
// policies, and the DPDP Act requires a named grievance contact. It's a
// compliance page that happens to also be useful.
export const metadata: Metadata = {
  alternates: { canonical: '/contact' },
  // Distinct from /contact-us (the form), which already owns
  // "Contact us — Dripo": two pages sharing a title compete with each
  // other in search.
  title: { absolute: 'Contact & grievance officer — Dripo WhatsApp for Business' },
  description:
    'How to reach Dripo — support, billing, privacy and grievance contacts, registered address and response times.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'support',
    heading: 'Support',
    blocks: [
      {
        p: 'Email {{EMAIL}} or call {{PHONE}}, and a person will answer. Write from the address on your account and tell us your workspace name — it saves a round trip.',
      },
      {
        ul: [
          'Business hours are Monday to Friday, 10:00–18:00 IST.',
          'We aim to reply within one working day, and faster on Growth and Business plans.',
          'For anything urgent and account-breaking — you cannot sign in, or messages have stopped sending — put "URGENT" in the subject line.',
        ],
      },
      {
        note: 'Before you write about a WhatsApp number that has stopped sending, check Settings → WhatsApp for the quality rating. If Meta has restricted the number, that is the cause, and our Acceptable Use Policy explains what usually leads to it.',
      },
    ],
  },
  {
    id: 'billing',
    heading: 'Billing and refunds',
    blocks: [
      {
        p: 'Invoices, payment failures, cancellations and refunds: {{EMAIL}}. Include the invoice number or payment reference. Our Cancellation & Refund Policy sets out what is refundable and how long it takes.',
      },
      {
        p: 'You can cancel or change your plan yourself at any time in Settings → Billing — no need to email us first.',
      },
    ],
  },
  {
    id: 'privacy',
    heading: 'Privacy and data requests',
    blocks: [
      {
        p: 'To access, correct, export or delete your personal data, email {{EMAIL}}. We respond within 30 days and may need to verify your identity first. Account owners can also delete their account themselves from Settings → Profile — our Data Deletion page has step-by-step instructions, and our Privacy Policy has the full detail.',
      },
      {
        p: 'If you are a customer of a business that uses {{PRODUCT}} and you want your data removed, contact that business — it controls your data. Tell us as well and we will pass the request on.',
      },
    ],
  },
  {
    id: 'grievance',
    heading: 'Grievance Officer',
    blocks: [
      {
        p: 'As required under the Information Technology Act, 2000, the rules made under it, and the Digital Personal Data Protection Act, 2023, our designated Grievance Officer is {{GRIEVANCE}} — email {{EMAIL}}, phone {{PHONE}}, address {{ADDRESS}}.',
      },
      {
        ul: [
          'Grievances are acknowledged within 24 hours.',
          'They are resolved within 15 days of receipt.',
          'If you are not satisfied with the outcome, you may escalate to the Data Protection Board of India.',
        ],
      },
    ],
  },
  {
    id: 'abuse',
    heading: 'Reporting spam or abuse',
    blocks: [
      {
        p: 'Received a message you did not ask for, sent through {{PRODUCT}}? Email {{EMAIL}} with the sending number and a screenshot if you have one. You do not need to be a customer, and we investigate every report.',
      },
    ],
  },
  {
    id: 'registered-office',
    heading: 'Registered office',
    blocks: [
      {
        p: '{{COMPANY}}, {{ENTITY}}. Registered address: {{ADDRESS}}. Email: {{EMAIL}}. Phone: {{PHONE}}.',
      },
      {
        p: 'Email is the fastest way to reach us, and post reaches us too. We do not take walk-in visits without an appointment.',
      },
    ],
  },
];

export default function Lp2ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      hue="pop"
      updated="14 October 2026"
      intro="Real people, one inbox, sensible hours. Here's who to write to depending on what you need — or use the form at /contact-us."
      sections={SECTIONS}
    />
  );
}
