import { describe, expect, it } from 'vitest';

import { pickZohoDeals, pickZohoRecord } from './record';

describe('pickZohoRecord', () => {
  it('reads a Lead', () => {
    const v = pickZohoRecord(
      {
        id: '1',
        First_Name: 'Maya',
        Last_Name: 'Sen',
        Owner: { name: 'Sanjit Singha', id: '9' },
        Email: 'maya@example.com',
        Mobile: '+91 98765 43210',
        Company: 'Nebkern',
        Designation: 'Founder',
        Lead_Status: 'Contacted',
        Lead_Source: 'WhatsApp',
        City: 'Guwahati',
        Created_Time: '2026-10-12T18:20:00+05:30',
      },
      'Leads',
    );
    expect(v).toMatchObject({
      name: 'Maya Sen',
      owner: 'Sanjit Singha',
      company: 'Nebkern',
      title: 'Founder',
      status: 'Contacted',
      source: 'WhatsApp',
      city: 'Guwahati',
    });
  });

  it('reads a Contact through its lookups, with no lead status', () => {
    const v = pickZohoRecord(
      {
        Full_Name: 'Maya Sen',
        Account_Name: { name: 'Nebkern Technology', id: '5' },
        Title: 'CTO',
        Mailing_City: 'Kolkata',
        Lead_Status: 'Contacted',
      },
      'Contacts',
    );
    expect(v.company).toBe('Nebkern Technology');
    expect(v.title).toBe('CTO');
    expect(v.city).toBe('Kolkata');
    expect(v.status).toBeNull();
  });

  it('treats blanks and Zoho’s -None- as nothing', () => {
    const v = pickZohoRecord({ Last_Name: 'Rao', Lead_Source: '-None-', Email: '  ' }, 'Leads');
    expect(v.name).toBe('Rao');
    expect(v.source).toBeNull();
    expect(v.email).toBeNull();
  });
});

describe('pickZohoDeals', () => {
  it('keeps id, name, stage, amount and close date, five at most', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      id: String(i + 1),
      Deal_Name: `Deal ${i + 1}`,
      Stage: 'Negotiation',
      Amount: i === 0 ? '50000' : 1000,
      Closing_Date: '2026-11-01',
      $currency_symbol: '₹',
    }));
    const deals = pickZohoDeals(rows);
    expect(deals).toHaveLength(5);
    expect(deals[0]).toEqual({
      id: '1',
      name: 'Deal 1',
      stage: 'Negotiation',
      amount: 50000,
      currency: '₹',
      closingDate: '2026-11-01',
    });
  });

  it('skips rows without an id and amounts that are not numbers', () => {
    const deals = pickZohoDeals([{ Deal_Name: 'x' }, { id: '2', Amount: 'n/a' }]);
    expect(deals).toHaveLength(1);
    expect(deals[0].amount).toBeNull();
  });
});
