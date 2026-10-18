import { describe, expect, it } from 'vitest';

import type { ContactRow } from '@/lib/zoho/push';
import {
  contactProperties,
  existingIdFromConflict,
  hubspotRecordUrl,
  invalidPropertyNames,
  mapHubSpotStage,
  pickPipeline,
  type HubSpotStage,
} from './push';

const contact = (over: Partial<ContactRow> = {}): ContactRow => ({
  id: 'c1',
  account_id: 'a1',
  name: 'Asha Rao',
  phone: '919876543210',
  email: 'asha@example.com',
  company: 'Rao Traders',
  instagram_id: null,
  messenger_id: null,
  created_via: 'conversation',
  ...over,
});

describe('contactProperties', () => {
  it('fills phone and lifecycle stage only when creating', () => {
    expect(contactProperties(contact(), { creating: true, lifecycle: 'lead' })).toEqual({
      firstname: 'Asha',
      lastname: 'Rao',
      mobilephone: '+919876543210',
      phone: '+919876543210',
      email: 'asha@example.com',
      company: 'Rao Traders',
      lifecyclestage: 'lead',
    });
    const update = contactProperties(contact(), { creating: false, lifecycle: 'lead' });
    expect(update.phone).toBeUndefined();
    expect(update.lifecyclestage).toBeUndefined();
  });

  it('never sends a name that is really the phone number', () => {
    const props = contactProperties(contact({ name: '+91 98765 43210' }), { creating: true });
    expect(props.firstname).toBeUndefined();
    expect(props.lastname).toBeUndefined();
  });
});

describe('HubSpot error parsing', () => {
  it('reads the id out of a 409', () => {
    expect(existingIdFromConflict('Contact already exists. Existing ID: 1234')).toBe('1234');
    expect(existingIdFromConflict('Something else')).toBeNull();
  });

  it('names the invalid properties of a validation error', () => {
    const message =
      'Property values were not valid: [{"isValid":false,"message":"Email address x is invalid","error":"INVALID_EMAIL","name":"email"}]';
    expect(invalidPropertyNames(message)).toEqual(['email']);
  });
});

const stages: HubSpotStage[] = [
  { id: 's1', label: 'Appointment scheduled', closed: false, won: false },
  { id: 's2', label: 'Contract sent', closed: false, won: false },
  { id: 'won', label: 'Closed won', closed: true, won: true },
  { id: 'lost', label: 'Closed lost', closed: true, won: false },
];

describe('mapHubSpotStage', () => {
  it('uses the stage metadata for won and lost', () => {
    expect(mapHubSpotStage(stages, 'Negotiation', 'won').stage?.id).toBe('won');
    expect(mapHubSpotStage(stages, 'Negotiation', 'lost').stage?.id).toBe('lost');
  });

  it('matches by name, then loosely, then falls back with a note', () => {
    expect(mapHubSpotStage(stages, 'contract sent', 'open').stage?.id).toBe('s2');
    expect(mapHubSpotStage(stages, 'Contract', 'open').stage?.id).toBe('s2');
    const fallback = mapHubSpotStage(stages, 'Qualified', 'open');
    expect(fallback.stage?.id).toBe('s1');
    expect(fallback.note).toMatch(/no match/);
  });
});

describe('pickPipeline', () => {
  it('prefers the default pipeline and reads closed and won from metadata', () => {
    const p = pickPipeline({
      results: [
        { id: 'other', label: 'Other', displayOrder: 0, stages: [] },
        {
          id: 'default',
          label: 'Sales',
          displayOrder: 1,
          stages: [
            { id: 'b', label: 'Won', displayOrder: 2, metadata: { isClosed: 'true', probability: '1.0' } },
            { id: 'a', label: 'New', displayOrder: 1, metadata: { isClosed: 'false', probability: '0.2' } },
          ],
        },
      ],
    });
    expect(p?.id).toBe('default');
    expect(p?.stages.map((s) => [s.id, s.closed, s.won])).toEqual([
      ['a', false, false],
      ['b', true, true],
    ]);
  });
});

describe('hubspotRecordUrl', () => {
  it('builds record links on the portal UI domain', () => {
    expect(hubspotRecordUrl('app-eu1.hubspot.com', '123', 'deals', '9')).toBe(
      'https://app-eu1.hubspot.com/contacts/123/record/0-3/9',
    );
    expect(hubspotRecordUrl(null, null, 'contacts', '9')).toBeNull();
  });
});
