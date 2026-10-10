// ============================================================
// Fill in an event from the record it points at.
//
// A Workflow Rule webhook carries only the fields whoever built the
// rule remembered to add, through Zoho's merge-field picker, one at a
// time. That made the rule the hard part of this integration: forget
// the phone and nothing matches, forget the stage and the automation
// cannot branch on it, and neither failure says so.
//
// With read access the rule can carry almost nothing — an id and a
// module — and the record itself supplies the rest.
//
// ── Two rules this follows ──
//
// 1. IT NEVER BREAKS THE EVENT. Every failure here is soft: a module
//    we have no scope for, a deleted record, an expired connection, a
//    Zoho outage. The event continues with exactly what the webhook
//    carried, which is what it would have had anyway. Enrichment is
//    an improvement on the payload, never a precondition for it.
//
// 2. THE WEBHOOK WINS A CONFLICT. Both are equally fresh — Zoho fires
//    the rule at the moment of the change — but the fields in the rule
//    were chosen deliberately by whoever wrote it. So the fetch fills
//    blanks and adds what is missing; it does not overwrite.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { zohoApiFetch } from './api';
import { normalizeZohoPayload, type ZohoNormalized } from './payload';

/**
 * Modules we can fetch, and the exact API name each maps to.
 *
 * Restricted to what ZOHO_SCOPES actually grants. A Workflow Rule can
 * name any module at all — Tasks, Campaigns, a custom one — and asking
 * Zoho for those returns 403 OAUTH_SCOPE_MISMATCH, which would fill the
 * log with failures for events that are working fine.
 *
 * Keys are lowercase; the lookup lowercases before matching, because
 * what arrives is whatever the rule author typed.
 */
const FETCHABLE: Record<string, string> = {
  lead: 'Leads',
  leads: 'Leads',
  contact: 'Contacts',
  contacts: 'Contacts',
  // Zoho renamed Potentials to Deals years ago and still answers to
  // both, depending on how old the org's rule is.
  deal: 'Deals',
  deals: 'Deals',
  potential: 'Deals',
  potentials: 'Deals',
};

/** The Zoho API name for a module, or null when we should not fetch. */
export function fetchableModule(module: string | null): string | null {
  if (!module) return null;
  return FETCHABLE[module.trim().toLowerCase()] ?? null;
}

export interface ZohoEnrichResult {
  record: ZohoNormalized;
  /** True when the fetch succeeded and contributed something. */
  enriched: boolean;
  /** Why it did not, for the event log. Never surfaced as an error. */
  skipped?: 'no_record_id' | 'module_not_fetchable' | 'fetch_failed';
}

export async function enrichZohoRecord(
  db: SupabaseClient,
  accountId: string,
  record: ZohoNormalized,
): Promise<ZohoEnrichResult> {
  // Not named `module`: that is the CommonJS global, and Next lints
  // against shadowing it.
  const apiName = fetchableModule(record.module);
  if (!record.recordId) {
    return { record, enriched: false, skipped: 'no_record_id' };
  }
  if (!apiName) {
    return { record, enriched: false, skipped: 'module_not_fetchable' };
  }

  // v5 returns { data: [ { ...record } ] } even for a single id.
  const res = await zohoApiFetch<{ data?: Record<string, unknown>[] }>(
    db,
    accountId,
    `/crm/v5/${apiName}/${encodeURIComponent(record.recordId)}`,
  );

  const fetched = res.data?.data?.[0];
  if (!fetched) {
    return { record, enriched: false, skipped: 'fetch_failed' };
  }

  // Run it through the same normalizer the webhook payload goes
  // through, rather than a second field-reading path that would drift
  // from it. A Zoho record IS the shape that function was written for.
  const full = normalizeZohoPayload(fetched);

  return {
    record: {
      ...record,
      phone: record.phone ?? full.phone,
      name: record.name ?? full.name,
      email: record.email ?? full.email,
      // Fetched first so the webhook's own keys land on top — see the
      // conflict rule at the top of this file.
      vars: { ...full.vars, ...record.vars },
    },
    enriched: true,
  };
}
