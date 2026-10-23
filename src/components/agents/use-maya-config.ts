'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { PersonalityId } from '@/lib/ai/personalities';

/** What GET /api/ai/config returns, as Maya's pages use it. */
export interface MayaConfig {
  /** Dripo's AI is set up (Admin → AI model). */
  configured: boolean;
  is_active: boolean;
  auto_reply_enabled: boolean;
  auto_reply_max_per_conversation: number;
  system_prompt: string | null;
  personality: PersonalityId;
  restrictions: string | null;
}

/**
 * Load Maya's settings once for a page, and save any subset of them
 * with PATCH /api/ai/config. `save` resolves true on success and keeps
 * `config` in step, so each card's "saved" baseline moves with it.
 */
export function useMayaConfig() {
  const [config, setConfig] = useState<MayaConfig | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/config')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Failed to load');
        if (!cancelled) setConfig(data as MayaConfig);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (patch: Partial<MayaConfig>): Promise<boolean> => {
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save.');
        return false;
      }
      setConfig((c) => (c ? { ...c, ...patch } : c));
      toast.success('Saved.');
      return true;
    } catch {
      toast.error('Could not reach Dripo. Check your connection and try again.');
      return false;
    }
  }, []);

  return { config, failed, save };
}
