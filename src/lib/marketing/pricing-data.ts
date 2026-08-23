// ============================================================
// Pricing page data — the single source of truth for /pricing.
//
// This is DISPLAY data for the public marketing page (Instant by
// Nebkern). The *sellable* plans — what checkout, onboarding and the
// paywall actually charge — live in the `billing_plans` DB table
// (migration 054 + the reseed in 088). The two must be kept in step by
// hand: change a price here, change it in the migration too.
//
// Meta billing model = PASS-THROUGH. Meta charges the customer's own
// WhatsApp Business Account directly; Instant never touches those
// charges, so "0% markup" here means "we add nothing on top of Meta",
// NOT "we resell Meta minutes at cost through a wallet". There is no
// wallet. Keep every line on this page consistent with that.
// ============================================================

export type CtaVariant = 'primary' | 'secondary';

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  /** Monthly price in rupees (major units). */
  monthlyPrice: number;
  /** Yearly price in rupees (major units). */
  yearlyPrice: number;
  yearlyDiscountPct?: number;
  yearlySavings?: number;
  yearlyEffectiveMonthly?: number;
  ctaLabel: string;
  ctaVariant: CtaVariant;
  /** Where the CTA points — self-serve plans go to /signup. */
  ctaHref: string;
  isPopular: boolean;
  popularBadgeText?: string;
  limits: {
    users: number | string;
    whatsappNumbers: number | string;
    contacts: number | string;
    mayaAi: boolean;
    mayaReplies?: string | null;
    mayaKbSourceLimit?: string;
  };
  features: string[];
  /** Only Starter shows a "not included" fine-print block. */
  notIncluded?: string[];
}

export const PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For solo founders and small clinics testing WhatsApp API',
    monthlyPrice: 499,
    yearlyPrice: 5090,
    yearlyDiscountPct: 15,
    yearlySavings: 898,
    yearlyEffectiveMonthly: 424,
    ctaLabel: 'Start 14-day free trial',
    ctaVariant: 'secondary',
    ctaHref: '/signup',
    isPopular: false,
    limits: {
      users: 1,
      whatsappNumbers: 1,
      contacts: 2000,
      mayaAi: false,
      mayaReplies: null,
    },
    features: [
      '1 user account',
      '1 WhatsApp Business number',
      'Up to 2,000 contacts',
      'Live team inbox',
      'Broadcast campaigns (up to 5,000 messages/campaign)',
      'Template message manager',
      'Basic no-code workflow builder',
      'Webhooks & REST API access',
      'Contact tagging & segmentation',
      'Email support',
    ],
    notIncluded: [
      'Maya AI agent',
      'Meta Ads / Click-to-WhatsApp integration',
      'Shopify / CRM connectors',
      'Advanced analytics',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'For growing D2C brands, clinics, and agencies',
    monthlyPrice: 799,
    yearlyPrice: 7190,
    yearlyDiscountPct: 25,
    yearlySavings: 2398,
    yearlyEffectiveMonthly: 599,
    ctaLabel: 'Start 14-day free trial',
    ctaVariant: 'primary',
    ctaHref: '/signup',
    isPopular: true,
    popularBadgeText: 'Most Popular',
    limits: {
      users: 2,
      whatsappNumbers: 2,
      contacts: 5000,
      mayaAi: true,
      mayaReplies: 'Unlimited*',
      mayaKbSourceLimit: 'Up to 10 documents / 50,000 words of pasted text',
    },
    features: [
      'Everything in Starter, plus:',
      '2 user accounts',
      '2 WhatsApp Business numbers',
      'Up to 5,000 contacts',
      'Maya AI agent — trained only on your uploaded documents & pasted content (up to 10 documents)',
      'Unlimited AI replies*',
      'Advanced workflow & automation builder',
      'Meta Ads (Click-to-WhatsApp) integration',
      'Shopify, WooCommerce & CRM connectors',
      'WhatsApp Flows',
      'Analytics dashboard',
      'Priority email + chat support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For established brands and hospitals scaling operations',
    monthlyPrice: 999,
    yearlyPrice: 7790,
    yearlyDiscountPct: 35,
    yearlySavings: 4198,
    yearlyEffectiveMonthly: 649,
    ctaLabel: 'Start 14-day free trial',
    ctaVariant: 'secondary',
    ctaHref: '/signup',
    isPopular: false,
    limits: {
      users: 5,
      whatsappNumbers: 5,
      contacts: 10000,
      mayaAi: true,
      mayaReplies: 'Unlimited*',
      mayaKbSourceLimit: 'Unlimited documents + auto-sync from website/URLs',
    },
    features: [
      'Everything in Growth, plus:',
      '5 user accounts',
      '5 WhatsApp Business numbers',
      'Up to 10,000 contacts',
      'Maya AI agent — unlimited documents, auto-sync from your website & URLs, multi-language responses',
      'Roles & granular permissions',
      'Custom reports & data exports',
      'Dedicated Customer Success Manager',
      'Priority phone + WhatsApp support',
      'SLA-backed uptime',
    ],
  },
];

// ---- Meta message pricing (pass-through, 0% markup) ------------
export interface MetaRate {
  type: string;
  metaCharge: string;
  markup: string;
}

export const META_PRICING = {
  intro:
    'Every WhatsApp message goes through Meta. Instant charges you exactly what Meta charges — not a paisa more. Compare this to Wati (20% markup), Interakt (25% markup), and AiSensy (~40% effective markup on marketing messages).',
  rates: [
    { type: 'Marketing', metaCharge: '₹0.78 per message', markup: '0%' },
    { type: 'Utility', metaCharge: '₹0.115 per message', markup: '0%' },
    { type: 'Authentication', metaCharge: '₹0.115 per message', markup: '0%' },
    {
      type: 'Service (customer-initiated replies within 24hr window)',
      metaCharge: 'FREE',
      markup: '0%',
    },
  ] as MetaRate[],
  footnote:
    'Meta rates as per official WhatsApp Business API pricing for India, effective January 2026. Rates set by Meta, not Instant — we simply pass them through.',
};

// ---- How Maya works -------------------------------------------
export const MAYA = {
  columns: [
    {
      icon: '📄',
      title: 'Upload anything',
      body: 'PDFs, Word docs, spreadsheets, or just pasted text. Maya reads it all.',
    },
    {
      icon: '🎯',
      title: 'Answers only from your content',
      body: 'No hallucinations. No made-up info. Maya only answers from what you provide.',
    },
    {
      icon: '🤝',
      title: 'Hands off when unsure',
      body: "If Maya doesn't know, she doesn't guess — she connects the customer to your team.",
    },
  ],
  knowledgeByPlan: [
    { plan: 'Starter', source: 'Not included' },
    { plan: 'Growth', source: 'Up to 10 documents / 50,000 words of pasted content' },
    {
      plan: 'Business',
      source: 'Unlimited documents + auto-sync from your website & URLs',
    },
  ],
};

// ---- Add-ons ---------------------------------------------------
export interface Addon {
  id: string;
  label: string;
  price: number;
  unit: string;
}

export const ADDONS: Addon[] = [
  { id: 'extra_number', label: 'Extra WhatsApp Business number', price: 399, unit: '/mo' },
  { id: 'extra_user', label: 'Extra user (beyond plan limit)', price: 149, unit: '/user/mo' },
  { id: 'extra_contacts', label: 'Extra 1,000 contacts', price: 199, unit: '/mo' },
  {
    id: 'onboarding',
    label: 'Guided onboarding + template approval assistance',
    price: 2999,
    unit: 'one-time',
  },
];

// ---- Competitor comparison ------------------------------------
export interface CompetitorRow {
  provider: string;
  platformFee: string;
  aiIncluded: string;
  metaCharges: string;
  total: number;
  save: string;
  highlight?: boolean;
}

export const COMPETITOR_COMPARISON = {
  scenario: '10,000 marketing + 5,000 utility messages/month',
  rows: [
    {
      provider: 'Wati Business',
      platformFee: '₹16,999',
      aiIncluded: 'Yes',
      metaCharges: '₹10,050 (+20% markup)',
      total: 27049,
      save: '₹17,875',
    },
    {
      provider: 'AiSensy Pro + chatbot add-on',
      platformFee: '₹3,200 + ₹2,500',
      aiIncluded: 'Add-on ₹2,500/mo extra',
      metaCharges: '₹11,625 (~40% markup)',
      total: 17325,
      save: '₹8,151',
    },
    {
      provider: 'Interakt Growth',
      platformFee: '₹2,566',
      aiIncluded: 'Basic only',
      metaCharges: '₹10,469 (+25% markup)',
      total: 13035,
      save: '₹3,861',
    },
    {
      provider: 'Instant Growth',
      platformFee: '₹799',
      aiIncluded: 'Unlimited Maya AI',
      metaCharges: '₹8,375 (0% markup)',
      total: 9174,
      save: '—',
      highlight: true,
    },
  ] as CompetitorRow[],
  footnote:
    'Prices verified from competitor websites as of August 2026. Numbers assume monthly billing for all providers.',
};

// ---- Fair-use policy ------------------------------------------
export const FAIR_USE = {
  title: 'Fair-use policy for Maya AI',
  body: "Unlimited Maya replies are subject to fair-use limits designed to prevent abuse. Fair use covers normal business conversations — approximately 10,000 AI-generated replies per WhatsApp number per month. Beyond this volume, we'll reach out to help you move to a plan that fits your scale. 99% of customers will never hit this limit.",
};

// ---- FAQ ------------------------------------------------------
// Q2 is deliberately rewritten from the source spec: there is NO
// prepaid wallet. Meta bills the customer's own WABA directly.
export interface Faq {
  id: string;
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    id: 'zero_markup',
    q: 'What is "zero markup on Meta"?',
    a: 'Every WhatsApp message you send is charged by Meta directly (₹0.78 for marketing, ₹0.115 for utility/auth). Most platforms add a 20–40% markup on top. Instant charges you exactly what Meta charges — not a paisa more.',
  },
  {
    id: 'meta_billing',
    q: 'Do I pay Meta charges to Instant, or to Meta?',
    a: "Straight to Meta. Your message charges are billed by Meta to your own WhatsApp Business Account, at Meta's published rates — they never pass through Instant, so there is nothing for us to mark up or take a cut of. You pay Instant only the flat plan fee.",
  },
  {
    id: 'what_is_maya',
    q: 'What is Maya?',
    a: "Maya is Instant's built-in AI agent that replies to your customers on WhatsApp on your behalf — 24×7, in natural language, in multiple Indian languages. Maya is included in Growth and Business plans at no extra cost.",
  },
  {
    id: 'maya_knowledge',
    q: 'What does Maya know? Where does she get her answers?',
    a: "Maya only answers from information you provide — nothing else. You upload documents (PDFs, Word files, spreadsheets) or paste in text (product info, FAQs, hospital services, appointment rules, pricing, etc.), and Maya uses only that content to reply. She will never make up answers or pull from general internet knowledge. If a customer asks something outside your provided content, Maya says she doesn't know and offers to hand off to a human agent. Growth: up to 10 documents or 50,000 words of pasted text. Business: unlimited documents + auto-sync from your website and URLs.",
  },
  {
    id: 'switch_plans',
    q: 'Can I switch plans anytime?',
    a: 'Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the start of your next billing cycle.',
  },
  {
    id: 'contact_limit',
    q: 'What happens if I exceed my contact limit?',
    a: "You can either add extra contacts (₹199 per 1,000/mo) or upgrade to the next plan. We'll notify you at 80% usage — no service interruption.",
  },
  {
    id: 'free_trial',
    q: 'Do you offer a free trial?',
    a: "Yes. 14-day free trial on Starter and Growth plans, no credit card required. You'll need to complete WhatsApp Business verification during trial to send real messages.",
  },
  {
    id: 'vs_competitors',
    q: 'How is Instant different from Wati, AiSensy, or Interakt?',
    a: 'Three ways: (1) Zero markup on Meta charges. (2) Maya AI included at no extra cost in Growth+. (3) Simpler, lower platform fees. See the comparison table above for exact numbers.',
  },
  {
    id: 'integrations',
    q: 'What integrations do you support?',
    a: 'Shopify, WooCommerce, Zoho CRM, HubSpot, Salesforce, Google Sheets, Zapier, Make, custom REST API and webhooks. Growth plan and above.',
  },
  {
    id: 'data_storage',
    q: 'Where is my data stored?',
    a: 'India (Mumbai region), on ISO 27001 certified infrastructure.',
  },
];

/** Format a rupee figure with Indian digit grouping, no decimals. */
export function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
