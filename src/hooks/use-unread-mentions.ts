'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';

const NONE: ReadonlyMap<string, number> = new Map();

const mentionsKey = (userId: string | null) => ['unread-mentions', userId] as const;

/** contact_id → unread mentions of `userId`. */
async function fetchUnreadMentions(userId: string): Promise<ReadonlyMap<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contact_thread_mentions')
    .select('contact_id, message:contact_thread_messages(deleted_at)')
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw new Error(error.message);

  const byContact = new Map<string, number>();
  for (const row of data ?? []) {
    // To-one, but typed as either shape without generated types.
    const embedded = row.message as unknown;
    const message = (Array.isArray(embedded) ? embedded[0] : embedded) as
      | { deleted_at: string | null }
      | null
      | undefined;
    // A mention inside a message deleted since leaves nothing to read.
    if (!message || message.deleted_at) continue;
    const id = row.contact_id as string;
    byContact.set(id, (byContact.get(id) ?? 0) + 1);
  }
  return byContact;
}

/**
 * Where a teammate @mentioned me and I have not opened the contact's
 * Team thread since: contact_id → number of unread mentions. Drives the
 * inbox's Mentions filter.
 *
 * Read straight from contact_thread_mentions — RLS already limits it to
 * the signed-in user's own rows. Opening the Team thread marks them
 * read (team-thread.tsx → PATCH /api/mentions), and that UPDATE comes
 * back over Realtime like a new mention's INSERT; either one refetches,
 * so the count follows both without polling.
 */
export function useUnreadMentions(): ReadonlyMap<string, number> {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: mentionsKey(userId),
    queryFn: () => fetchUnreadMentions(userId as string),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`unread-mentions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_thread_mentions',
          filter: `user_id=eq.${userId}`,
        },
        () => void qc.invalidateQueries({ queryKey: mentionsKey(userId) }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return data ?? NONE;
}
