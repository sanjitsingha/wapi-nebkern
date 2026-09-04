import { WEBHOOK_EVENTS, type WebhookEventType } from './events';

// ============================================================
// Example payloads, one per event.
//
// These exist so someone building a Zap can see the field names before
// the first real event fires. Zapier's "Catch Hook" step shows nothing
// until it receives something, and an empty step is where most people
// stop — so the alternative to this file is asking a customer to
// trigger a real message on their live number just to learn the shape.
//
// Every sample is copied from the actual emitWebhookEvent call site,
// not invented. A sample that disagrees with what arrives is worse than
// none: it sends someone off building a Zap against a field that does
// not exist. If you change an emit, change the sample in the same
// commit — the test in samples.test.ts checks the events line up, but
// it cannot check the fields for you.
// ============================================================

/** The envelope every delivery is wrapped in — see WebhookEnvelope. */
export interface SamplePayload {
  id: string;
  event: WebhookEventType;
  created_at: string;
  account_id: string;
  data: Record<string, unknown>;
}

const ACCOUNT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const CREATED_AT = '2026-03-14T09:21:07.482Z';

/** `data` for each event, mirroring its emit call site. */
const SAMPLE_DATA: Record<WebhookEventType, Record<string, unknown>> = {
  // src/app/api/whatsapp/webhook/route.ts
  'message.received': {
    conversation_id: 'b1f3c8d2-5a44-4e77-9b21-0c6d8e4f1a93',
    contact_id: 'e2a7d914-3c86-4f10-b5d2-7a1e9c3f8b40',
    contact_name: 'Priya Raman',
    from: '919876543210',
    content_type: 'text',
    content_text: 'Is the blue one back in stock?',
    message_id: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhgU',
  },
  // src/app/api/contacts/notify-created/route.ts
  'contact.created': {
    contact_id: 'e2a7d914-3c86-4f10-b5d2-7a1e9c3f8b40',
    name: 'Priya Raman',
    phone: '919876543210',
  },
  // src/app/api/conversations/[id]/assign/route.ts
  'conversation.assigned': {
    conversation_id: 'b1f3c8d2-5a44-4e77-9b21-0c6d8e4f1a93',
    contact_id: 'e2a7d914-3c86-4f10-b5d2-7a1e9c3f8b40',
    agent_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  },
  // src/app/api/deals/[id]/stage/route.ts
  'deal.stage_changed': {
    deal_id: '9b2c5f31-7d48-4a6e-8c19-2f5b7e0d4a86',
    title: 'Bulk order — 40 units',
    value: 84000,
    currency: 'INR',
    contact_id: 'e2a7d914-3c86-4f10-b5d2-7a1e9c3f8b40',
    pipeline_id: '5d8f2a17-6b93-4c50-a7e1-8d3f9b2c6e04',
    from_stage_id: '1a4b7c92-3e56-4d81-9f27-6c0a8b5d3e19',
    to_stage_id: '2b5c8d03-4f67-4e92-a038-7d1b9c6e4f2a',
  },
};

/** The full envelope for one event, as it arrives at the endpoint. */
export function sampleFor(event: WebhookEventType): SamplePayload {
  return {
    id: 'whd_3f9a2c81b47e',
    event,
    created_at: CREATED_AT,
    account_id: ACCOUNT_ID,
    data: SAMPLE_DATA[event],
  };
}

/** Pretty-printed, for showing in the UI and copying to a clipboard. */
export function sampleJson(event: WebhookEventType): string {
  return JSON.stringify(sampleFor(event), null, 2);
}

/** Every event with its label and sample, for rendering a list. */
export function allSamples(): {
  type: WebhookEventType;
  label: string;
  description: string;
  json: string;
}[] {
  return WEBHOOK_EVENTS.map((e) => ({
    type: e.type,
    label: e.label,
    description: e.description,
    json: sampleJson(e.type),
  }));
}
