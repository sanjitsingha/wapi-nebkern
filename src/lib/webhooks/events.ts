// ============================================================
// Webhook event catalog. Add a new event by (1) listing it here and
// (2) calling emitWebhookEvent(...) from the code path that produces it.
// ============================================================

export const WEBHOOK_EVENTS = [
  {
    type: 'message.received',
    label: 'Message received',
    description: 'A customer sent an inbound WhatsApp message.',
  },
  {
    type: 'contact.created',
    label: 'Contact created',
    description: 'A new contact was added.',
  },
  {
    type: 'conversation.assigned',
    label: 'Conversation assigned',
    description: 'A conversation was assigned to an agent.',
  },
  {
    type: 'deal.stage_changed',
    label: 'Deal stage changed',
    description: 'A deal moved to a different pipeline stage.',
  },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number]['type'];

const VALID = new Set<string>(WEBHOOK_EVENTS.map((e) => e.type));

export function isWebhookEvent(value: string): value is WebhookEventType {
  return VALID.has(value);
}
