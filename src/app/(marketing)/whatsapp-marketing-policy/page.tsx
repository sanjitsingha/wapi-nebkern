import type { Metadata } from 'next';

import { LegalPage, type LegalSection } from '@/components/lp2/legal';

// Marketing is the category that gets numbers banned, so it gets its
// own document rather than a clause inside another one. Deliberately
// narrower than the Acceptable Use Policy: this is only about
// promotional sending — opt-in standard, frequency, opt-out, campaigns
// and broadcasts, and what we do when a campaign goes wrong.
export const metadata: Metadata = {
  title: { absolute: 'WhatsApp Marketing Policy — Instant' },
  description:
    'The rules for promotional messaging through Instant — the marketing opt-in standard, frequency and timing, mandatory opt-out, campaign and broadcast conduct, and enforcement.',
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: 'why',
    heading: 'Why marketing gets its own policy',
    blocks: [
      {
        p: 'Marketing is the category of message that gets numbers banned. It goes to people who are not currently in a conversation with you, it arrives in the same app as messages from their family, and it is the one people report. Almost every WhatsApp Business Account restriction we have seen traces back to a promotional send.',
      },
      {
        p: 'So the rules below are stricter than the law in some places, and we enforce them as a condition of using Instant for campaigns and broadcasts. This policy forms part of our Terms and works with our Acceptable Use Policy and WhatsApp Messaging Policy. Meta’s WhatsApp Business Messaging Policy and Commerce Policy apply on top; the strictest rule always wins.',
      },
    ],
  },
  {
    id: 'what-counts',
    heading: 'What counts as marketing',
    blocks: [
      {
        p: 'If the purpose of the message is to sell, promote or bring someone back, it is marketing — regardless of how it is worded or which template category you chose.',
      },
      {
        ul: [
          'Offers, discounts, sales, coupons and price drops.',
          'New product, feature or stock announcements.',
          'Abandoned-cart and browse-abandonment nudges.',
          'Re-engagement, win-back and "we miss you" messages.',
          'Newsletters, event invitations, webinar promotion and referral asks.',
          'Upsell and cross-sell suggestions attached to an otherwise transactional message.',
        ],
      },
      {
        note: 'A utility template with a promotion bolted onto the end is a marketing message wearing a disguise. Meta re-categorises these, and repeated attempts put the number at risk. Do not do it.',
      },
    ],
  },
  {
    id: 'opt-in',
    heading: 'The marketing opt-in standard',
    blocks: [
      {
        p: 'Marketing needs its own opt-in, and it is a higher bar than the general permission to contact someone described in our Acceptable Use Policy. The person must have agreed, knowingly and specifically, to receive promotional messages from your business on WhatsApp at that number.',
      },
      { p: 'A valid marketing opt-in is:' },
      {
        ul: [
          'Affirmative — a ticked box, a tapped button, a sent keyword. Never a pre-ticked box, never buried in terms nobody reads.',
          'Specific — it names WhatsApp as the channel and names your business as the sender.',
          'Informed — it makes clear that promotional messages are what is being agreed to.',
          'Logged — you can produce the date, the source and the wording shown at the time.',
        ],
      },
      { p: 'These are never a marketing opt-in:' },
      {
        ul: [
          'A phone number collected for delivery, billing, support, OTPs or account recovery.',
          'A purchase, on its own, without a separate marketing agreement.',
          'A purchased, rented, scraped or "verified" list, however it is sold to you.',
          'Numbers taken from WhatsApp groups, directories, social media or a competitor’s customers.',
          'Consent given to a sister brand, a franchise, an agency or a previous owner of the business, unless the person was told the messages would come from you.',
          'Someone messaging you once about something unrelated.',
        ],
      },
      {
        p: 'You must be able to evidence consent for any list you upload, and produce it if we ask. If you cannot, do not upload it.',
      },
    ],
  },
  {
    id: 'opt-out',
    heading: 'Opt-out is mandatory',
    blocks: [
      {
        ul: [
          'Every marketing message must offer a clear, obvious way to stop — a "Stop promotions" button or a plain instruction in the body.',
          'Honour any request to stop, however it is phrased. "Stop", "unsubscribe", "remove me", or a plainly annoyed reply all count, and none of them require a magic keyword.',
          'Act within 24 hours, and never send another marketing message to that contact afterwards.',
          'An opt-out from marketing does not have to end transactional messaging, but it absolutely ends promotion.',
          'Do not move an opted-out contact to a new list or segment, and do not message them from a second number to get around it.',
          'Configure automations, campaign schedules and AI agents so they check opt-out status before sending. An automated promotion to someone who unsubscribed is still a breach, and "the automation did it" is not a defence.',
        ],
      },
      {
        note: 'Instant records opt-outs at the contact level and excludes them from campaigns automatically. That is a safety net, not permission to stop paying attention — you are responsible for the send.',
      },
    ],
  },
  {
    id: 'frequency',
    heading: 'Frequency, timing and volume',
    blocks: [
      {
        ul: [
          'Send at a frequency you would accept yourself. For most businesses that is a handful of promotional messages a month, not a daily broadcast.',
          'Message during reasonable local hours in the recipient’s time zone. A 2am offer earns blocks.',
          'Do not split one campaign across multiple sends, numbers or workspaces to disguise its size or slip under a limit.',
          'Warm a new number up gradually. Blasting a fresh number’s full tier on day one is the fastest route to a Low quality rating.',
          'Segment. A relevant message to 500 interested people outperforms a generic one to 50,000 and does not cost you the number.',
        ],
      },
    ],
  },
  {
    id: 'content',
    heading: 'Content rules for promotions',
    blocks: [
      {
        ul: [
          'Identify your business clearly in the message. The recipient should never have to guess who is writing.',
          'Be accurate about price, availability, discount, deadline and terms. No fake scarcity, no countdowns that reset, no "you have won" where nobody has won anything.',
          'Do not imply an existing order, delivery, payment problem or account issue to get a message opened.',
          'Do not promote goods and services Meta prohibits — including weapons, illegal or recreational drugs, tobacco and vaping, live animals, adult services, unlicensed gambling, and unapproved medical or financial products. Check Meta’s Commerce Policy for the current list.',
          'No misleading health, medical or financial claims, and nothing suggesting a product cures a condition.',
          'Use only imagery, trade marks and copy you have the right to use.',
          'Where you target by inferred characteristics, do not use sensitive attributes — health, religion, sexual orientation, political views — to build a promotional audience.',
        ],
      },
    ],
  },
  {
    id: 'campaigns',
    heading: 'Campaigns and broadcasts in Instant',
    blocks: [
      {
        p: 'Campaigns are the feature most likely to end an account, so they carry extra conditions:',
      },
      {
        ul: [
          'Marketing templates must be submitted in the Marketing category. Miscategorising to reduce cost or dodge review is a breach of this policy in itself.',
          'Uploaded lists must be your own contacts with logged consent. We may ask for evidence before a large first send.',
          'We may rate-limit, stage or pause a campaign that looks likely to damage your number or our platform standing, and we may do it mid-send.',
          'Test on a small segment first. A template that reads badly to 200 people reads just as badly to 200,000, and by then the blocks have landed.',
          'You are responsible for sends made through our API and by connected software exactly as if you had pressed the button yourself.',
        ],
      },
    ],
  },
  {
    id: 'enforcement',
    heading: 'Enforcement and consequences',
    blocks: [
      {
        p: 'Depending on severity we may warn you, throttle or pause campaigns, require documented consent before further sends, suspend the account, or terminate it. We act immediately and without notice where a send threatens real harm, our platform, or another customer.',
      },
      {
        p: 'Meta enforces separately and on its own timeline. It can lower your quality rating, cut your messaging tier, disable templates, restrict the number, or ban the WhatsApp Business Account — with no warning to us and no route of appeal through us. A number lost this way is not something we can recover, and losing it does not entitle you to a refund.',
      },
      {
        p: 'If you received a promotional message you did not consent to, email {{EMAIL}} with the sending number and a screenshot. We investigate every report, and you do not need to be a customer to make one.',
      },
    ],
  },
];

export default function Lp2WhatsAppMarketingPolicyPage() {
  return (
    <LegalPage
      title="WhatsApp Marketing Policy"
      hue="mint"
      updated="4 August 2026"
      intro="Promotional messages are the ones that get numbers banned. These are the rules for sending them through Instant — a real opt-in, a working opt-out, and a frequency you would tolerate yourself."
      sections={SECTIONS}
    />
  );
}
