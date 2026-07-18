'use client';

// ============================================================
// useEntitlements — client hook over /api/account/entitlements.
//
// Fetches once per page load (module-level cache shared by every
// consumer: sidebar, settings gates, plan usage meters) so gating N
// surfaces costs one request. FAIL OPEN: while loading or on any fetch
// error `snapshot` is null and consumers must treat that as "allowed" —
// the server routes remain the authoritative enforcement.
// ============================================================

import { useEffect, useState } from 'react';

import {
  fetchEntitlements,
  type EntitlementsSnapshot,
} from '@/lib/billing/entitlements-client';

let cached: EntitlementsSnapshot | null = null;
let inflight: Promise<EntitlementsSnapshot | null> | null = null;

async function load(): Promise<EntitlementsSnapshot | null> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetchEntitlements()
      .then((snap) => {
        cached = snap;
        return snap;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cache so the next mount refetches (e.g. after an upgrade). */
export function invalidateEntitlements(): void {
  cached = null;
}

export function useEntitlements(): {
  snapshot: EntitlementsSnapshot | null;
  loading: boolean;
} {
  const [snapshot, setSnapshot] = useState<EntitlementsSnapshot | null>(cached);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    load()
      .then((snap) => {
        if (!cancelled) setSnapshot(snap);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { snapshot, loading };
}
