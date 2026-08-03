'use client';

// ============================================================
// useConnectedChannels — client hook over /api/channels.
//
// Fetches once per page load (module-level cache shared by every
// consumer) so asking from several places costs one request. Mirrors
// useEntitlements, but FAILS CLOSED rather than open: while loading or
// on any error, nothing extra is reported connected. A tab that appears
// a beat late is a non-event; one that appears for a channel you cannot
// actually send on is a dead end the user has to discover by clicking.
// ============================================================

import { useEffect, useState } from 'react';

export interface ConnectedChannels {
  messenger: boolean;
  instagram: boolean;
}

const NONE: ConnectedChannels = { messenger: false, instagram: false };

let cached: ConnectedChannels | null = null;
let inflight: Promise<ConnectedChannels> | null = null;

async function load(): Promise<ConnectedChannels> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch('/api/channels')
      .then((res) => (res.ok ? res.json() : NONE))
      .then((body: Partial<ConnectedChannels>) => {
        cached = {
          messenger: body?.messenger === true,
          instagram: body?.instagram === true,
        };
        return cached;
      })
      .catch(() => NONE)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cache so the next mount refetches — call after connecting or
 *  disconnecting a channel in settings. */
export function invalidateConnectedChannels(): void {
  cached = null;
}

export function useConnectedChannels(): {
  channels: ConnectedChannels;
  loading: boolean;
} {
  const [channels, setChannels] = useState<ConnectedChannels>(cached ?? NONE);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    load()
      .then((next) => {
        if (!cancelled) setChannels(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { channels, loading };
}
