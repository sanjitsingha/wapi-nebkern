import { describe, expect, it } from 'vitest';

import { normalizeZohoPayload } from './payload';

// Zoho Workflow Rules send whatever fields the person configuring them
// ticked, in whatever shape their org uses. These are the shapes seen
// in practice — a miss here means an automation silently never runs.
describe('normalizeZohoPayload', () => {
  it('reads a flat record', () => {
    const out = normalizeZohoPayload({
      Full_Name: 'Priya Raman',
      Mobile: '9876543210',
      Email: 'priya@example.com',
      Deal_Name: 'Q3 renewal',
    });
    expect(out.phone).toBe('919876543210');
    expect(out.name).toBe('Priya Raman');
    expect(out.email).toBe('priya@example.com');
    expect(out.vars.deal_name).toBe('Q3 renewal');
  });

  it('unwraps the `data` array Zoho usually sends', () => {
    const out = normalizeZohoPayload({
      module: 'Deals',
      data: [{ Deal_Name: 'Big one', Phone: '+919876543210', id: '4200001' }],
    });
    expect(out.phone).toBe('919876543210');
    expect(out.module).toBe('Deals');
    expect(out.recordId).toBe('4200001');
    expect(out.vars.deal_name).toBe('Big one');
  });

  it('reads a lookup field as its name, not [object Object]', () => {
    // A Deal's Contact_Name is { id, name } — the single easiest way to
    // send a customer literal "[object Object]".
    const out = normalizeZohoPayload({
      Contact_Name: { id: '99', name: 'Arjun Nair' },
      Mobile: '9876543210',
    });
    expect(out.name).toBe('Arjun Nair');
    expect(out.vars.contact_name).toBe('Arjun Nair');
  });

  it('prefers Mobile over Phone when both exist', () => {
    const out = normalizeZohoPayload({
      Phone: '08012345678',
      Mobile: '9876543210',
    });
    expect(out.phone).toBe('919876543210');
  });

  it('finds a phone under a renamed field, case-insensitively', () => {
    expect(normalizeZohoPayload({ PHONE: '9876543210' }).phone).toBe(
      '919876543210',
    );
    expect(normalizeZohoPayload({ whatsapp_number: '9876543210' }).phone).toBe(
      '919876543210',
    );
  });

  it('returns null phone when there is nothing usable', () => {
    // The event is still recorded; it just cannot be messaged.
    expect(normalizeZohoPayload({ Deal_Name: 'No contact' }).phone).toBeNull();
    expect(normalizeZohoPayload({ Mobile: 'not a number' }).phone).toBeNull();
    expect(normalizeZohoPayload({}).phone).toBeNull();
    expect(normalizeZohoPayload(null).phone).toBeNull();
  });

  it('exposes the event type as a var', () => {
    const out = normalizeZohoPayload({
      event_type: 'deal_won',
      Mobile: '9876543210',
    });
    expect(out.eventType).toBe('deal_won');
    expect(out.vars.event).toBe('deal_won');
  });

  it('normalises var keys so a template can be written once', () => {
    const out = normalizeZohoPayload({
      'Order Value': '2499',
      'Custom-Field!': 'x',
    });
    expect(out.vars.order_value).toBe('2499');
    expect(out.vars.customfield).toBe('x');
  });

  it('coerces numbers and booleans, drops nulls', () => {
    const out = normalizeZohoPayload({
      Amount: 2499,
      Closed: true,
      Nothing: null,
      Empty: '',
    });
    expect(out.vars.amount).toBe('2499');
    expect(out.vars.closed).toBe('true');
    expect(out.vars.nothing).toBeUndefined();
    expect(out.vars.empty).toBeUndefined();
  });

  it('takes the first entry of a multi-select', () => {
    const out = normalizeZohoPayload({ Tags: ['vip', 'renewal'] });
    expect(out.vars.tags).toBe('vip');
  });

  it('caps the number of vars', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 100; i += 1) big[`field_${i}`] = String(i);
    const out = normalizeZohoPayload(big);
    expect(Object.keys(out.vars).length).toBeLessThanOrEqual(40);
  });

  it('survives a hostile payload without throwing', () => {
    expect(() => normalizeZohoPayload('a string')).not.toThrow();
    expect(() => normalizeZohoPayload([1, 2, 3])).not.toThrow();
    expect(() => normalizeZohoPayload({ data: 'not an array' })).not.toThrow();
  });
});
