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
  /** Raw limits jsonb (migration 062) — parse with parsePlanLimits(). */
  limits: Record<string, unknown>;
}

/** Columns to select from billing_plans, shared by the pages that map it. */
export const BILLING_PLAN_COLUMNS =
  'id, key, name, description, amount, currency, interval, is_active, sort_order, tagline, features, is_featured, limits';

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
  limits?: unknown;
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
    limits:
      p.limits && typeof p.limits === 'object' && !Array.isArray(p.limits)
        ? (p.limits as Record<string, unknown>)
        : {},
  };
}

export interface PlanTier {
  id: 'starter' | 'growth' | 'business';
  name: string;
  tagline: string;
  priceLabel: string;
  /** Visually highlight this tier as the recommended default. */
  featured?: boolean;
  features: string[];
}

// Mirrors the Instant pricing book (src/lib/marketing/pricing-data.ts +
// migration 088). The live, sellable numbers come from the billing_plans
// DB table; this static catalog is a lightweight display fallback.
export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For solo founders and small clinics',
    priceLabel: '₹499/mo',
    features: [
      '1 user · 1 WhatsApp number',
      'Shared team inbox',
      'Up to 2,000 contacts',
      'Broadcast campaigns',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'For growing D2C brands and clinics',
    priceLabel: '₹799/mo',
    featured: true,
    features: [
      'Everything in Starter',
      'Maya AI agent — unlimited replies',
      'Automations & WhatsApp Flows',
      'Meta Ads + Shopify/CRM connectors',
      'Up to 5,000 contacts',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For established brands scaling up',
    priceLabel: '₹999/mo',
    features: [
      'Everything in Growth',
      'Up to 10,000 contacts',
      'Roles & granular permissions',
      'Dedicated CSM · SLA-backed uptime',
    ],
  },
];
