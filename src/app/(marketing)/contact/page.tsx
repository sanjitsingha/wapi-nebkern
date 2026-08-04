import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Bundled with the legal set rather than the marketing pages because
// that's the role it plays: Indian payment gateways require a reachable
// "Contact us" page with a real address and phone number alongside the
// policies, and the DPDP Act requires a named grievance contact. It's a
// compliance page that happens to also be useful.
export const metadata: Metadata = {
  title: { absolute: 'Contact us — wacrm' },
  description:
    'How to reach wacrm — support, billing, privacy and grievance contacts, registered address and response times.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'support',
    heading: 'Support',
    blocks: [
      {
        p: 'Email {{EMAIL}} and a human will answer. Write from the address on your account and tell us your workspace name — it saves a round trip.',
      },
      {
        ul: [
          'Business hours are Monday to Friday, 10:00–18:00 IST.',
          'We aim to reply within one working day, and faster on Pro and Business plans.',
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
        p: 'To access, correct, export or delete your personal data, email {{EMAIL}}. We respond within 30 days and may need to verify your identity first. Full detail is in our Privacy Policy.',
      },
      {
        p: 'If you are a customer of a business that uses wacrm and you want your data removed, contact that business — they control it. Tell us as well and we will pass the request on.',
      },
    ],
  },
  {
    id: 'grievance',
    heading: 'Grievance Officer',
    blocks: [
      {
        p: 'As required under India’s Digital Personal Data Protection Act and IT Rules, our designated Grievance Officer is {{GRIEVANCE}}, reachable at {{EMAIL}}.',
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
        p: 'Received a message you did not ask for, sent through wacrm? Email {{EMAIL}} with the sending number and a screenshot if you have one. You do not need to be a customer, and we investigate every report.',
      },
    ],
  },
  {
    id: 'registered-office',
    heading: 'Registered office',
    blocks: [
      {
        p: '{{COMPANY}}, {{ADDRESS}}. Telephone: {{PHONE}}.',
      },
      {
        p: 'Post reaches us, but email is considerably faster. We do not take walk-in visits without an appointment.',
      },
    ],
  },
];

export default function Lp2ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      hue="pop"
      updated="25 July 2026"
      intro="Real people, one inbox, sensible hours. Here's who to write to depending on what you need."
      sections={SECTIONS}
    />
  );
}
