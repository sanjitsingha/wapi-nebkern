import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

export const metadata: Metadata = {
  title: { absolute: 'Terms & Conditions — wacrm' },
  description:
    'The agreement between you and wacrm — accounts, billing, acceptable use, WhatsApp Business Platform obligations, liability and termination.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    heading: 'The agreement',
    blocks: [
      {
        p: 'These Terms are a contract between you and {{COMPANY}}, registered at {{ADDRESS}} ("we", "us"). They govern your use of the wacrm application, its APIs and everything we provide with them (the "Service"). By creating an account, or by using the Service, you accept them.',
      },
      {
        p: 'If you are accepting on behalf of a company, you confirm you are authorised to bind it, and "you" means that company. The Service is for business use — you must be at least 18 and legally able to enter a contract.',
      },
      {
        p: 'Our Privacy Policy, Acceptable Use Policy, and Cancellation & Refund Policy are part of these Terms by reference.',
      },
    ],
  },
  {
    id: 'account',
    heading: 'Your account',
    blocks: [
      {
        ul: [
          'You are responsible for everything that happens under your account, including actions by team members you invite and by any integration you connect with an API key.',
          'Keep your credentials confidential and tell us promptly at {{EMAIL}} if you suspect unauthorised access.',
          'Give us accurate account and billing information and keep it current.',
          'One person or company per account. Do not share a single seat between people — invite them as team members instead.',
        ],
      },
    ],
  },
  {
    id: 'plans-billing',
    heading: 'Plans, billing and taxes',
    blocks: [
      {
        p: 'The Service is sold on a monthly subscription. Prices, seat counts, contact limits and storage caps for each plan are shown on our pricing page, and the limits in your plan are enforced in the product.',
      },
      {
        ul: [
          'Fees are charged in advance for each billing period and are stated in Indian Rupees unless we agree otherwise in writing.',
          'Payments are processed by our payment provider. By subscribing you authorise the charge for the plan you chose, including recurring charges until you cancel.',
          'Prices exclude taxes. You are responsible for GST and any other applicable tax, which we add where we are required to collect it.',
          'If a payment fails we may retry it and may suspend the Service after notice until the balance clears.',
          'We may change prices with at least 30 days’ notice by email. A price change takes effect at your next renewal, and you can cancel before then.',
          'Exceeding a plan limit may require an upgrade before you can add more seats, contacts or storage.',
        ],
      },
    ],
  },
  {
    id: 'trial',
    heading: 'Free trial',
    blocks: [
      {
        p: 'New accounts get a 14-day trial with full features and no card required. When it ends you must choose a paid plan to keep sending messages. Your data, contacts and history remain available to you either way, subject to the retention periods in our Privacy Policy. We may change or withdraw trials for future customers at any time.',
      },
    ],
  },
  {
    id: 'acceptable-use',
    heading: 'How you may use it',
    blocks: [
      {
        p: 'You get a non-exclusive, non-transferable right to use the Service for your own business while your subscription is current. Our Acceptable Use Policy sets out what is prohibited — most importantly, sending messages to people who have not opted in.',
      },
      { p: 'You must not:' },
      {
        ul: [
          'Resell, sublicense or provide the Service to third parties as your own product, unless we have agreed to that in writing.',
          'Reverse engineer, decompile or attempt to extract source code, except to the extent the law expressly permits.',
          'Circumvent plan limits, rate limits or access controls, or probe our systems without written authorisation.',
          'Upload malware, or use the Service to break the law or infringe anyone’s rights.',
          'Send unsolicited bulk messages, or use the Service in a way that risks the integrity of your WhatsApp number or ours.',
        ],
      },
      {
        note: 'Breaching the Acceptable Use Policy is the one thing that can get an account suspended without prior notice — spam damages every business on the platform, not only yours.',
      },
    ],
  },
  {
    id: 'whatsapp',
    heading: 'WhatsApp, Instagram and Meta',
    blocks: [
      {
        p: 'The Service runs on the official WhatsApp Business Platform and Meta’s messaging APIs. Your use of those channels is also governed by Meta’s own terms and policies, including the WhatsApp Business Messaging Policy and Commerce Policy, and you agree to comply with them.',
      },
      {
        ul: [
          'You are responsible for your WhatsApp Business account, your display name, your message templates and their approval status.',
          'Meta charges its own conversation and template fees. Unless your plan states otherwise, those are billed to you by Meta and are not included in our subscription fee.',
          'Meta may change, throttle, suspend or withdraw its APIs, or suspend your number, on its own terms and timeline. We do not control that and are not liable for it.',
          'Quality ratings and messaging limits are assigned by Meta based on how your recipients react to your messages. Poor practice lowers them; we cannot restore them for you.',
        ],
      },
    ],
  },
  {
    id: 'your-data',
    heading: 'Your data',
    blocks: [
      {
        p: 'You own your data — your contacts, messages, templates, knowledge bases and everything else you put into the Service. You grant us the limited right to host, process, transmit and display it as needed to run the Service for you and to comply with the law.',
      },
      {
        p: 'You confirm you have the rights and lawful basis to give us that data, including consent from the people you message where consent is required. We act as your processor for it; our Privacy Policy sets out the details.',
      },
      {
        p: 'You can export your data at any time while your account is active. We do not use your conversation content to train general-purpose AI models.',
      },
    ],
  },
  {
    id: 'availability',
    heading: 'Availability, support and changes',
    blocks: [
      {
        p: 'We work to keep the Service available and will give reasonable notice of planned maintenance where we can. Unless your plan includes a written service-level commitment, the Service is provided without an uptime guarantee.',
      },
      {
        p: 'Support is provided by email at {{EMAIL}} during business hours, with faster response targets on higher plans. We may add, change or remove features; where a change materially reduces core functionality we will give you at least 30 days’ notice.',
      },
    ],
  },
  {
    id: 'third-party',
    heading: 'Third-party services',
    blocks: [
      {
        p: 'The Service can connect to tools we do not control — Zapier, Make, n8n, AI model providers, payment providers and any system you point our API or webhooks at. Those integrations are between you and that provider, on their terms. We are not responsible for what they do with data you send them, and enabling an integration is your instruction to us to send it.',
      },
    ],
  },
  {
    id: 'ip',
    heading: 'Intellectual property',
    blocks: [
      {
        p: 'We and our licensors own the Service — its software, design, documentation and trade marks. Nothing here transfers that to you beyond the right to use it under these Terms. If you send us feedback or suggestions, we may use them freely and without obligation to you; we will not claim any right in your data by doing so.',
      },
    ],
  },
  {
    id: 'confidentiality',
    heading: 'Confidentiality',
    blocks: [
      {
        p: 'Each of us may learn non-public information about the other. Both of us agree to use it only for this agreement, to protect it with reasonable care, and not to disclose it except to people who need it and are under similar obligations, or where the law compels disclosure.',
      },
    ],
  },
  {
    id: 'termination',
    heading: 'Term, suspension and termination',
    blocks: [
      {
        ul: [
          'You may cancel at any time from your billing settings. Cancellation takes effect at the end of the current billing period; see our Cancellation & Refund Policy for what is and is not refundable.',
          'We may suspend or terminate your account if you materially breach these Terms and do not fix it within 14 days of notice — or immediately, without notice, for Acceptable Use breaches, non-payment after notice, or activity that puts our platform or other customers at risk.',
          'We may also terminate for convenience with 30 days’ notice, refunding any prepaid, unused fees.',
          'On termination your right to use the Service stops. Export your data first: after closure we delete or anonymise workspace data as described in the Privacy Policy.',
          'Clauses that should outlive the agreement — payment owed, intellectual property, confidentiality, disclaimers, liability, indemnity and governing law — survive it.',
        ],
      },
    ],
  },
  {
    id: 'disclaimers',
    heading: 'Disclaimers',
    blocks: [
      {
        p: 'The Service is provided "as is" and "as available". To the fullest extent the law allows, we disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Service will be uninterrupted or error-free, that message delivery is guaranteed — delivery depends on Meta and on the recipient — or that AI-generated replies will always be accurate.',
      },
      {
        note: 'AI agents can be wrong. You are responsible for what your agent tells your customers, so review its knowledge base and test it in the playground before you let it answer unsupervised.',
      },
    ],
  },
  {
    id: 'liability',
    heading: 'Limitation of liability',
    blocks: [
      {
        p: 'To the fullest extent permitted by law, neither of us is liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, goodwill or data, even if warned they were possible.',
      },
      {
        p: 'Our total liability for all claims in any 12-month period is capped at the amount you paid us for the Service in the 12 months before the claim arose. Nothing here excludes liability that cannot lawfully be excluded, such as for fraud, death or personal injury caused by negligence.',
      },
    ],
  },
  {
    id: 'indemnity',
    heading: 'Indemnity',
    blocks: [
      {
        p: 'You agree to defend and indemnify us against claims, damages and reasonable costs arising from the messages you send, the data you upload, your breach of these Terms or the Acceptable Use Policy, or your violation of Meta’s policies or applicable law.',
      },
    ],
  },
  {
    id: 'governing-law',
    heading: 'Governing law and disputes',
    blocks: [
      {
        p: 'These Terms are governed by the laws of India, without regard to conflict-of-laws rules. The courts of {{CITY}} have exclusive jurisdiction, and both of us submit to it.',
      },
      {
        p: 'Before filing anything, please email {{EMAIL}} and give us 30 days to resolve it — most disputes end there.',
      },
    ],
  },
  {
    id: 'general',
    heading: 'Changes and general terms',
    blocks: [
      {
        ul: [
          'We may update these Terms. For material changes we will give at least 30 days’ notice by email or in-app, and continuing to use the Service after that means you accept them. If you do not, cancel before they take effect.',
          'You may not assign this agreement without our consent; we may assign it in a merger, acquisition or sale of assets.',
          'If a clause is unenforceable, the rest stays in force.',
          'Not exercising a right straight away does not waive it.',
          'Neither of us is liable for delays caused by events beyond our reasonable control.',
          'These Terms, with the policies they reference, are the entire agreement between us and replace any earlier understanding.',
        ],
      },
      { p: 'Questions about these Terms: {{EMAIL}}.' },
    ],
  },
];

export default function Lp2TermsPage() {
  return (
    <LegalPage
      kicker="Terms"
      title="Terms & Conditions"
      hue="grape"
      updated="25 July 2026"
      intro="The rules of the road: what you can expect from us, what we need from you, and what happens when something goes wrong."
      sections={SECTIONS}
    />
  );
}
