import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Not boilerplate for this product. wacrm sends on the WhatsApp
// Business Platform, where one customer's spam lowers quality ratings,
// triggers Meta enforcement and can get numbers banned. This policy is
// the document we point at when suspending an account, so it has to be
// specific about opt-in and opt-out rather than gesturing at "misuse".
export const metadata: Metadata = {
  title: { absolute: 'Acceptable Use Policy — wacrm' },
  description:
    'The messaging rules for wacrm — opt-in requirements, honouring opt-outs, prohibited content and conduct, and how we enforce them.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    heading: 'Why this policy exists',
    blocks: [
      {
        p: 'WhatsApp is not email. Recipients can report a business with one tap, and Meta responds by lowering that number’s quality rating, cutting its messaging limits, and eventually banning it. Spam sent from one account also makes the whole platform more hostile to every legitimate business on it.',
      },
      {
        p: 'So this policy is stricter than you might expect, and we enforce it. It applies to everyone using wacrm and forms part of our Terms. It sits alongside — never instead of — Meta’s WhatsApp Business Messaging Policy and Commerce Policy, which you must also follow.',
      },
    ],
  },
  {
    id: 'opt-in',
    heading: 'Consent: the rule that matters most',
    blocks: [
      {
        p: 'You may only message people who have given you permission to contact them on WhatsApp at that number. Permission must be knowing and specific — the person must understand they are opting in to WhatsApp messages from your business by name.',
      },
      { p: 'Acceptable ways to collect it include:' },
      {
        ul: [
          'A checkbox or explicit consent step on your website, checkout or lead form that names WhatsApp and your business.',
          'Someone messaging your number first, or tapping a "Chat on WhatsApp" button or QR code you published.',
          'A signed form, in-store sign-up or verbal consent you have logged, where local law permits.',
          'An existing customer relationship where you disclosed WhatsApp as a contact channel and offered a way to decline.',
        ],
      },
      { p: 'These are not consent:' },
      {
        ul: [
          'A purchased, rented, scraped or "verified" contact list, however it is described to you.',
          'Numbers harvested from websites, directories, social media or WhatsApp groups.',
          'A number someone gave you for a different purpose — delivery, OTPs, billing — with no mention of marketing.',
          'Consent given to a different business, or to you under a different brand.',
          'Silence, inactivity or an unticked opt-out box.',
        ],
      },
      {
        note: 'You must keep a record of when and how each contact opted in, and be able to produce it if we ask. If you cannot evidence consent for a list, do not upload it.',
      },
    ],
  },
  {
    id: 'opt-out',
    heading: 'Honouring opt-outs',
    blocks: [
      {
        ul: [
          'Stop messaging anyone who asks you to stop — however they word it. "Stop", "unsubscribe", "don’t message me", or a plainly annoyed reply all count.',
          'Act on it promptly, and never later than 24 hours.',
          'Do not require a specific keyword, a form, or a reply to a different number before you will honour a request.',
          'Include a clear way to opt out in marketing campaigns.',
          'Do not re-add someone who opted out to a new list or segment, and do not message them from a second number to get around it.',
          'Configure your automations and AI agents so they respect opt-outs too. An automated follow-up to someone who unsubscribed is still a breach.',
        ],
      },
    ],
  },
  {
    id: 'prohibited-content',
    heading: 'Content you may not send',
    blocks: [
      {
        p: 'You may not use wacrm to send, store or promote:',
      },
      {
        ul: [
          'Anything illegal where you or your recipient are, or anything that facilitates illegal activity.',
          'Material that exploits or endangers children, in any form.',
          'Harassment, threats, hate speech, or content that incites violence or discrimination.',
          'Fraud, phishing, impersonation of another business or person, fake offers, or deceptive claims about price, availability or outcome.',
          'Malware, spyware, or links intended to compromise a device or account.',
          'Goods and services Meta prohibits on the platform, including weapons, illegal or recreational drugs, tobacco and vaping products, live animals, adult services, gambling where not licensed, and unapproved medical or financial products. Check Meta’s Commerce Policy for the current list.',
          'Misleading health, medical or financial advice, or claims that a product cures a condition.',
          'Content you do not have the rights to, including other people’s trade marks and copyrighted material.',
        ],
      },
    ],
  },
  {
    id: 'prohibited-conduct',
    heading: 'Conduct that is not allowed',
    blocks: [
      {
        ul: [
          'Sending unsolicited bulk messages, or breaking one campaign into many small sends to disguise it.',
          'Rotating numbers, workspaces or accounts to evade rate limits, quality ratings or a suspension.',
          'Creating accounts with false details, or on someone else’s behalf without authority.',
          'Reselling access to your workspace, or operating a bulk-messaging service for third parties on your account, unless we have agreed to it in writing.',
          'Automated scraping of the Service, load testing without written permission, or probing our infrastructure for vulnerabilities outside a process we have agreed.',
          'Sharing or exposing API keys publicly, or using another customer’s credentials.',
          'Interfering with the Service’s operation, or with any other customer’s use of it.',
          'Using AI agents to deceive people about whether they are talking to a machine, where disclosure is legally required.',
        ],
      },
    ],
  },
  {
    id: 'your-obligations',
    heading: 'Your other obligations',
    blocks: [
      {
        ul: [
          'Identify your business clearly and consistently. Your WhatsApp display name must match the business you actually are.',
          'Keep your message templates accurate, and do not use an approved utility template to deliver marketing.',
          'Comply with the privacy and marketing laws that apply to you and to your recipients — including India’s DPDP Act, the GDPR, and local anti-spam rules.',
          'Answer privacy requests from your own contacts. You control that data; we only hold it for you.',
          'Message at reasonable hours in your recipients’ time zone.',
        ],
      },
    ],
  },
  {
    id: 'enforcement',
    heading: 'How we enforce this',
    blocks: [
      {
        p: 'Where we can, we start with a conversation — most breaches are a new team learning the platform, not bad faith. Depending on severity we may warn you, rate-limit or pause your sending, require evidence of consent for a list, suspend the account, or terminate it.',
      },
      {
        p: 'We act immediately and without prior notice where there is a risk of real harm: content involving children, active fraud or phishing, malware, or sending at a volume that threatens our platform or another customer. Accounts terminated for these reasons are not refunded.',
      },
      {
        p: 'Meta enforces independently of us and on its own timeline. It can restrict or ban your number without warning us first, and we cannot appeal that on your behalf or restore a quality rating.',
      },
    ],
  },
  {
    id: 'reporting',
    heading: 'Reporting abuse',
    blocks: [
      {
        p: 'If you received a message you believe was sent through wacrm without your consent, or you want to report any misuse, email {{EMAIL}}. Include the sending number and a screenshot if you have one. We investigate every report, and you do not need to be a customer to make one.',
      },
      {
        p: 'To stop messages from a specific business, replying "stop" is usually fastest — but tell us as well if they keep coming.',
      },
    ],
  },
];

export default function Lp2AcceptableUsePage() {
  return (
    <LegalPage
      kicker="Fair play"
      title="Acceptable Use Policy"
      hue="coral"
      updated="25 July 2026"
      intro="One rule above all others: message people who asked to hear from you. Here's what that means in practice, and what happens if it's ignored."
      sections={SECTIONS}
    />
  );
}
