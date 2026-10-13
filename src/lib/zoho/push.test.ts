import { describe, expect, it } from 'vitest';

import {
  contactHash,
  contactPayload,
  mapStage,
  phoneKey,
  splitName,
  zohoCrmUrl,
  zohoRecordUrl,
  type ContactRow,
} from './push';

const base: ContactRow = {
  id: 'c1',
  account_id: 'a1',
  name: 'Sanjit Kumar Singha',
  phone: '+919876543210',
  email: null,
  company: null,
  instagram_id: null,
  messenger_id: null,
  created_via: null,
};

describe('phoneKey', () => {
  it('compares the spellings Zoho stores as one number', () => {
    expect(phoneKey('+91 98765 43210')).toBe('9876543210');
    expect(phoneKey('09876543210')).toBe('9876543210');
    expect(phoneKey('9876543210')).toBe('9876543210');
    expect(phoneKey('12345')).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe('splitName', () => {
  it('puts the last word in Last_Name, which Zoho requires', () => {
    expect(splitName(base)).toEqual({ First_Name: 'Sanjit Kumar', Last_Name: 'Singha' });
    expect(splitName({ ...base, name: 'Maya' })).toEqual({ Last_Name: 'Maya' });
  });

  it('treats a phone or channel id standing in for a name as no name', () => {
    expect(splitName({ ...base, name: '+919876543210' })).toBeNull();
    expect(splitName({ ...base, name: '17841400000', instagram_id: '17841400000' })).toBeNull();
    expect(splitName({ ...base, name: '' })).toBeNull();
  });
});

describe('contactPayload', () => {
  it('fills Zoho’s required fields when creating a Lead with no name', () => {
    const p = contactPayload({ ...base, name: '+919876543210' }, 'Leads', true);
    expect(p).toMatchObject({
      Last_Name: '+919876543210',
      Mobile: '+919876543210',
      Company: 'WhatsApp',
      Lead_Source: 'WhatsApp',
    });
    expect(p).not.toHaveProperty('First_Name');
  });

  it('never sends a placeholder name over a real one on update', () => {
    const p = contactPayload({ ...base, name: '+919876543210' }, 'Contacts', false);
    expect(p).not.toHaveProperty('Last_Name');
    expect(p).toEqual({ Mobile: '+919876543210' });
  });

  it('keeps Company and Lead_Source off Contacts', () => {
    const p = contactPayload({ ...base, company: 'Nebkern' }, 'Contacts', true);
    expect(p).not.toHaveProperty('Company');
    expect(p).not.toHaveProperty('Lead_Source');
  });
});

describe('contactHash', () => {
  it('changes with the synced fields only', () => {
    const h = contactHash(base);
    expect(contactHash({ ...base, created_via: 'conversation' })).toBe(h);
    expect(contactHash({ ...base, email: 'a@b.co' })).not.toBe(h);
  });
});

describe('mapStage', () => {
  const zoho = ['Qualification', 'Needs Analysis', 'Proposal/Price Quote', 'Closed Won', 'Closed Lost'];

  it('maps won and lost to Zoho’s closed stages whatever the stage is', () => {
    expect(mapStage(zoho, 'Proposal', 'won').stage).toBe('Closed Won');
    expect(mapStage(zoho, 'Proposal', 'lost').stage).toBe('Closed Lost');
  });

  it('matches names ignoring case and punctuation, then loosely', () => {
    expect(mapStage(zoho, 'needs analysis', 'open').stage).toBe('Needs Analysis');
    expect(mapStage(zoho, 'Proposal', 'open').stage).toBe('Proposal/Price Quote');
  });

  it('falls back to an open stage and says so', () => {
    const r = mapStage(zoho, 'Site visit', 'open');
    expect(r.stage).toBe('Qualification');
    expect(r.note).toMatch(/Site visit/);
  });
});

describe('zohoRecordUrl', () => {
  it('builds the CRM address for the connection’s data centre', () => {
    expect(zohoRecordUrl('https://www.zohoapis.in', '60012345', 'Leads', '99')).toBe(
      'https://crm.zoho.in/crm/org60012345/tab/Leads/99',
    );
    expect(zohoRecordUrl('https://www.zohoapis.com', '1', 'Contacts', '2')).toBe(
      'https://crm.zoho.com/crm/org1/tab/Contacts/2',
    );
    expect(zohoRecordUrl(null, '1', 'Deals', '2')).toBeNull();
  });
});

describe('zohoCrmUrl', () => {
  it('opens the org in its own data centre', () => {
    expect(zohoCrmUrl('https://www.zohoapis.in', '60012345')).toBe('https://crm.zoho.in/crm/org60012345/');
    expect(zohoCrmUrl('https://www.zohoapis.ca', '7')).toBe('https://crm.zohocloud.ca/crm/org7/');
    expect(zohoCrmUrl('https://www.zohoapis.com', null)).toBe('https://crm.zoho.com/crm/');
    expect(zohoCrmUrl(null, '1')).toBeNull();
  });
});
