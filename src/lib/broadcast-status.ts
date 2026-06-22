/**
 * Shared status badge config for broadcasts + recipients.
 *
 * Previously `statusConfig` was defined inline in both
 * /broadcasts/page.tsx and /broadcasts/[id]/page.tsx with slight
 * drift risk. One source of truth now.
 *
 * Colours come from the shared light-first `softBadge` map so pills
 * read crisply on the light theme and still adapt in dark mode.
 */

import { softBadge } from "@/lib/badge-colors";
import type { BroadcastStatus, RecipientStatus } from "@/types";

export interface StatusDisplay {
  label: string;
  classes: string;
  /**
   * Set true for statuses that should pulse in the UI to convey
   * "live / in-flight" — currently only `sending`.
   */
  pulse?: boolean;
}

export const broadcastStatusConfig: Record<BroadcastStatus, StatusDisplay> = {
  draft: { label: "Draft", classes: softBadge.neutral },
  scheduled: { label: "Scheduled", classes: softBadge.blue },
  sending: { label: "Sending", classes: softBadge.amber, pulse: true },
  sent: { label: "Sent", classes: softBadge.primary },
  failed: { label: "Failed", classes: softBadge.red },
};

export const recipientStatusConfig: Record<RecipientStatus, StatusDisplay> = {
  pending: { label: "Pending", classes: softBadge.neutral },
  sent: { label: "Sent", classes: softBadge.blue },
  delivered: { label: "Delivered", classes: softBadge.primary },
  read: { label: "Read", classes: softBadge.primary },
  replied: { label: "Replied", classes: softBadge.purple },
  failed: { label: "Failed", classes: softBadge.red },
};

/**
 * Tolerant lookup — callers often have a generic string status
 * coming from Supabase. Falls back to the "draft" / "pending"
 * entry so the UI never crashes on an unknown value.
 */
export function getBroadcastStatus(status: string): StatusDisplay {
  return (
    broadcastStatusConfig[status as BroadcastStatus] ??
    broadcastStatusConfig.draft
  );
}

export function getRecipientStatus(status: string): StatusDisplay {
  return (
    recipientStatusConfig[status as RecipientStatus] ??
    recipientStatusConfig.pending
  );
}
