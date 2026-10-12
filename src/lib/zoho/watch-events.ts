// The Zoho events automatic sync can watch. Client-safe on purpose:
// the Settings dialog and the automation builder list these, so this
// file must not import anything server-only (see ./watch.ts for the
// channel management that uses it).

/** The events an admin can choose, in the order the dialog lists them.
 *  `key` is Zoho's watch name; `eventType` is what reaches automations
 *  as {{vars.zoho_event}} and what a trigger filters on. */
export const ZOHO_WATCH_EVENTS = [
  { key: 'Leads.create', eventType: 'lead.created', label: 'New lead' },
  { key: 'Contacts.create', eventType: 'contact.created', label: 'New contact' },
  { key: 'Deals.create', eventType: 'deal.created', label: 'New deal' },
  { key: 'Leads.edit', eventType: 'lead.updated', label: 'Lead updated' },
  { key: 'Contacts.edit', eventType: 'contact.updated', label: 'Contact updated' },
  { key: 'Deals.edit', eventType: 'deal.updated', label: 'Deal updated' },
] as const;

export type ZohoWatchKey = (typeof ZOHO_WATCH_EVENTS)[number]['key'];

export const DEFAULT_WATCH_EVENTS: ZohoWatchKey[] = ['Leads.create', 'Contacts.create'];

const WATCH_KEYS = new Set<string>(ZOHO_WATCH_EVENTS.map((e) => e.key));

/** Keep only events we offer, deduplicated, in catalogue order. */
export function sanitizeWatchEvents(input: unknown): ZohoWatchKey[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.filter((v): v is string => typeof v === 'string'));
  return ZOHO_WATCH_EVENTS.map((e) => e.key).filter(
    (k) => wanted.has(k) && WATCH_KEYS.has(k),
  );
}
