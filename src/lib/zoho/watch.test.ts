import { afterEach, describe, expect, it } from 'vitest';

import {
  ALL_WATCH_KEYS,
  isWatchDue,
  notificationEventType,
  notificationRecord,
  parseZohoNotification,
  sanitizeWatchEvents,
  zohoExpiry,
  zohoNotifyUrl,
} from './watch';

describe('parseZohoNotification', () => {
  const body = {
    server_time: 1760000000000,
    module: 'Leads',
    resource_uri: 'https://www.zohoapis.in/crm/v5/Leads',
    ids: ['5725767000000524157', '5725767000000524158'],
    affected_fields: [],
    operation: 'insert',
    channel_id: '100000006800211',
    token: 'abc',
  };

  it('reads a Notification API delivery', () => {
    expect(parseZohoNotification(body)).toEqual({
      module: 'Leads',
      ids: ['5725767000000524157', '5725767000000524158'],
      operation: 'insert',
      channelId: '100000006800211',
      token: 'abc',
    });
  });

  it('ignores a Workflow Rule payload', () => {
    expect(parseZohoNotification({ phone: '+919800000000', name: 'A' })).toBeNull();
    expect(parseZohoNotification({ module: 'Leads', id: '1' })).toBeNull();
    expect(parseZohoNotification(null)).toBeNull();
    expect(parseZohoNotification([body])).toBeNull();
  });
});

describe('notificationEventType', () => {
  it('names events the way the catalogue and trigger filter do', () => {
    expect(notificationEventType('Leads', 'insert')).toBe('lead.created');
    expect(notificationEventType('Contacts', 'update')).toBe('contact.updated');
    expect(notificationEventType('Deals', 'delete')).toBe('deal.deleted');
    expect(notificationEventType('Potentials', 'update')).toBe('deal.updated');
  });

  it('shapes one id like a parsed webhook, ready for enrichment', () => {
    const n = parseZohoNotification({
      module: 'Contacts',
      ids: ['42'],
      operation: 'insert',
      channel_id: 1,
    })!;
    expect(notificationRecord(n, '42')).toMatchObject({
      module: 'Contacts',
      recordId: '42',
      eventType: 'contact.created',
      phone: null,
    });
  });
});

describe('sanitizeWatchEvents', () => {
  it('keeps only offered events, deduplicated, in catalogue order', () => {
    expect(
      sanitizeWatchEvents(['Deals.edit', 'Leads.create', 'Leads.create', 'Tasks.create', 7]),
    ).toEqual(['Leads.create', 'Deals.edit']);
    expect(sanitizeWatchEvents('Leads.create')).toEqual([]);
  });
});

describe('zohoExpiry', () => {
  it('uses the offset form Zoho accepts, inside the one-week limit', () => {
    const from = Date.parse('2026-10-12T10:00:00.000Z');
    const out = zohoExpiry(from);
    expect(out).toBe('2026-10-18T10:00:00+00:00');
    expect(Date.parse(out) - from).toBeLessThan(7 * 24 * 3600 * 1000);
  });
});

describe('zohoNotifyUrl', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it('points at the webhook on the canonical site', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://instant.example.com/';
    expect(zohoNotifyUrl('tok')).toBe(
      'https://instant.example.com/api/integrations/zoho/webhook/tok',
    );
  });

  it('is null without a site URL, rather than a relative URL Zoho rejects', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '';
    expect(zohoNotifyUrl('tok')).toBeNull();
  });
});

describe('isWatchDue', () => {
  const now = Date.parse('2026-10-12T00:00:00Z');
  const live = {
    watch_channel_id: '100000006800211',
    watch_expires_at: '2026-10-17T00:00:00Z',
    watch_checked_at: '2026-10-11T00:00:00Z',
    watch_events: [...ALL_WATCH_KEYS],
  };

  it('leaves a healthy channel alone', () => {
    expect(isWatchDue(live, now)).toBe(false);
  });

  it('renews a channel within two days of lapsing', () => {
    expect(isWatchDue({ ...live, watch_expires_at: '2026-10-13T12:00:00Z' }, now)).toBe(true);
    expect(isWatchDue({ ...live, watch_expires_at: null }, now)).toBe(true);
  });

  it('widens a channel made when only some events were watched', () => {
    expect(isWatchDue({ ...live, watch_events: ['Leads.create', 'Contacts.create'] }, now)).toBe(true);
  });

  it('retries a connection without a channel once a day', () => {
    const none = { ...live, watch_channel_id: null, watch_expires_at: null };
    expect(isWatchDue({ ...none, watch_checked_at: null }, now)).toBe(true);
    expect(isWatchDue({ ...none, watch_checked_at: '2026-10-11T12:00:00Z' }, now)).toBe(false);
    expect(isWatchDue({ ...none, watch_checked_at: '2026-10-10T23:00:00Z' }, now)).toBe(true);
  });
});
