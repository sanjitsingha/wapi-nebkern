// ============================================================
// Plan catalog — DISPLAY ONLY for now.
//
// These tiers power the Settings → Plan page (cards + feature lists).
// Pricing and hard per-plan quota enforcement are deferred until
// checkout ships (docs/billing-and-trial.md §6) — the `price` fields are
// intentionally left as placeholders and the "Upgrade" CTA is a stub.
// Finalize the numbers before wiring a payment provider.
// ============================================================

/**
 * Money from MINOR units (paise/cents) to a localized string, e.g.
 * (99900, 'INR') → "₹999.00". Falls back to a plain number if the
 * currency code isn't recognized. Shared by the settings Plan tab.
 */
export function formatMoney(amountMinor: number, currency = 'INR'): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/**
 * A priced plan from the admin-managed `billing_plans` table (migration
 * 054). Distinct from {@link PlanTier} above, which is the static
 * marketing/feature catalog — this carries the live, editable pricing.
 * `amount` is in MINOR units (paise/cents).
 */
export interface BillingPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  isActive: boolean;
  sortOrder: number;
  tagline: string | null;
  features: string[];
  isFeatured: boolean;
}

/** Columns to select from billing_plans, shared by the pages that map it. */
export const BILLING_PLAN_COLUMNS =
  'id, key, name, description, amount, currency, interval, is_active, sort_order, tagline, features, is_featured';

/** The snake_case DB row → BillingPlan. */
export function mapBillingPlanRow(p: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  is_active: boolean;
  sort_order: number;
  tagline: string | null;
  features: unknown;
  is_featured: boolean;
}): BillingPlan {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    amount: p.amount,
    currency: p.currency,
    interval: p.interval,
    isActive: p.is_active,
    sortOrder: p.sort_order,
    tagline: p.tagline,
    features: Array.isArray(p.features)
      ? (p.features.filter((f) => typeof f === 'string') as string[])
      : [],
    isFeatured: p.is_featured,
  };
}

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
