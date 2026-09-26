import type { Lp2Hue } from '@/components/lp2/decor';

// ============================================================
// Competitor comparison pages — /compare/<slug>
//
// One entry per rival. The page, its metadata and its sitemap row are
// all generated from this file, so adding a comparison is adding an
// object here and nothing else.
//
// ── The rule this file exists to enforce ──
//
// Every figure about a rival must come from that rival's own public
// page, and `checkedOn` records the day it was read there. Not from a
// comparison blog, not from memory: third-party posts about this market
// are frequently wrong, and two of them contradicted Interakt's own
// pricing page on whether it marks up Meta's conversation rates — so
// no markup claim is made here at all.
//
// `rivalBetter` is not decoration. A comparison page that finds no case
// for the other product reads as an advert and is treated as one, by
// readers and by Google. Where a rival genuinely wins, say so.
// ============================================================

export interface ComparisonRow {
  /** What is being compared, in the reader's words. */
  feature: string;
  instant: string;
  rival: string;
  /**
   * Marks the row where the rival matches or beats Instant. Renders as
   * a level or losing row rather than a win, and keeps the table
   * honest — see the note above.
   */
  rivalBetter?: boolean;
}

export interface Comparison {
  /** URL segment: /compare/<slug>. */
  slug: string;
  /** The rival's name as they write it. */
  rival: string;
  /**
   * The rival's wordmark for the table header, when we have it.
   * Optional on purpose: a rival without one falls back to their name
   * in text, so a new comparison never waits on an asset.
   *
   * `width`/`height` are the file's true pixels — next/image needs the
   * real ratio to reserve the box before the bytes land. The header
   * sizes by height and lets the width follow.
   */
  rivalLogo?: { src: string; width: number; height: number };
  /** Their pricing page — the source for every figure in `rows`. */
  source: string;
  /** ISO date those figures were last read from `source`. */
  checkedOn: string;
  /** <title>, already in the site's "— Instant" house style. */
  title: string;
  metaDescription: string;
  /** One-paragraph framing above the table. */
  intro: string;
  rows: ComparisonRow[];
  /** Who each product actually suits. Both lists must be non-empty. */
  verdict: {
    instant: string[];
    rival: string[];
  };
  hue: Lp2Hue;
}

export const COMPARISONS: Comparison[] = [
  {
    slug: 'instant-vs-interakt',
    rival: 'Interakt',
    rivalLogo: {
      src: '/images/compare/interakt.png',
      width: 3750,
      height: 1249,
    },
    source: 'https://www.interakt.shop/pricing/',
    checkedOn: '2026-09-25',
    title: 'Instant vs Interakt — WhatsApp API pricing and features compared',
    metaDescription:
      'Instant and Interakt side by side: monthly cost, AI replies, channels and trials. Interakt figures read from their own pricing page on 25 September 2026.',
    intro:
      'Both run on the official WhatsApp Business API, so the messages, the templates and Meta’s per-conversation rates are the same either way. What differs is what the software around them costs and what it includes before you add anything on.',
    rows: [
      {
        feature: 'Entry plan with WhatsApp',
        instant: '₹499/mo — Starter, one number and the shared inbox',
        rival: '₹2,799/mo + taxes — Growth. The free Starter plan is Instagram only',
      },
      {
        feature: 'The plan most teams land on',
        instant: '₹799/mo — Growth, with AI and automations included',
        rival: '₹3,799/mo + taxes — Advanced',
      },
      {
        feature: 'AI replies',
        instant: 'Maya is part of Growth. Unlimited replies, no per-message fee',
        rival: '₹2,499/mo add-on. 100 AI messages included, then ₹0.50 each',
      },
      {
        feature: 'Channels in one inbox',
        instant: 'WhatsApp, Instagram and Messenger',
        rival: 'WhatsApp and Instagram',
      },
      {
        feature: 'Free trial',
        instant: '14 days, every feature, no card',
        rival: 'Offered, but the length is not stated on the pricing page',
      },
      {
        feature: 'Meta’s conversation charges',
        instant: 'Billed by Meta, to you, at Meta’s published rates',
        rival: 'Their pricing page states no markup on Meta’s conversation rates',
        rivalBetter: true,
      },
      {
        feature: 'Team members',
        instant: 'Starter is a single user; Growth and Business add the team',
        rival: 'Unlimited agents on Growth and Advanced',
        rivalBetter: true,
      },
      {
        feature: 'Sales pipeline',
        instant: 'Included — deals run on the conversation itself',
        rival: 'A separate Sales CRM plan at ₹2,499/mo for 5 agents, then ₹499 per agent',
      },
    ],
    verdict: {
      instant: [
        'You want AI replies working from day one without a second subscription and a per-message meter.',
        'You answer on Messenger as well as WhatsApp and Instagram.',
        'The monthly software bill matters — the comparable tiers are ₹799 against ₹2,799.',
        'You want the pipeline and the inbox to be the same record, not two products.',
      ],
      rival: [
        'You need more than one user on the cheapest paid plan — Instant’s Starter is a single seat, and Interakt’s Growth is not.',
        'You are already running their Sales CRM and your team is trained on it.',
        'You want a free tier to sit on indefinitely, if Instagram alone is enough for now.',
      ],
    },
    hue: 'grape',
  },
  {
    slug: 'instant-vs-wati',
    rival: 'WATI',
    source: 'https://www.wati.io/pricing/',
    checkedOn: '2026-09-25',
    title: 'Instant vs WATI — WhatsApp API seats, AI and trials compared',
    metaDescription:
      'Instant and WATI side by side on users per plan, AI add-ons, channels and trial length. WATI figures read from their own pricing page on 25 September 2026.',
    intro:
      'Both sit on the official WhatsApp Business API, so Meta’s per-conversation charges are the same either way. Where they part company is how many people can use the account, whether AI costs extra, and how long you get to try it.',
    rows: [
      {
        feature: 'Free trial',
        instant: '14 days, every feature, no card',
        rival: '7 days, zero setup fees',
      },
      {
        feature: 'Users on the entry paid plan',
        instant: 'Starter is a single user; Growth and Business add the team',
        rival: 'Growth includes 3 users, and extra users cannot be added to it',
        rivalBetter: true,
      },
      {
        feature: 'Adding a teammate',
        instant: 'Included in the plan, not billed per head',
        rival: 'Pro adds users at $24 each a month; Business at $69 each',
      },
      {
        feature: 'AI replies',
        instant: 'Maya is part of Growth. Unlimited replies, no per-message fee',
        rival: 'Chatbot builder is included; Astra AI Agents are a separate add-on',
      },
      {
        feature: 'Channels in one inbox',
        instant: 'WhatsApp, Instagram and Messenger',
        rival: 'Growth covers one channel connection',
      },
      {
        feature: 'Broadcast volume',
        instant: 'Campaigns to everyone who opted in, on every plan',
        rival: 'Growth caps at 15,000 broadcasts a month; Pro is unlimited',
      },
      {
        feature: 'Several WhatsApp numbers',
        instant: 'One number per account',
        rival: 'Business supports multiple WhatsApp numbers',
        rivalBetter: true,
      },
      {
        feature: 'How you pay',
        instant: 'Rupees, monthly, ₹499 to ₹999',
        rival: 'Plans are priced in US dollars; India also has a ₹999 one-time Single User plan carrying ₹999 of message credit for 3 months',
      },
    ],
    verdict: {
      instant: [
        'AI replies matter to you and you would rather they came with the plan than as a second subscription.',
        'You answer on Messenger as well as WhatsApp and Instagram.',
        'You want to be billed in rupees, monthly, without per-seat maths.',
        'A fortnight is a fairer test than a week — the trial is 14 days against 7.',
      ],
      rival: [
        'You need three people in the account on the cheapest paid plan. Instant’s Starter is a single seat and WATI’s Growth is not.',
        'You run several WhatsApp numbers from one account — Instant is one number per account.',
        'You would rather pay once than subscribe: their ₹999 Single User plan is credit, not a monthly fee.',
      ],
    },
    hue: 'sky',
  },
  {
    slug: 'instant-vs-msg91',
    rival: 'MSG91',
    source: 'https://msg91.com/in/pricing/whatsapp',
    checkedOn: '2026-09-25',
    title: 'Instant vs MSG91 — a WhatsApp CRM against a messaging API',
    metaDescription:
      'Instant and MSG91 compared on what each one actually is, what the platform fee buys, and what MSG91 publishes. Figures read from their pricing page on 25 September 2026.',
    intro:
      'These are not quite the same kind of product, and the honest comparison starts there. MSG91 is a communication API platform — WhatsApp sits alongside SMS, email and voice, and you build the interface. Instant is the finished thing: an inbox your team logs into, with AI, campaigns and a pipeline already in it.',
    rows: [
      {
        feature: 'What you are buying',
        instant: 'A ready-made CRM: shared inbox, AI agent, campaigns, pipeline',
        rival: 'A messaging API platform — WhatsApp alongside SMS, email and voice',
      },
      {
        feature: 'Platform fee',
        instant: '₹499/mo on Starter, ₹799 on Growth, ₹999 on Business',
        rival: '₹500/month, the first two months waived, plus 18% GST',
        rivalBetter: true,
      },
      {
        feature: 'Message charges',
        instant: 'Billed by Meta, to you, at Meta’s published rates',
        rival: 'Billed per their rate card; the rates are not shown on that page',
      },
      {
        feature: 'Shared inbox for a team',
        instant: 'Included — assignment, notes, roles and full contact history',
        rival: 'Not published on their WhatsApp pricing page',
      },
      {
        feature: 'AI replies',
        instant: 'Maya is part of Growth. Unlimited replies, no per-message fee',
        rival: 'Not published on their WhatsApp pricing page',
      },
      {
        feature: 'Knowing the bill before you commit',
        instant: 'Plans and what is in them are on the pricing page',
        rival: 'The page asks you to contact their team for personalised pricing',
      },
      {
        feature: 'Getting started',
        instant: '14 days free, every feature, no card',
        rival: 'Two months of the platform fee waived; trial terms not published',
      },
    ],
    verdict: {
      instant: [
        'You want software your team opens tomorrow, not an API to build against.',
        'The inbox, the AI and the pipeline should be one product with one bill.',
        'You want to see what it costs and what is included without a sales call.',
      ],
      rival: [
        'You are a developer wiring WhatsApp into your own product, and the interface is yours to build.',
        'You need SMS, email and voice on the same account as WhatsApp — Instant is WhatsApp, Instagram and Messenger only.',
        'You want the lowest possible platform fee and do not need a CRM on top of it.',
      ],
    },
    hue: 'tangerine',
  },
];

/** Look up one comparison, or undefined for an unknown slug. */
export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

/** Every comparison URL, for the sitemap and the index page. */
export function comparisonPaths(): string[] {
  return COMPARISONS.map((c) => `/compare/${c.slug}`);
}
