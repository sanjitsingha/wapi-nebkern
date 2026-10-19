import { describe, expect, it } from 'vitest';

import { hubspotTriggerMatches } from './events';
import { changeOrigin, hubspotEventType, parseHubSpotEvents } from './webhook';

describe('parseHubSpotEvents', () => {
  it('reads the generic object.* format by objectTypeId', () => {
    const [e] = parseHubSpotEvents([
      {
        eventId: 1,
        portalId: 123,
        occurredAt: 1_760_000_000_000,
        subscriptionType: 'object.propertyChange',
        objectId: 42,
        objectTypeId: '0-3',
        propertyName: 'dealstage',
        propertyValue: 'closedwon',
      },
    ]);
    expect(e).toMatchObject({
      portalId: '123',
      objectType: 'deal',
      objectId: '42',
      change: 'propertyChange',
      propertyName: 'dealstage',
      propertyValue: 'closedwon',
    });
    expect(e.dedupeKey).toBe('object.propertyChange:42:dealstage:1760000000000');
  });

  it('reads the classic contact.* format', () => {
    const [e] = parseHubSpotEvents([{ portalId: 1, subscriptionType: 'contact.creation', objectId: 7 }]);
    expect(e).toMatchObject({ objectType: 'contact', change: 'creation', objectId: '7' });
  });

  it('drops other objects and malformed entries', () => {
    expect(
      parseHubSpotEvents([
        { portalId: 1, subscriptionType: 'company.creation', objectId: 1 },
        { subscriptionType: 'contact.creation', objectId: 1 },
        'nonsense',
      ]),
    ).toEqual([]);
    expect(parseHubSpotEvents(null)).toEqual([]);
  });
});

describe('hubspotEventType', () => {
  it('names creations and the property changes we subscribe to', () => {
    expect(hubspotEventType({ objectType: 'contact', change: 'creation', propertyName: null })).toBe(
      'contact.created',
    );
    expect(
      hubspotEventType({ objectType: 'contact', change: 'propertyChange', propertyName: 'lifecyclestage' }),
    ).toBe('contact.lifecycle_changed');
    expect(
      hubspotEventType({ objectType: 'contact', change: 'propertyChange', propertyName: 'firstname' }),
    ).toBeNull();
  });

  it('calls a move to a closed stage won or lost', () => {
    const e = { objectType: 'deal' as const, change: 'propertyChange' as const, propertyName: 'dealstage' };
    expect(hubspotEventType(e, { closed: true, won: true })).toBe('deal.won');
    expect(hubspotEventType(e, { closed: true, won: false })).toBe('deal.lost');
    expect(hubspotEventType(e, { closed: false, won: false })).toBe('deal.stage_changed');
    expect(hubspotEventType(e, null)).toBe('deal.stage_changed');
  });
});

describe('changeOrigin', () => {
  it('recognises our own writes by the app id HubSpot tags them with', () => {
    expect(
      changeOrigin({ changeSource: 'INTEGRATION', sourceId: '57626200', appId: 57626200 }),
    ).toEqual({ byApp: true, dealId: null });
    expect(changeOrigin({ changeSource: 'INTEGRATION', sourceId: '999', appId: 57626200 }).byApp).toBe(false);
    expect(changeOrigin({ changeSource: 'CRM_UI', appId: 57626200 }).byApp).toBe(false);
  });

  it('names the deal behind a lifecycle sync', () => {
    expect(
      changeOrigin({ changeSource: 'DEALS', sourceId: 'deals-lifecycle-sync;dealId=355658323684' }),
    ).toEqual({ byApp: false, dealId: '355658323684' });
    expect(changeOrigin(null)).toEqual({ byApp: false, dealId: null });
  });
});

describe('hubspotTriggerMatches', () => {
  it('runs on new contacts when nothing is picked', () => {
    expect(hubspotTriggerMatches([], 'contact.created')).toBe(true);
    expect(hubspotTriggerMatches(undefined, 'deal.won')).toBe(false);
  });

  it('runs only on the picked events otherwise', () => {
    expect(hubspotTriggerMatches(['deal.won'], 'deal.won')).toBe(true);
    expect(hubspotTriggerMatches(['deal.won'], 'contact.created')).toBe(false);
  });
});
