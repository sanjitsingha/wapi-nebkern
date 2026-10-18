// The HubSpot events that reach Instant, and which of them run an
// automation. Client-safe on purpose: the automation builder lists
// these, so this file must not import anything server-only.
//
// They come from the app's webhook subscriptions
// (hubspot/src/app/webhooks/webhooks-hsmeta.json) — the two lists must
// agree. A deal stage change is reported as deal.won or deal.lost when
// the new stage is a closed one, and as deal.stage_changed otherwise.

export const HUBSPOT_EVENTS = [
  { eventType: 'contact.created', label: 'New contact' },
  { eventType: 'contact.lifecycle_changed', label: 'Lifecycle stage changed' },
  { eventType: 'contact.lead_status_changed', label: 'Lead status changed' },
  { eventType: 'deal.created', label: 'New deal' },
  { eventType: 'deal.stage_changed', label: 'Deal stage changed' },
  { eventType: 'deal.won', label: 'Deal won' },
  { eventType: 'deal.lost', label: 'Deal lost' },
] as const;

export type HubSpotEventType = (typeof HUBSPOT_EVENTS)[number]['eventType'];

/** What a HubSpot Event automation with nothing picked under "Run on"
 *  runs on. Only new contacts: stage and status changes are frequent,
 *  and messaging someone on each one unasked would surprise everybody. */
export const HUBSPOT_DEFAULT_RUN_ON: readonly string[] = ['contact.created'];

/** Does a HubSpot event run this automation? `selected` is the
 *  trigger's "Run on" list; `event` is {{vars.hubspot_event}}. */
export function hubspotTriggerMatches(selected: unknown, event: unknown): boolean {
  const picked = Array.isArray(selected)
    ? selected.filter((v): v is string => typeof v === 'string')
    : [];
  const name = typeof event === 'string' ? event : '';
  return (picked.length > 0 ? picked : HUBSPOT_DEFAULT_RUN_ON).includes(name);
}
