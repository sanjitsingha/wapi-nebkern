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
  /**
   * Height class for that mark. The lockups have different
   * proportions — Interakt is about 3:1, WATI 2.9:1 — so one shared
   * height draws them at visibly different widths. Sizing each to land
   * near the same *width* is what reads as balanced beside ours.
   */
  rivalLogoClass?: string;
  /**
   * Card art for the /compare index — the two lockups side by side.
   * Optional: a comparison without one shows the heading alone, so a
   * new rival never waits on a designer.
   */
  cover?: { src: string; width: number; height: number };
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
    cover: { src: '/images/compare/vs-interakt.png', width: 800, height: 400 },
    rivalLogo: {
      src: '/images/compare/interakt.png',
      width: 3750,
      height: 1249,
    },
    rivalLogoClass: 'h-11 w-auto',
    source: 'https://www.interakt.shop/pricing/',
    checkedOn: '2026-09-25',
    title: 'Instant vs Interakt — pricing, AI and channels compared',
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
    cover: { src: '/images/compare/vs-wati.jpg', width: 800, height: 400 },
    rivalLogo: { src: '/images/compare/wati.svg', width: 1440, height: 490 },
    rivalLogoClass: 'h-10 w-auto',
    source: 'https://www.wati.io/pricing/',
    checkedOn: '2026-09-25',
    title: 'Instant vs WATI — seats, AI and trials compared',
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
    slug: 'instant-vs-aisensy',
    rival: 'AiSensy',
    cover: { src: '/images/compare/vs-aisensy.png', width: 800, height: 400 },
    rivalLogo: { src: '/images/compare/aisensy.webp', width: 904, height: 253 },
    rivalLogoClass: 'h-9 w-auto',
    source: 'https://aisensy.com/pricing/',
    checkedOn: '2026-09-27',
    title: 'Instant vs AiSensy — pricing and AI compared',
    metaDescription:
      'Instant and AiSensy side by side on what each publishes, what the AI costs, and who each one suits. AiSensy figures read from their own pricing page on 27 September 2026.',
    intro:
      'Both run on the official WhatsApp Business API, so Meta’s per-conversation charges are identical either way. The difference is what you can work out before you sign up: AiSensy publishes its add-ons and a free tier but not its paid plan prices, and its AI is billed separately from the platform.',
    rows: [
      {
        feature: 'Paid plan prices',
        instant: '₹499, ₹799 and ₹999 a month, on the pricing page',
        rival: 'Not published on their pricing page — it asks you to compare plans',
      },
      {
        feature: 'A free tier',
        instant: 'None — a 14-day trial, then a plan',
        rival: 'A Free Forever plan, under their fair-use policy',
        rivalBetter: true,
      },
      {
        feature: 'AI replies',
        instant: 'Maya is part of Growth at ₹799/mo. Unlimited replies',
        rival: 'AI Agent Builder ₹1,350/mo for 1,000 AI messages, on top of the plan',
      },
      {
        feature: 'Chatbot building',
        instant: 'Flows and automations included on Growth',
        rival: 'Drag-and-drop builder ₹2,500/mo for 5 chatbots, or ₹2,250 billed annually',
      },
      {
        feature: 'Team members',
        instant: 'Starter is a single user; Growth and Business add the team',
        rival: 'Unlimited users',
        rivalBetter: true,
      },
      {
        feature: 'Channels in one inbox',
        instant: 'WhatsApp, Instagram and Messenger',
        rival: 'WhatsApp',
      },
      {
        feature: 'Meta’s conversation charges',
        instant: 'Billed by Meta, to you, at Meta’s rates',
        rival: 'Meta’s own rates; conversation credits recharged separately, pre-paid',
        rivalBetter: true,
      },
      {
        feature: 'An Indian number',
        instant: 'Use the number you already have',
        rival: 'Virtual number add-on: ₹2,000 + GST a year, or ₹299 a quarter',
      },
    ],
    verdict: {
      instant: [
        'You want AI answering from day one without a second subscription and a message meter — ₹799 all in, against a plan price plus ₹1,350 for a thousand AI messages.',
        'You answer on Instagram and Messenger as well as WhatsApp.',
        'You would rather read the price than request it.',
        'You want the pipeline, the inbox and the AI to be one product with one bill.',
      ],
      rival: [
        'You want to start on a free plan and stay there — Instant has a trial, not a free tier.',
        'You need many people in the account from the outset; their users are unlimited and Instant’s Starter is a single seat.',
        'You prefer pre-paid conversation credits to charges landing on a card.',
      ],
    },
    hue: 'mint',
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
