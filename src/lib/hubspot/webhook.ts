// ============================================================
// Reading a HubSpot webhook delivery: a JSON array of up to 100
// events, each naming an object and what happened to it. Pure, so it
// is tested on its own (webhook.test.ts).
//
// Both of HubSpot's formats are understood — the classic
// `contact.creation` / `deal.propertyChange` subscription types and the
// generic `object.creation` ones, which name the object by
// objectTypeId (0-1 contact, 0-3 deal) instead.
// ============================================================

export interface RawHubSpotEvent {
  eventId?: number | string;
  subscriptionId?: number | string;
  portalId?: number | string;
  appId?: number | string;
  occurredAt?: number;
  subscriptionType?: string;
  /** Some payloads name the type here instead. */
  eventType?: string;
  objectId?: number | string;
  objectTypeId?: string;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
  sourceId?: string;
}

export type HubSpotObjectType = 'contact' | 'deal';
export type HubSpotChange = 'creation' | 'propertyChange' | 'deletion' | 'other';

export interface ParsedHubSpotEvent {
  portalId: string;
  objectType: HubSpotObjectType;
  objectId: string;
  change: HubSpotChange;
  subscriptionType: string;
  propertyName: string | null;
  propertyValue: string | null;
  occurredAt: string | null;
  /** Stable across HubSpot's retries; eventId is not guaranteed unique. */
  dedupeKey: string;
  raw: RawHubSpotEvent;
}

const OBJECT_TYPE_IDS: Record<string, HubSpotObjectType> = { '0-1': 'contact', '0-3': 'deal' };

function objectTypeOf(e: RawHubSpotEvent, type: string): HubSpotObjectType | null {
  if (e.objectTypeId && OBJECT_TYPE_IDS[e.objectTypeId]) return OBJECT_TYPE_IDS[e.objectTypeId];
  if (type.startsWith('contact.')) return 'contact';
  if (type.startsWith('deal.')) return 'deal';
  return null;
}

function changeOf(type: string): HubSpotChange {
  const suffix = type.split('.').pop() ?? '';
  if (suffix === 'creation') return 'creation';
  if (suffix === 'propertyChange') return 'propertyChange';
  if (suffix === 'deletion' || suffix === 'privacyDeletion') return 'deletion';
  return 'other';
}

/** The events we act on, from a delivery's body. Anything else — other
 *  objects, malformed entries — is dropped. */
export function parseHubSpotEvents(body: unknown): ParsedHubSpotEvent[] {
  const list = Array.isArray(body) ? body : body && typeof body === 'object' ? [body] : [];
  const out: ParsedHubSpotEvent[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const e = item as RawHubSpotEvent;
    const type = String(e.subscriptionType ?? e.eventType ?? '');
    const objectType = objectTypeOf(e, type);
    if (!objectType || e.objectId === undefined || e.portalId === undefined) continue;

    const occurredAt =
      typeof e.occurredAt === 'number' && Number.isFinite(e.occurredAt)
        ? new Date(e.occurredAt).toISOString()
        : null;
    const propertyName = typeof e.propertyName === 'string' ? e.propertyName : null;
    const objectId = String(e.objectId);
    out.push({
      portalId: String(e.portalId),
      objectType,
      objectId,
      change: changeOf(type),
      subscriptionType: type,
      propertyName,
      propertyValue: e.propertyValue === undefined || e.propertyValue === null ? null : String(e.propertyValue),
      occurredAt,
      dedupeKey: [type, objectId, propertyName ?? '', e.occurredAt ?? e.eventId ?? ''].join(':'),
      raw: e,
    });
  }
  return out;
}

/**
 * Who made a change, by HubSpot's own account of it:
 *   byApp   Dripo wrote it — HubSpot tags our writes with
 *           changeSource INTEGRATION and our app id as the source.
 *   dealId  HubSpot's deal lifecycle sync moved a contact's stage
 *           because of this deal — ours, if we pushed the deal.
 */
export function changeOrigin(raw: RawHubSpotEvent | null | undefined): {
  byApp: boolean;
  dealId: string | null;
} {
  const source = raw?.changeSource ?? '';
  const sourceId = raw?.sourceId === undefined || raw?.sourceId === null ? '' : String(raw.sourceId);
  const appId = raw?.appId === undefined || raw?.appId === null ? '' : String(raw.appId);
  return {
    byApp: source === 'INTEGRATION' && !!appId && sourceId === appId,
    dealId: source === 'DEALS' ? (sourceId.match(/dealId=(\d+)/)?.[1] ?? null) : null,
  };
}

/**
 * What an event is called for automations ({{vars.hubspot_event}}), or
 * null when it is not one we run anything on. A deal stage change needs
 * to know whether the new stage is closed, which the caller looks up.
 */
export function hubspotEventType(
  e: Pick<ParsedHubSpotEvent, 'objectType' | 'change' | 'propertyName'>,
  dealStage?: { closed: boolean; won: boolean } | null,
): string | null {
  if (e.change === 'creation') return `${e.objectType}.created`;
  if (e.change !== 'propertyChange') return null;
  if (e.objectType === 'contact') {
    if (e.propertyName === 'lifecyclestage') return 'contact.lifecycle_changed';
    if (e.propertyName === 'hs_lead_status') return 'contact.lead_status_changed';
    return null;
  }
  if (e.propertyName === 'dealstage') {
    if (dealStage?.closed) return dealStage.won ? 'deal.won' : 'deal.lost';
    return 'deal.stage_changed';
  }
  return null;
}
