"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Count of conversations with at least one unread inbound message for
 * the current user. Drives the green dot on the sidebar's Inbox entry
 * and the badge on the header bell.
 *
 * ONE subscription for the whole app, however many components read it.
 *
 * This used to open a channel and run a query per mount, and it is
 * mounted twice on every page — sidebar.tsx and notifications-bell.tsx
 * — so every navigation cost two `conversations` queries and two
 * Realtime channels carrying identical traffic. The module-level store
 * below is the same shape as `use-entitlements.ts`: shared state, one
 * fetch, reference-counted teardown.
 */

interface Store {
  /** Live mirror of {conversationId: unread_count}, so an event can
   *  adjust the total in O(1) without refetching. */
  counts: Map<string, number>;
  total: number;
  channel: RealtimeChannel | null;
  /** How many mounted components are reading this. The subscription is
   *  torn down when it returns to zero. */
  refs: number;
  /** useSyncExternalStore callbacks — each just says "re-read the
   *  snapshot", so they take no argument. */
  subscribers: Set<() => void>;
  loaded: boolean;
}

const store: Store = {
  counts: new Map(),
  total: 0,
  channel: null,
  refs: 0,
  subscribers: new Set(),
  loaded: false,
};

function publish(next: number): void {
  if (next === store.total) return; // no-op keeps React from re-rendering
  store.total = next;
  for (const notify of store.subscribers) notify();
}

function recompute(): void {
  let sum = 0;
  for (const n of store.counts.values()) if (n > 0) sum += 1;
  publish(sum);
}

/** Open the shared subscription and do the one initial read. */
function connect(): void {
  if (store.channel) return;
  const supabase = createClient();

  // RLS scopes this to the signed-in user automatically — no explicit
  // user_id filter needed.
  if (!store.loaded) {
    void supabase
      .from("conversations")
      .select("id, unread_count")
      .then(({ data, error }) => {
        if (error || !data) return;
        const map = new Map<string, number>();
        for (const row of data as { id: string; unread_count: number }[]) {
          map.set(row.id, row.unread_count ?? 0);
        }
        store.counts = map;
        store.loaded = true;
        recompute();
      });
  }

  store.channel = supabase
    .channel("total-unread-shared")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Partial<Conversation>;
          if (oldRow.id) store.counts.delete(oldRow.id);
        } else {
          const row = payload.new as Conversation;
          store.counts.set(row.id, row.unread_count ?? 0);
        }
        recompute();
      },
    )
    .subscribe();
}

function disconnect(): void {
  if (!store.channel) return;
  const supabase = createClient();
  void supabase.removeChannel(store.channel);
  store.channel = null;
  // `counts` and `loaded` survive on purpose: a remount (a route change
  // that unmounts and remounts the shell) reuses them instead of
  // re-querying, and the fresh subscription corrects any drift.
}

/**
 * `useSyncExternalStore` rather than useState + useEffect: this IS an
 * external store, and the built-in is the primitive designed for one.
 * It also sidesteps the "adopt the current value on mount" problem — a
 * component mounting after the initial read has already settled gets the
 * right number from `getSnapshot` on its first render, with no
 * setState-inside-an-effect and no cascading render.
 */
export function useTotalUnread(): number {
  const subscribe = useCallback((onStoreChange: () => void) => {
    store.refs += 1;
    store.subscribers.add(onStoreChange);
    connect();

    return () => {
      store.refs -= 1;
      store.subscribers.delete(onStoreChange);
      if (store.refs === 0) disconnect();
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => store.total,
    // Server snapshot: nothing is subscribed during SSR, and the badge
    // renders from zero until the client's first read lands.
    () => 0,
  );
}
