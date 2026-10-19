// ============================================================
// A contact's tags, for the CRM pushes (Zoho, HubSpot) — what they are
// now, and what changed since the CRM last got them (migration 121's
// synced_tags on each link).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/** Trimmed, one of each (ignoring case), sorted — so two reads of the
 *  same tags always compare equal. */
export function normaliseTags(names: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const name = (raw ?? '').trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** The names of a contact's tags. */
export async function contactTagNames(db: SupabaseClient, contactId: string): Promise<string[]> {
  const { data } = await db.from('contact_tags').select('tags(name)').eq('contact_id', contactId);
  const names = (data ?? []).flatMap((row) => {
    const t = (row as { tags: { name: string } | { name: string }[] | null }).tags;
    return Array.isArray(t) ? t.map((x) => x.name) : t ? [t.name] : [];
  });
  return normaliseTags(names);
}

export interface TagDiff {
  add: string[];
  remove: string[];
  changed: boolean;
}

/** What to add to and remove from a CRM record, given what it got last
 *  time (null: never synced). Compared without case, so renaming "vip"
 *  to "VIP" is not a change a CRM would notice either. */
export function tagDiff(current: string[], previous: string[] | null | undefined): TagDiff {
  const prev = normaliseTags(previous ?? []);
  const now = normaliseTags(current);
  const has = (list: string[], name: string) => list.some((x) => x.toLowerCase() === name.toLowerCase());
  const add = now.filter((t) => !has(prev, t));
  const remove = prev.filter((t) => !has(now, t));
  return { add, remove, changed: add.length > 0 || remove.length > 0 };
}
