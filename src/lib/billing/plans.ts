// ============================================================
// Plan catalog — DISPLAY ONLY for now.
//
// These tiers power the Settings → Plan page (cards + feature lists).
// Pricing and hard per-plan quota enforcement are deferred until
// checkout ships (docs/billing-and-trial.md §6) — the `price` fields are
// intentionally left as placeholders and the "Upgrade" CTA is a stub.
// Finalize the numbers before wiring a payment provider.
// ============================================================

export interface PlanTier {
  id: 'starter' | 'pro' | 'business';
  name: string;
  tagline: string;
  /** Placeholder — set real pricing when checkout is built. */
  priceLabel: string;
  /** Visually highlight this tier as the recommended default. */
  featured?: boolean;
  features: string[];
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For getting started on WhatsApp',
    priceLabel: 'Pricing coming soon',
    features: [
      '1 WhatsApp number',
      'Shared team inbox',
      'Up to 1,000 contacts',
      'Broadcast campaigns',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For growing teams',
    priceLabel: 'Pricing coming soon',
    featured: true,
    features: [
      'Everything in Starter',
      'AI auto-reply',
      'Automations & flows',
      'Instagram DMs',
      'Up to 25,000 contacts',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For scale',
    priceLabel: 'Pricing coming soon',
    features: [
      'Everything in Pro',
      'Unlimited contacts',
      'Priority support',
      'Advanced analytics',
    ],
  },
];
