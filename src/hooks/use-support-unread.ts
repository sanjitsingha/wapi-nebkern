'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type UnreadRow = {
  id: string;
  last_support_reply_at: string | null;
  user_last_read_at: string | null;
};

/** A ticket is unread when support replied after the user last opened it. */
function isUnread(row: {
  last_support_reply_at: string | null;
  user_last_read_at: string | null;
}): boolean {
  if (!row.last_support_reply_at) return false;
  if (!row.user_last_read_at) return true;
  return Date.parse(row.last_support_reply_at) > Date.parse(row.user_last_read_at);
}

/**
 * Number of support tickets with an unread reply from the product team.
 * Drives the alert dot on the sidebar "Support" button. Account-scoped
 * (RLS) and shared across the team — whoever opens a ticket clears it for
 * the account.
 *
 * On its own realtime channel so it composes with other unread hooks
 * (e.g. useTotalUnread) without sharing state.
 */
export function useSupportUnread(): number {
  const [total, setTotal] = useState(0);
  const rowsRef = useRef<Map<string, UnreadRow>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const recompute = () => {
      let sum = 0;
      for (const row of rowsRef.current.values()) if (isUnread(row)) sum += 1;
      setTotal(sum);
    };

    (async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, last_support_reply_at, user_last_read_at');
      if (cancelled || error || !data) return;

      const map = new Map<string, UnreadRow>();
      for (const row of data as UnreadRow[]) map.set(row.id, row);
      rowsRef.current = map;
      recompute();
    })();

    const channelName = `support-unread-realtime:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        (payload) => {
          const map = rowsRef.current;
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<UnreadRow>;
            if (oldRow.id) map.delete(oldRow.id);
          } else {
            const row = payload.new as UnreadRow;
            map.set(row.id, {
              id: row.id,
              last_support_reply_at: row.last_support_reply_at ?? null,
              user_last_read_at: row.user_last_read_at ?? null,
            });
          }
          recompute();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return total;
}
