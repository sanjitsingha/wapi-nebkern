// ============================================================
// Plan entitlements — per-plan limits & feature gates.
//
// SOURCE OF TRUTH IS CODE. Enforcement reads the hardcoded PLAN_ENTITLEMENTS
// catalog below, keyed by the account's billing_plan_key — never the
// billing_plans.limits column. That is deliberate and is the security
// posture the product wants: a DB edit, a mistaken admin toggle, or a
// tampered row cannot widen what a plan is allowed to do. Prices and names
// still live in billing_plans (and stay editable in admin); only the
// limits/gates are frozen in the repo.
//
// Resolution:
//   • No billing_plan_key at all (trial / grandfathered) → UNLIMITED.
//     These accounts never bought a plan and keep full access, as before.
//   • A key in the catalog → that plan's entitlements.
//   • A key we DON'T recognize (bug / bad data / tampering) → the
//     locked-down MINIMAL default. Fails SAFE, not open.
//   • A transient DB read error → UNLIMITED (a billing hiccup must never
//     lock a paying tenant out of their own data).
//
// Adding a new sellable plan therefore means adding it to PLAN_ENTITLEMENTS
// here, not just to the DB — by design.
//
// parsePlanLimits / sanitizeLimitsInput below are retained only for the
// admin API's validation and older callers; they no longer drive
// enforcement.
//
// Server routes gate with:
//
//   const ent = await getAccountEntitlements(supabase, accountId);
//   if (!ent.allowFlows) return featureBlockedResponse('Flows');
//
// Limit checks pair the entitlement with a live usage count:
//
//   if (atLimit(ent.maxContacts, contactCount))
//     return limitReachedResponse('contacts', ent.maxContacts);
//
// Numeric keys in the `limits` jsonb (all null / absent = unlimited):
//   max_users, max_contacts, storage_mb,
//   max_automations, max_campaigns, max_flows
// Boolean keys (all absent = allowed):
//   allow_calling, allow_instagram, allow_automations, allow_flows,
//   allow_integrations
//
// The three max_* counts above were added after migration 062 and need
// no migration of their own: `limits` is a jsonb that already accepts
// arbitrary keys, and an absent key reads as unlimited. That is
// deliberate — backfilling them would retroactively cap plans that
// customers are already on.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlanEntitlements {
  /** Team members incl. the owner. null = unlimited. */
  maxUsers: number | null;
  /** Contacts in the CRM. null = unlimited. */
  maxContacts: number | null;
  /** Media storage across account buckets, in MB. null = unlimited. */
  storageMb: number | null;
  /** Automations the account may have. null = unlimited. */
  maxAutomations: number | null;
  /** Campaigns (broadcasts) the account may create. null = unlimited. */
  maxCampaigns: number | null;
  /** Flows the account may have. null = unlimited. */
  maxFlows: number | null;
  allowCalling: boolean;
  allowInstagram: boolean;
  allowAutomations: boolean;
  allowFlows: boolean;
  allowIntegrations: boolean;
}

/** The fail-open default: everything allowed, nothing capped. Used for
 *  trial / grandfathered accounts (no plan key) and transient read errors. */
export const UNLIMITED_ENTITLEMENTS: PlanEntitlements = {
  maxUsers: null,
  maxContacts: null,
  storageMb: null,
  maxAutomations: null,
  maxCampaigns: null,
  maxFlows: null,
  allowCalling: true,
  allowInstagram: true,
  allowAutomations: true,
  allowFlows: true,
  allowIntegrations: true,
};

/**
 * Locked-down default for a plan key we don't recognize (a bug, bad data,
 * or tampering). Real trial/grandfathered accounts have NO key and get
 * UNLIMITED instead — this only catches unknown keys, so enforcement fails
 * SAFE rather than open. Everything off; no new records may be created.
 */
export const MINIMAL_ENTITLEMENTS: PlanEntitlements = {
  maxUsers: 1,
  maxContacts: 0,
  storageMb: 0,
  maxAutomations: 0,
  maxCampaigns: 0,
  maxFlows: 0,
  allowCalling: false,
  allowInstagram: false,
  allowAutomations: false,
  allowFlows: false,
  allowIntegrations: false,
};

/**
 * The hardcoded plan → entitlements catalog. THE source of truth for
 * enforcement. Mirrors the plan book (src/lib/marketing/pricing-data.ts and
 * migration 088's seed) — keep the three in step. `null` = unlimited.
 */
export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlements> = {
  starter: {
    maxUsers: 1,
    maxContacts: 2000,
    storageMb: null,
    maxAutomations: null,
    maxCampaigns: null,
    maxFlows: null,
    allowCalling: false,
    allowInstagram: false,
    allowAutomations: true,
    allowFlows: false,
    allowIntegrations: false,
  },
  growth: {
    maxUsers: 2,
    maxContacts: 5000,
    storageMb: null,
    maxAutomations: null,
    maxCampaigns: null,
    maxFlows: null,
    allowCalling: true,
    allowInstagram: true,
    allowAutomations: true,
    allowFlows: true,
    allowIntegrations: true,
  },
  business: {
    maxUsers: 5,
    maxContacts: 10000,
    storageMb: null,
    maxAutomations: null,
    maxCampaigns: null,
    maxFlows: null,
    allowCalling: true,
    allowInstagram: true,
    allowAutomations: true,
    allowFlows: true,
    allowIntegrations: true,
  },
};

/**
 * Resolve a raw billing_plan_key to its catalog entitlements, or null when
 * the key is unknown. Normalizes the '_yearly' suffix (yearly billing, same
 * limits) and maps the retired 'pro' tier onto 'business' so legacy payers
 * are never downgraded.
 */
export function entitlementsForPlanKey(
  planKey: string | null | undefined,
): PlanEntitlements | null {
  if (!planKey) return null;
  let key = planKey.toLowerCase().trim();
  if (key.endsWith('_yearly')) key = key.slice(0, -'_yearly'.length);
  if (key === 'pro') key = 'business'; // retired tier → nearest current
  return PLAN_ENTITLEMENTS[key] ?? null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
    ? Math.floor(v)
    : null;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Parse a billing_plans.limits jsonb into typed entitlements. */
export function parsePlanLimits(raw: unknown): PlanEntitlements {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return UNLIMITED_ENTITLEMENTS;
  }
  const o = raw as Record<string, unknown>;
  return {
    maxUsers: num(o.max_users),
    maxContacts: num(o.max_contacts),
    storageMb: num(o.storage_mb),
    // Absent key ⇒ unlimited, so plans created before these existed are
    // uncapped rather than retroactively restricted. No migration
    // backfills them; the admin opts in per plan.
    maxAutomations: num(o.max_automations),
    maxCampaigns: num(o.max_campaigns),
    maxFlows: num(o.max_flows),
    allowCalling: bool(o.allow_calling, true),
    allowInstagram: bool(o.allow_instagram, true),
    allowAutomations: bool(o.allow_automations, true),
    allowFlows: bool(o.allow_flows, true),
    allowIntegrations: bool(o.allow_integrations, true),
  };
}

/** True when a finite limit exists and current usage has reached it. */
export function atLimit(limit: number | null, current: number): boolean {
  return limit !== null && current >= limit;
}

const LIMIT_NUM_KEYS = [
  'max_users',
  'max_contacts',
  'storage_mb',
  'max_automations',
  'max_campaigns',
  'max_flows',
] as const;
const LIMIT_BOOL_KEYS = [
  'allow_calling',
  'allow_instagram',
  'allow_automations',
  'allow_flows',
  'allow_integrations',
] as const;

/**
 * Validate an admin-supplied limits payload into a clean jsonb object.
 * Numbers must be non-negative integers (null/'' ⇒ unlimited); toggles
 * must be booleans. Unknown keys are dropped. Returns null when the
 * payload is malformed (caller responds 400).
 */
export function sanitizeLimitsInput(
  raw: unknown,
): Record<string, unknown> | null {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of LIMIT_NUM_KEYS) {
    if (!(key in o)) continue;
    const v = o[key];
    if (v === null || v === '') {
      out[key] = null;
    } else if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
      out[key] = v;
    } else {
      return null;
    }
  }
  for (const key of LIMIT_BOOL_KEYS) {
    if (!(key in o)) continue;
    if (typeof o[key] !== 'boolean') return null;
    out[key] = o[key];
  }
  return out;
}

/**
 * Resolve the entitlements for an account from the hardcoded catalog:
 * accounts.billing_plan_key → PLAN_ENTITLEMENTS (never the DB limits
 * column). Works with either the RLS-scoped session client or the
 * service-role client — it only reads the account's own plan key.
 *
 *   • no key (trial / grandfathered) → UNLIMITED
 *   • known key                      → that plan's entitlements
 *   • unknown key                    → MINIMAL (fails safe)
 *   • read error                     → UNLIMITED (never lock out a payer)
 */
export async function getAccountEntitlements(
  db: SupabaseClient,
  accountId: string,
): Promise<PlanEntitlements> {
  try {
    const { data: account } = await db
      .from('accounts')
      .select('billing_plan_key')
      .eq('id', accountId)
      .maybeSingle();
    const planKey = account?.billing_plan_key as string | null | undefined;
    if (!planKey) return UNLIMITED_ENTITLEMENTS;
    return entitlementsForPlanKey(planKey) ?? MINIMAL_ENTITLEMENTS;
  } catch {
    return UNLIMITED_ENTITLEMENTS;
  }
}

/** 403 for a feature the current plan doesn't include. */
export function featureBlockedResponse(feature: string): NextResponse {
  return NextResponse.json(
    {
      error: `${feature} is not included in your current plan. Upgrade to enable it.`,
      code: 'plan_restricted',
    },
    { status: 403 },
  );
}

/** 403 for a numeric limit the account has hit. */
export function limitReachedResponse(
  what: string,
  limit: number | null,
): NextResponse {
  const cap = limit === null ? '' : ` (${limit.toLocaleString()})`;
  return NextResponse.json(
    {
      error: `You've reached your plan's ${what} limit${cap}. Upgrade to add more.`,
      code: 'plan_limit',
    },
    { status: 403 },
  );
}
