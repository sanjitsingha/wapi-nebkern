// ============================================================
// Client-side entitlement pre-checks.
//
// Some create paths write straight to Supabase from the browser
// (contact form, CSV import, media uploads), so there's no API route to
// enforce plan limits on. These helpers ask /api/account/entitlements
// and return a user-facing error message when the action would exceed
// the plan — or null to proceed.
//
// SOFT-FAIL: any fetch/parse problem returns null (allow). The server
// routes remain the authoritative gates where they exist; blocking a
// paying user on a transient error would be worse than letting an edge
// case through.
// ============================================================

import type { PlanEntitlements } from './entitlements';

export interface EntitlementsSnapshot {
  entitlements: PlanEntitlements;
  usage: {
    contacts: number;
    users: number;
    storageBytes: number;
    campaigns: number;
    automations: number;
    flows: number;
  };
}

export async function fetchEntitlements(): Promise<EntitlementsSnapshot | null> {
  try {
    const res = await fetch('/api/account/entitlements');
    if (!res.ok) return null;
    const data = (await res.json()) as EntitlementsSnapshot;
    if (!data?.entitlements || !data?.usage) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Would adding `adding` contacts exceed the plan? Returns the message to
 * show, or null to proceed.
 */
export async function checkContactCapacity(
  adding: number,
): Promise<string | null> {
  const snap = await fetchEntitlements();
  if (!snap) return null;
  const limit = snap.entitlements.maxContacts;
  if (limit === null) return null;
  const after = snap.usage.contacts + Math.max(1, adding);
  if (after <= limit) return null;
  const room = Math.max(0, limit - snap.usage.contacts);
  return adding > 1
    ? `Your plan allows ${limit.toLocaleString()} contacts — you have ${snap.usage.contacts.toLocaleString()} and room for ${room.toLocaleString()} more. Reduce the import or upgrade your plan.`
    : `You've reached your plan's contact limit (${limit.toLocaleString()}). Upgrade to add more.`;
}

/**
 * Would creating one more campaign exceed the plan? Returns the message
 * to show, or null to proceed.
 *
 * Campaigns are inserted straight from the browser (campaigns/new writes
 * to `broadcasts` via the Supabase client), so unlike automations and
 * flows there is no API route to enforce this authoritatively. This is a
 * UX guard, not a security boundary — same caveat as the contact and
 * storage checks above.
 */
export async function checkCampaignCapacity(): Promise<string | null> {
  const snap = await fetchEntitlements();
  if (!snap) return null;
  const limit = snap.entitlements.maxCampaigns;
  if (limit === null) return null;
  if (snap.usage.campaigns < limit) return null;
  return `You've reached your plan's campaign limit (${limit.toLocaleString()}). Delete an old campaign or upgrade your plan.`;
}

/**
 * Would uploading `addingBytes` exceed the plan's storage? Returns the
 * message to show, or null to proceed.
 */
export async function checkStorageCapacity(
  addingBytes: number,
): Promise<string | null> {
  const snap = await fetchEntitlements();
  if (!snap) return null;
  const limitMb = snap.entitlements.storageMb;
  if (limitMb === null) return null;
  const limitBytes = limitMb * 1024 * 1024;
  if (snap.usage.storageBytes + addingBytes <= limitBytes) return null;
  const usedMb = Math.round(snap.usage.storageBytes / (1024 * 1024));
  return `This upload would exceed your plan's ${limitMb.toLocaleString()} MB storage limit (${usedMb.toLocaleString()} MB used). Free up media or upgrade your plan.`;
}
