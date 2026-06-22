import { softBadge } from '@/lib/badge-colors'
import type { AutomationTriggerType } from '@/types'

export interface TriggerMeta {
  label: string
  /** Tailwind classes for the Badge pill on the list row. */
  pillClass: string
}

export const TRIGGER_META: Record<AutomationTriggerType, TriggerMeta> = {
  new_message_received: { label: 'New Message', pillClass: softBadge.blue },
  first_inbound_message: {
    label: 'First Message from Contact',
    pillClass: softBadge.teal,
  },
  keyword_match: { label: 'Keyword Match', pillClass: softBadge.purple },
  new_contact_created: { label: 'New Contact', pillClass: softBadge.primary },
  conversation_assigned: {
    label: 'Conversation Assigned',
    pillClass: softBadge.green,
  },
  tag_added: { label: 'Tag Added', pillClass: softBadge.amber },
  time_based: { label: 'Time-Based', pillClass: softBadge.neutral },
}

export function triggerMeta(t: AutomationTriggerType | string): TriggerMeta {
  return (
    TRIGGER_META[t as AutomationTriggerType] ?? {
      label: t,
      pillClass: softBadge.neutral,
    }
  )
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never'
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 2_592_000) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}
