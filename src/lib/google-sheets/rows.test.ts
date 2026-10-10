import { describe, expect, it } from 'vitest';

import {
  TAB_HEADERS,
  campaignRow,
  contactRow,
  dealRow,
  literal,
  sheetTime,
} from './rows';
import { GOOGLE_SHEETS_SCOPES, buildGoogleAuthorizeUrl } from './client';

describe('sheetTime', () => {
  it('writes India time in a shape Sheets reads as a date-time', () => {
    // 10:30 UTC is 16:00 IST.
    expect(sheetTime('2026-10-10T10:30:00.000Z')).toBe('2026-10-10 16:00:00');
  });

  it('crosses midnight into the next Indian day', () => {
    expect(sheetTime('2026-10-10T20:00:00.000Z')).toBe('2026-10-11 01:30:00');
  });

  it('shows midnight as 00, not 24', () => {
    expect(sheetTime('2026-10-10T18:30:00.000Z')).toBe('2026-10-11 00:00:00');
  });

  it('is empty for nothing or nonsense', () => {
    expect(sheetTime(null)).toBe('');
    expect(sheetTime('')).toBe('');
    expect(sheetTime('not a date')).toBe('');
  });
});

describe('literal', () => {
  it('keeps a phone number as text, plus sign and all', () => {
    expect(literal('+919876543210')).toBe("'+919876543210");
    expect(literal('919876543210')).toBe("'919876543210");
  });

  it('stops a value being read as a formula', () => {
    expect(literal('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(literal('@mention')).toBe("'@mention");
  });

  it('leaves ordinary text alone', () => {
    expect(literal('Priya Sharma')).toBe('Priya Sharma');
    expect(literal(null)).toBe('');
  });
});

describe('row shapes', () => {
  it('match their tab headers column for column', () => {
    const contact = contactRow({
      createdAt: '2026-10-10T10:30:00.000Z',
      contactId: 'c1',
      name: 'Priya',
      phone: '+919876543210',
      email: 'priya@example.com',
      tags: ['vip', 'diwali'],
    });
    expect(contact).toHaveLength(TAB_HEADERS.Contacts.length);
    expect(contact).toEqual([
      '2026-10-10 16:00:00',
      'Priya',
      "'+919876543210",
      'priya@example.com',
      'vip, diwali',
      'c1',
    ]);

    const deal = dealRow({
      changedAt: '2026-10-10T10:30:00.000Z',
      dealId: 'd1',
      title: 'Bulk order',
      value: 45000,
      currency: 'INR',
      pipeline: 'Sales',
      fromStage: 'Qualified',
      toStage: 'Won',
      contactName: 'Priya',
      contactPhone: '+919876543210',
    });
    expect(deal).toHaveLength(TAB_HEADERS.Deals.length);
    expect(deal[2]).toBe('45000');
    expect(deal[6]).toBe('Won');

    const campaign = campaignRow({
      campaign: 'Diwali offer',
      template: 'diwali_offer',
      sentAt: '2026-10-10T10:30:00.000Z',
      contactName: 'Priya',
      phone: '+919876543210',
      status: 'read',
      deliveredAt: '2026-10-10T10:31:00.000Z',
      readAt: null,
      repliedAt: null,
      error: null,
    });
    expect(campaign).toHaveLength(TAB_HEADERS.Campaigns.length);
    expect(campaign[5]).toBe('read');
    expect(campaign[7]).toBe('');
  });
});

describe('buildGoogleAuthorizeUrl', () => {
  it('asks for lasting, file-limited access', () => {
    const u = new URL(
      buildGoogleAuthorizeUrl({
        clientId: 'client-123',
        redirectUri: 'https://instant.nebkern.com/api/integrations/google-sheets/oauth/callback',
        state: 'abc.tab',
      }),
    );
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('scope')).toBe(GOOGLE_SHEETS_SCOPES.join(' '));
    expect(u.searchParams.get('scope')).toContain('auth/drive.file');
    // Never the broad scope that needs Google's review.
    expect(u.searchParams.get('scope')).not.toContain('auth/spreadsheets');
    expect(u.searchParams.get('state')).toBe('abc.tab');
  });
});
