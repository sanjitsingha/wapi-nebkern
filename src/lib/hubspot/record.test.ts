import { describe, expect, it } from 'vitest';

import { timelineBody } from './chat-log';
import { personFromProperties } from './ingest';
import { humanise, pickHubSpotContact, pickHubSpotDeals } from './record';

describe('humanise', () => {
  it('reads lifecycle stages and enum values', () => {
    expect(humanise('marketingqualifiedlead')).toBe('Marketing qualified lead');
    expect(humanise('IN_PROGRESS')).toBe('In progress');
    expect(humanise('')).toBeNull();
  });
});

describe('pickHubSpotContact', () => {
  it('joins the name and drops blanks', () => {
    const c = pickHubSpotContact({ firstname: 'Asha', lastname: ' Rao ', email: '', lifecyclestage: 'lead' });
    expect(c.name).toBe('Asha Rao');
    expect(c.email).toBeNull();
    expect(c.lifecycle).toBe('Lead');
  });
});

describe('pickHubSpotDeals', () => {
  it('labels stages and keeps an unknown stage id visible', () => {
    const deals = pickHubSpotDeals(
      [
        { id: '1', properties: { dealname: 'A', amount: '1200', dealstage: 's1', closedate: '2026-11-01' } },
        { id: '2', properties: { dealname: 'B', amount: '', dealstage: 'mystery', closedate: '2026-12-01' } },
      ],
      new Map([['s1', 'Contract sent']]),
    );
    expect(deals.map((d) => [d.id, d.stage, d.amount])).toEqual([
      ['2', 'mystery', null],
      ['1', 'Contract sent', 1200],
    ]);
  });
});

describe('personFromProperties', () => {
  it('prefers the mobile and normalises it', () => {
    expect(
      personFromProperties({ mobilephone: '098765 43210', phone: '+91 11 2345 6789', firstname: 'Asha' }),
    ).toEqual({ phone: '919876543210', name: 'Asha', email: null });
  });

  it('has no phone when HubSpot has none', () => {
    expect(personFromProperties({ email: 'x@y.z' }).phone).toBeNull();
  });
});

describe('timelineBody', () => {
  it('escapes chat text into paragraphs', () => {
    expect(timelineBody('WhatsApp chat', 'Asha: <b>hi</b>\nTeam: ok & thanks')).toBe(
      '<p><strong>WhatsApp chat</strong></p><p>Asha: &lt;b&gt;hi&lt;/b&gt;</p><p>Team: ok &amp; thanks</p>',
    );
  });
});
