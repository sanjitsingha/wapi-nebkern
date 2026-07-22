// ============================================================
// Plan entitlements — per-plan limits & feature gates (migration 062).
//
// The admin sets a `limits` jsonb on each billing_plans row; an account
// inherits the limits of its accounts.billing_plan_key. Missing key /
// null value ⇒ unlimited / allowed, and an account with NO plan key at
// all (trial, grandfathered) is unconstrained — the whole module fails
// OPEN, mirroring computeSubscription()'s philosophy: a billing hiccup
// must never lock a paying tenant out of their data.
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

/** The fail-open default: everything allowed, nothing capped. */
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
 * Resolve the entitlements for an account: accounts.billing_plan_key →
 * billing_plans.limits. Works with either the RLS-scoped session client
 * (members can read their own account row + active plans) or the
 * service-role client. Any miss — no plan key, unknown key, read error —
 * fails open to UNLIMITED_ENTITLEMENTS.
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

    const { data: plan } = await db
      .from('billing_plans')
      .select('limits')
      .eq('key', planKey)
      .maybeSingle();
    if (!plan) return UNLIMITED_ENTITLEMENTS;

    return parsePlanLimits(plan.limits);
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
