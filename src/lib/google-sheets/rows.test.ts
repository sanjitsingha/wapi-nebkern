import { describe, expect, it } from 'vitest';

import {
  SHEET_EVENT_TYPES,
  TAB_HEADERS,
  assignmentRow,
  campaignRow,
  contactRow,
  dealRow,
  isSheetEventType,
  literal,
  messageRow,
  sampleRow,
  sheetTime,
  sheetTypeForWebhookEvent,
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

describe('event types', () => {
  it('every type has a header row and a sample row of the same width', () => {
    for (const e of SHEET_EVENT_TYPES) {
      expect(TAB_HEADERS[e.type].length).toBeGreaterThan(0);
      expect(sampleRow(e.type)).toHaveLength(TAB_HEADERS[e.type].length);
    }
  });

  it('maps app events to the sheet that receives them', () => {
    expect(sheetTypeForWebhookEvent('contact.created')).toBe('contacts');
    expect(sheetTypeForWebhookEvent('message.received')).toBe('messages');
    expect(sheetTypeForWebhookEvent('conversation.assigned')).toBe('assignments');
    expect(sheetTypeForWebhookEvent('deal.stage_changed')).toBe('deals');
    // Campaign results are swept, never fed by an event.
    expect(sheetTypeForWebhookEvent('broadcast.sent')).toBeNull();
  });

  it('only accepts the known types', () => {
    expect(isSheetEventType('messages')).toBe(true);
    expect(isSheetEventType('tickets')).toBe(false);
    expect(isSheetEventType(undefined)).toBe(false);
  });
});

describe('row shapes', () => {
  it('contacts', () => {
    const row = contactRow({
      createdAt: '2026-10-10T10:30:00.000Z',
      contactId: 'c1',
      name: 'Priya',
      phone: '+919876543210',
      email: 'priya@example.com',
      tags: ['vip', 'diwali'],
    });
    expect(row).toHaveLength(TAB_HEADERS.contacts.length);
    expect(row).toEqual([
      '2026-10-10 16:00:00',
      'Priya',
      "'+919876543210",
      'priya@example.com',
      'vip, diwali',
      'c1',
    ]);
  });

  it('messages, with very long text cut short', () => {
    const row = messageRow({
      receivedAt: '2026-10-10T10:30:00.000Z',
      contactName: 'Priya',
      phone: '+919876543210',
      type: 'text',
      text: 'x'.repeat(6000),
      conversationId: 'conv1',
      messageId: 'm1',
    });
    expect(row).toHaveLength(TAB_HEADERS.messages.length);
    expect(row[3]).toBe('text');
    expect(row[4].length).toBeLessThanOrEqual(5001);
  });

  it('assignments', () => {
    const row = assignmentRow({
      assignedAt: '2026-10-10T10:30:00.000Z',
      contactName: 'Priya',
      phone: '+919876543210',
      agentName: 'Rahul',
      agentEmail: 'rahul@example.com',
      conversationId: 'conv1',
    });
    expect(row).toHaveLength(TAB_HEADERS.assignments.length);
    expect(row[3]).toBe('Rahul');
  });

  it('deals and campaigns match their headers', () => {
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
    expect(deal).toHaveLength(TAB_HEADERS.deals.length);
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
    expect(campaign).toHaveLength(TAB_HEADERS.campaigns.length);
    expect(campaign[5]).toBe('read');
    expect(campaign[7]).toBe('');
  });
});

describe('buildGoogleAuthorizeUrl', () => {
  it('asks for lasting, file-limited access and always shows the account chooser', () => {
    const u = new URL(
      buildGoogleAuthorizeUrl({
        clientId: 'client-123',
        redirectUri: 'https://instant.nebkern.com/api/integrations/google-sheets/oauth/callback',
        state: 'abc.tab',
      }),
    );
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('select_account consent');
    expect(u.searchParams.get('scope')).toBe(GOOGLE_SHEETS_SCOPES.join(' '));
    expect(u.searchParams.get('scope')).toContain('auth/drive.file');
    // Never the broad scope that needs Google's review.
    expect(u.searchParams.get('scope')).not.toContain('auth/spreadsheets');
    expect(u.searchParams.get('state')).toBe('abc.tab');
  });
});
