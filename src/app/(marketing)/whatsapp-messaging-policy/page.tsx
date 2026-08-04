import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// The platform-mechanics half of the WhatsApp rules: windows, template
// categories, quality ratings, tiers. The Acceptable Use Policy covers
// consent and content; this covers how the WhatsApp Business Platform
// itself behaves and what a customer is agreeing to operate within.
// Meta's Tech Provider review looks for exactly this document.
export const metadata: Metadata = {
  title: { absolute: 'WhatsApp Messaging Policy — wacrm' },
  description:
    'How messaging works on the WhatsApp Business Platform through wacrm — the 24-hour service window, template categories and approval, quality ratings, messaging limits and enforcement.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    heading: 'What this policy is',
    blocks: [
      {
        p: 'wacrm sends and receives on the official WhatsApp Business Platform as a Meta Tech Provider. That platform has its own rules, and they are not ours to waive. This policy explains how messaging works through wacrm and what you are agreeing to operate within when you connect a number.',
      },
      {
        p: 'It applies to every account, forms part of our Terms, and works alongside our Acceptable Use Policy — that one covers consent and content, this one covers platform mechanics. Both sit underneath Meta’s own WhatsApp Business Messaging Policy, WhatsApp Business Solution Terms and Commerce Policy, which you must also follow. Where any of them is stricter than us, the stricter rule wins.',
      },
    ],
  },
  {
    id: 'service-window',
    heading: 'The 24-hour service window',
    blocks: [
      {
        p: 'WhatsApp does not let a business message whoever it likes whenever it likes. When a customer messages you, a 24-hour service window opens. Inside it you can reply freely with any message type. Once it closes, you can only reach that person again with a template Meta has pre-approved.',
      },
      {
        ul: [
          'The window resets each time the customer sends a new message.',
          'It is per contact, per number — not per conversation thread or per agent.',
          'wacrm shows you the remaining window in the inbox and stops a free-form send that would fall outside it. That guard is a convenience, not a legal shield: you remain responsible for what you send.',
          'Automations and AI agents obey the same window. A scheduled follow-up that lands outside it must be a template or it will not deliver.',
        ],
      },
      {
        note: 'A failed send outside the window is a Meta rejection, not a wacrm bug. We surface the error code so you can see which rule was hit.',
      },
    ],
  },
  {
    id: 'templates',
    heading: 'Message templates and categories',
    blocks: [
      {
        p: 'Any message that starts a conversation, or restarts one after the window closes, has to be a template approved by Meta in advance. Templates are submitted from wacrm and reviewed by Meta, usually within minutes to a day. We do not control the outcome and cannot expedite it.',
      },
      { p: 'Meta sorts templates into categories, and the category sets both the rules and the price:' },
      {
        ul: [
          'Utility — a message about a specific transaction the customer already has with you: order confirmations, delivery updates, appointment reminders, receipts, account alerts.',
          'Authentication — one-time passcodes and login verification, nothing else.',
          'Marketing — promotions, offers, product news, re-engagement, abandoned carts, anything designed to sell. Requires marketing opt-in and is covered in detail by our WhatsApp Marketing Policy.',
          'Service — free-form replies inside the 24-hour window, which need no template at all.',
        ],
      },
      {
        p: 'You must categorise honestly. Dressing a promotion up as a utility template to dodge the marketing rules or the price is a serious breach: Meta re-categorises templates it disagrees with, may reject them outright, and repeat attempts put the whole number at risk. We will act on it under our enforcement section below.',
      },
      {
        ul: [
          'Templates must match the business that sends them and must not mislead about price, availability or outcome.',
          'Variables must be filled with the data they describe — do not stuff extra sales copy into a placeholder.',
          'Meta may pause or disable a template that generates negative feedback, and it can do so without notice.',
        ],
      },
    ],
  },
  {
    id: 'quality',
    heading: 'Quality rating and messaging limits',
    blocks: [
      {
        p: 'Meta scores every business number on how recipients react to it. Blocks and "report business" taps push the rating down; steady, wanted conversation keeps it up. The rating is visible in WhatsApp Manager and drives what your number is allowed to do.',
      },
      {
        ul: [
          'A green (High) rating keeps your number in good standing. Yellow (Medium) is a warning. Red (Low) usually precedes a restriction.',
          'Numbers sit in messaging tiers that cap how many unique contacts you can start conversations with in 24 hours. Tiers rise automatically with sustained quality and volume, and fall when quality drops.',
          'A number in a restricted state cannot send template messages until the restriction lifts, even though replies inside an open window may still work.',
          'Meta sets, changes and enforces all of this on its own timeline. We can show you the state; we cannot appeal it on your behalf, restore a rating, or lift a tier.',
        ],
      },
      {
        note: 'The single most effective way to protect a number is to message fewer people who actually want to hear from you. Volume without consent is how numbers get banned, and a banned number is not something we can recover for you.',
      },
    ],
  },
  {
    id: 'your-responsibilities',
    heading: 'What you are responsible for',
    blocks: [
      {
        ul: [
          'Holding a valid opt-in for every person you message, and being able to evidence it. See the Acceptable Use Policy for what counts.',
          'Honouring stop requests promptly, however they are worded, including in your automations and AI agents.',
          'Keeping your business display name, profile and category accurate and consistent with the business you actually are.',
          'Being reachable. If you open conversations you must be able to answer them — an unattended number that only broadcasts attracts blocks.',
          'Disclosing that a customer is talking to an automated agent where the law where they live requires it.',
          'Complying with the laws that apply to you and your recipients, including India’s DPDP Act, the GDPR and local anti-spam rules.',
          'Anything sent from your workspace, including by your team members, your automations and any software you connect through our API.',
        ],
      },
    ],
  },
  {
    id: 'what-we-do',
    heading: 'What we do, and what we cannot do',
    blocks: [
      {
        ul: [
          'We deliver your messages through Meta’s API, store the conversation history in your workspace, and surface Meta’s status, error codes and quality signals to you.',
          'We enforce the platform’s structural rules where the product can — window checks, template requirements, opt-out handling.',
          'We cannot exempt you from a Meta rule, restore a banned number, raise a tier, reverse a template rejection, or intervene in Meta’s review decisions.',
          'We cannot see the contents of messages sent on WhatsApp outside the Business Platform, and we are not a party to your conversations.',
        ],
      },
      {
        p: 'Meta’s pricing for conversations is set by Meta and billed through your WhatsApp Business Account, separately from your wacrm subscription. Changes to that pricing are outside our control.',
      },
    ],
  },
  {
    id: 'enforcement',
    heading: 'Enforcement',
    blocks: [
      {
        p: 'Where we can we start with a conversation — most breaches are a new team learning the platform. Depending on severity we may warn you, rate-limit or pause your sending, require evidence of consent for a list, suspend the account, or terminate it.',
      },
      {
        p: 'We act immediately and without prior notice where there is a risk of real harm, or where your sending threatens our platform’s standing with Meta. Accounts terminated for those reasons are not refunded.',
      },
      {
        p: 'Meta enforces independently. It can warn, restrict, or ban your number and your WhatsApp Business Account without telling us first, and its decision stands regardless of anything we say.',
      },
      {
        p: 'To report misuse of a number sending through wacrm, email {{EMAIL}} with the number and a screenshot. You do not need to be a customer to report it.',
      },
    ],
  },
];

export default function Lp2WhatsAppMessagingPolicyPage() {
  return (
    <LegalPage
      title="WhatsApp Messaging Policy"
      hue="grass"
      updated="4 August 2026"
      intro="How messaging actually works on the WhatsApp Business Platform — the 24-hour window, templates and their categories, quality ratings and limits, and who is responsible when Meta says no."
      sections={SECTIONS}
    />
  );
}
