// The Zoho events automatic sync watches, and which of them run an
// automation. Client-safe on purpose: the automation builder lists
// these, so this file must not import anything server-only (see
// ./watch.ts for the channel management that uses it).

/** Every event automatic sync subscribes to — all of them, always;
 *  there is no setting. `key` is Zoho's watch name; `eventType` is what
 *  reaches automations as {{vars.zoho_event}} and what a Zoho CRM Event
 *  trigger filters on. */
export const ZOHO_WATCH_EVENTS = [
  { key: 'Leads.create', eventType: 'lead.created', label: 'New lead' },
  { key: 'Contacts.create', eventType: 'contact.created', label: 'New contact' },
  { key: 'Deals.create', eventType: 'deal.created', label: 'New deal' },
  { key: 'Leads.edit', eventType: 'lead.updated', label: 'Lead updated' },
  { key: 'Contacts.edit', eventType: 'contact.updated', label: 'Contact updated' },
  { key: 'Deals.edit', eventType: 'deal.updated', label: 'Deal updated' },
] as const;

export type ZohoWatchKey = (typeof ZOHO_WATCH_EVENTS)[number]['key'];

export const ALL_WATCH_KEYS: ZohoWatchKey[] = ZOHO_WATCH_EVENTS.map((e) => e.key);

const WATCH_KEYS = new Set<string>(ALL_WATCH_KEYS);

/** Keep only events we offer, deduplicated, in catalogue order. */
export function sanitizeWatchEvents(input: unknown): ZohoWatchKey[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.filter((v): v is string => typeof v === 'string'));
  return ALL_WATCH_KEYS.filter((k) => wanted.has(k) && WATCH_KEYS.has(k));
}

/** What a Zoho CRM Event automation with nothing picked under "Run on"
 *  runs on: new leads and new contacts — exactly what automatic sync
 *  delivered when such automations were built. Edits and deals fire
 *  constantly now that every event is watched; running an unfiltered
 *  automation on each would message someone every time a field changes
 *  in Zoho. They run an automation only when picked. */
export const DEFAULT_RUN_ON = ['lead.created', 'contact.created'] as const;

const SYNC_EVENT_TYPES = new Set<string>([
  ...ZOHO_WATCH_EVENTS.map((e) => e.eventType),
  'lead.deleted',
  'contact.deleted',
  'deal.deleted',
]);

/** Does a Zoho event run this automation? `selected` is the trigger's
 *  "Run on" list; `event` is {{vars.zoho_event}}. */
export function zohoTriggerMatches(selected: unknown, event: unknown): boolean {
  const picked = Array.isArray(selected)
    ? selected.filter((v): v is string => typeof v === 'string')
    : [];
  const name = typeof event === 'string' ? event : '';
  if (picked.length > 0) return picked.includes(name);
  // A Workflow Rule event carries whatever name its rule sends (or
  // none). Those always ran unfiltered automations, and still do.
  if (!SYNC_EVENT_TYPES.has(name)) return true;
  return (DEFAULT_RUN_ON as readonly string[]).includes(name);
}
