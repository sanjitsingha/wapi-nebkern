// Supabase wrappers for the Segments module. Thin, typed calls over the
// migration-043 tables + RPCs. RLS scopes everything to the caller's
// account; the RPCs additionally take an explicit account id (the
// evaluation is a dynamic query that needs it in the WHERE).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact, Segment, SegmentGroup } from '@/types';

type DB = SupabaseClient;

export type SegmentSort = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc';

export interface SegmentContactsPage {
  contacts: Contact[];
  total: number;
}

// ── Segment CRUD ─────────────────────────────────────────────────────

export async function loadSegments(db: DB): Promise<Segment[]> {
  const { data, error } = await db
    .from('segments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Segment[];
}

export async function loadSegment(db: DB, id: string): Promise<Segment | null> {
  const { data, error } = await db
    .from('segments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Segment) ?? null;
}

export async function createSegment(
  db: DB,
  input: {
    accountId: string;
    name: string;
    description?: string | null;
    color?: string | null;
    rules: SegmentGroup;
  },
): Promise<Segment> {
  const { data, error } = await db
    .from('segments')
    .insert({
      account_id: input.accountId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      rules: input.rules,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Segment;
}

export async function updateSegment(
  db: DB,
  id: string,
  patch: Partial<Pick<Segment, 'name' | 'description' | 'color' | 'status' | 'rules'>>,
): Promise<Segment> {
  const { data, error } = await db
    .from('segments')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Segment;
}

export async function duplicateSegment(
  db: DB,
  source: Segment,
  newName: string,
): Promise<Segment> {
  // No membership to copy — a segment is just its rules, so duplication
  // is a plain insert of the same tree (always starts active).
  return createSegment(db, {
    accountId: source.account_id,
    name: newName,
    description: source.description,
    color: source.color,
    rules: source.rules,
  });
}

export async function deleteSegment(db: DB, id: string): Promise<void> {
  const { error } = await db.from('segments').delete().eq('id', id);
  if (error) throw error;
}

// ── Evaluation (dynamic) ─────────────────────────────────────────────

/** Live count of contacts matching a rule tree — used as the builder types. */
export async function countSegment(
  db: DB,
  accountId: string,
  rules: SegmentGroup,
): Promise<number> {
  const { data, error } = await db.rpc('segment_count', {
    p_account_id: accountId,
    p_rules: rules,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Persist the freshly-computed estimate back onto the segment row. */
export async function refreshSegmentCount(
  db: DB,
  segment: Segment,
): Promise<number> {
  const count = await countSegment(db, segment.account_id, segment.rules);
  await db
    .from('segments')
    .update({ estimated_count: count, count_computed_at: new Date().toISOString() })
    .eq('id', segment.id);
  return count;
}

/** Paginated preview of matching contacts (also the campaign-send source). */
export async function segmentContactsPage(
  db: DB,
  accountId: string,
  rules: SegmentGroup,
  opts: { search?: string; sort?: SegmentSort; limit?: number; offset?: number } = {},
): Promise<SegmentContactsPage> {
  const { data, error } = await db.rpc('segment_contacts_page', {
    p_account_id: accountId,
    p_rules: rules,
    p_search: opts.search?.trim() || null,
    p_sort: opts.sort ?? 'created_desc',
    p_limit: opts.limit ?? 25,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw error;

  const rows = (data ?? []) as { contact: Contact; total_count: number }[];
  return {
    contacts: rows.map((r) => r.contact),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}
