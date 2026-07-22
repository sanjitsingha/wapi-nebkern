import { useEffect, useState } from 'react';

export interface WaPhoneInfo {
  verified_name?: string;
  display_phone_number?: string;
  /** GREEN | YELLOW | RED | UNKNOWN — null until health loads / if unavailable. */
  quality_rating?: string | null;
  /** TIER_50 … TIER_UNLIMITED — null until health loads / if unavailable. */
  messaging_limit_tier?: string | null;
}

/** Human label + tone for Meta's quality_rating enum. */
export function qualityRatingLabel(rating: string | null | undefined): {
  label: string;
  tone: string;
} | null {
  switch (rating) {
    case 'GREEN':
      return { label: 'High', tone: 'text-emerald-600 dark:text-emerald-400' };
    case 'YELLOW':
      return { label: 'Medium', tone: 'text-amber-600 dark:text-amber-400' };
    case 'RED':
      return { label: 'Low', tone: 'text-red-600 dark:text-red-400' };
    case 'UNKNOWN':
      return { label: 'Unknown', tone: 'text-muted-foreground' };
    default:
      return null;
  }
}

/** Human label for Meta's messaging_limit_tier enum (unique customers / 24h). */
export function messagingTierLabel(
  tier: string | null | undefined,
): string | null {
  switch (tier) {
    case 'TIER_50':
      return '50 / 24h';
    case 'TIER_250':
      return '250 / 24h';
    case 'TIER_1K':
      return '1K / 24h';
    case 'TIER_10K':
      return '10K / 24h';
    case 'TIER_100K':
      return '100K / 24h';
    case 'TIER_UNLIMITED':
      return 'Unlimited';
    default:
      return null;
  }
}

/**
 * Whether the config request has resolved, and what it found. `null` from
 * useWhatsAppInfo conflates "still loading" with "not connected", which is
 * fine for decorative callers but not for UI that has to choose between a
 * skeleton and a "connect your number" prompt.
 */
export type WaConnectionStatus = 'loading' | 'connected' | 'disconnected';

/**
 * The connected WhatsApp Business phone's identity + health, plus the
 * load status.
 *
 * Identity (name/number) comes from /api/whatsapp/config; the health
 * signals (quality rating, messaging limit tier) come from the separate
 * /api/whatsapp/phone-health endpoint, so a Meta hiccup there can never
 * affect connect/verify. Health merges in when it lands — callers must
 * treat both health fields as optional.
 */
export function useWhatsAppConnection(): {
  info: WaPhoneInfo | null;
  status: WaConnectionStatus;
} {
  const [info, setInfo] = useState<WaPhoneInfo | null>(null);
  const [status, setStatus] = useState<WaConnectionStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/whatsapp/config')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.connected && data?.phone_info) {
          setInfo({
            verified_name: data.phone_info.verified_name,
            display_phone_number: data.phone_info.display_phone_number,
            // config already returns quality_rating (verifyPhoneNumber asks
            // for it); phone-health confirms/refines it below.
            quality_rating: data.phone_info.quality_rating ?? null,
          });
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      })
      // A failed request is indistinguishable from "not connected" as far
      // as callers can act on it — either way there's no number to use.
      .catch(() => {
        if (!cancelled) setStatus('disconnected');
      });

    // Additive: merges onto whatever identity resolved. If it fails, the
    // badges simply don't render.
    fetch('/api/whatsapp/phone-health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.configured) return;
        setInfo((prev) =>
          prev
            ? {
                ...prev,
                quality_rating: data.qualityRating ?? prev.quality_rating ?? null,
                messaging_limit_tier: data.messagingLimitTier ?? null,
              }
            : prev,
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return { info, status };
}

/**
 * Identity-only view of the above, for callers that just want to show the
 * number and don't care why it's missing. Null until config loads, or if
 * WhatsApp isn't connected.
 */
export function useWhatsAppInfo(): WaPhoneInfo | null {
  return useWhatsAppConnection().info;
}
