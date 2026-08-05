'use client';

// ============================================================
// Reference data — small, slow-changing, and previously refetched by
// every component that needed it.
//
// A survey of client-side reads found `tags` fetched from 14 separate
// call sites, `custom_fields` from 10, `profiles` from 8, and pipelines
// and quick replies from 5 each. Each site had its own useEffect, so
// opening a screen that showed two of them made two requests, and going
// back made two more — for lists that change maybe once a week.
//
// These hooks give each of those one cache entry keyed per account.
// Every consumer shares it: the first mount fetches, the rest read from
// memory, and returning to a screen inside the stale window costs
// nothing at all.
//
// A LONGER staleTime THAN THE APP DEFAULT
//
// The provider defaults to 30 seconds, tuned for operational data like
// conversations. Reference data earns much longer: a tag list that is
// five minutes out of date is not a bug, and the alternative is paying
// for the same twelve rows all day. Anything that edits these lists
// should call the matching invalidate helper, which updates every
// consumer at once — the thing the old per-component fetches could
// never do.
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { Tag, Profile, CustomField } from '@/types';

/** Five minutes. See the note above on why this is not the default. */
const REFERENCE_STALE_MS = 5 * 60_000;

/**
 * Keys are namespaced by account so that switching account — or signing
 * in as someone else on the same tab — cannot read the previous
 * account's rows out of the cache.
 */
export const referenceKeys = {
  tags: (accountId: string | null) => ['reference', 'tags', accountId] as const,
  team: (accountId: string | null) => ['reference', 'team', accountId] as const,
  customFields: (accountId: string | null) =>
    ['reference', 'custom-fields', accountId] as const,
};

/**
 * All tags for the account, ordered by name.
 *
 * RLS scopes the read, so no explicit account filter is needed — the
 * account id is in the key purely to partition the cache.
 */
export function useTags() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: referenceKeys.tags(accountId),
    enabled: Boolean(accountId),
    staleTime: REFERENCE_STALE_MS,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await createClient()
        .from('tags')
        .select('id, name, color')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });
}

/**
 * Team members, for assignee pickers and author labels.
 *
 * Named columns rather than `select('*')`: the pickers show a name, an
 * email and an avatar, and `*` drags beta flags and account metadata
 * along for every member.
 */
export function useTeamMembers() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: referenceKeys.team(accountId),
    enabled: Boolean(accountId),
    staleTime: REFERENCE_STALE_MS,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await createClient()
        .from('profiles')
        .select('id, user_id, full_name, email, avatar_url')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

/** Custom field definitions — schema, not content, so rarely changed. */
export function useCustomFields() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: referenceKeys.customFields(accountId),
    enabled: Boolean(accountId),
    staleTime: REFERENCE_STALE_MS,
    queryFn: async (): Promise<CustomField[]> => {
      const { data, error } = await createClient()
        .from('custom_fields')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as CustomField[];
    },
  });
}

/**
 * Drop cached reference data after an edit.
 *
 * Call the specific one where you can. The five-minute window means a
 * component that renames a tag and does NOT invalidate will show the old
 * name to every other screen until it expires — which is exactly the
 * kind of staleness bug caching introduces, so wire this into save
 * handlers rather than relying on the timer.
 */
export function useInvalidateReferenceData() {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  return {
    tags: () => qc.invalidateQueries({ queryKey: referenceKeys.tags(accountId) }),
    team: () => qc.invalidateQueries({ queryKey: referenceKeys.team(accountId) }),
    customFields: () =>
      qc.invalidateQueries({ queryKey: referenceKeys.customFields(accountId) }),
    all: () => qc.invalidateQueries({ queryKey: ['reference'] }),
  };
}
