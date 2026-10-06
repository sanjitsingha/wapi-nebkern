import { describe, expect, it } from 'vitest';

import {
  basisFromBroadcast,
  buildCampaignFacts,
  parseOverview,
  type OverviewBroadcast,
  type OverviewRecipient,
} from './campaign-overview';
import { AiError } from './types';

const broadcast = (over: Partial<OverviewBroadcast> = {}): OverviewBroadcast => ({
  name: 'Diwali offer',
  status: 'completed',
  template_name: 'diwali_offer',
  template_language: 'en',
  created_at: '2026-10-01T04:00:00.000Z',
  total_recipients: 1000,
  sent_count: 1000,
  delivered_count: 900,
  read_count: 600,
  replied_count: 60,
  failed_count: 100,
  ...over,
});

const row = (over: Partial<OverviewRecipient> = {}): OverviewRecipient => ({
  status: 'delivered',
  sent_at: '2026-10-01T05:00:00.000Z',
  delivered_at: null,
  read_at: null,
  replied_at: null,
  error_message: null,
  ...over,
});

const NOW = new Date('2026-10-05T05:00:00.000Z');

describe('basisFromBroadcast', () => {
  it('caps each stage by the one before it', () => {
    // Mid-send, a read receipt can land before its delivery receipt.
    const b = basisFromBroadcast(
      broadcast({ delivered_count: 500, read_count: 600, replied_count: 700 }),
    );
    expect(b.read).toBe(500);
    expect(b.replied).toBe(500);
  });

  it('never lets failed + delivered exceed the total', () => {
    const b = basisFromBroadcast(broadcast({ delivered_count: 950, failed_count: 100 }));
    expect(b.delivered + b.failed).toBeLessThanOrEqual(b.total);
  });
});

describe('buildCampaignFacts', () => {
  it('reports the page rates with the page denominators', () => {
    const f = buildCampaignFacts({ broadcast: broadcast(), recipients: [], template: null, now: NOW });
    expect(f.rates_pct.delivery_of_sent).toBe(90);
    expect(f.rates_pct.read_of_delivered).toBe(66.7);
    expect(f.rates_pct.reply_of_delivered).toBe(6.7);
    expect(f.rates_pct.reply_of_read).toBe(10);
    expect(f.rates_pct.failure_of_recipients).toBe(10);
  });

  it('groups a known Meta code by code, with its meaning attached', () => {
    const f = buildCampaignFacts({
      broadcast: broadcast(),
      recipients: [
        row({ status: 'failed', error_message: '[Code 131026] Message Undeliverable — +91 98…' }),
        row({ status: 'failed', error_message: '[Code 131026] Message Undeliverable — +91 97…' }),
        row({ status: 'failed', error_message: 'Invalid phone number format' }),
      ],
      template: null,
      now: NOW,
    });
    expect(f.failure_reasons[0]).toMatchObject({
      reason: '[Code 131026] Message Undeliverable',
      count: 2,
    });
    expect(f.failure_reasons[0].meaning).toBeTruthy();
    expect(f.failure_reasons[1]).toEqual({ reason: 'Invalid phone number format', count: 1 });
  });

  it('measures read and reply delays from the send', () => {
    const f = buildCampaignFacts({
      broadcast: broadcast(),
      recipients: [
        row({ read_at: '2026-10-01T05:10:00.000Z' }),
        row({ read_at: '2026-10-01T05:30:00.000Z', replied_at: '2026-10-01T06:00:00.000Z' }),
        row({ read_at: '2026-10-01T08:00:00.000Z' }),
      ],
      template: null,
      now: NOW,
    });
    expect(f.timing.median_minutes_send_to_read).toBe(30);
    expect(f.timing.reads_within_1h_pct).toBe(66.7);
    expect(f.timing.median_minutes_send_to_reply).toBe(60);
  });

  it('warns when results are early or the sample is small', () => {
    const f = buildCampaignFacts({
      broadcast: broadcast({ total_recipients: 40, sent_count: 40, delivered_count: 30, read_count: 10, replied_count: 1, failed_count: 2 }),
      recipients: [row({ sent_at: '2026-10-05T03:00:00.000Z' })],
      template: null,
      now: NOW,
    });
    expect(f.caveats.join(' ')).toMatch(/2 hours ago/);
    expect(f.caveats.join(' ')).toMatch(/Small sample/);
  });

  it('says the campaign is still sending rather than "hours ago"', () => {
    const f = buildCampaignFacts({
      broadcast: broadcast({ status: 'sending' }),
      recipients: [row({ sent_at: '2026-10-05T04:00:00.000Z' })],
      template: null,
      now: NOW,
    });
    expect(f.caveats[0]).toMatch(/still sending/);
    expect(f.caveats.join(' ')).not.toMatch(/hours ago/);
  });
});

describe('parseOverview', () => {
  const json = {
    headline: 'Strong reach, few replies.',
    summary: '90% of messages were delivered and two in three were read. Only 6.7% replied.',
    suggestions: ['Follow up with readers who did not reply.', 'Add a quick-reply button.'],
  };

  it('reads plain JSON', () => {
    expect(parseOverview(JSON.stringify(json))).toEqual({
      headline: 'Strong reach, few replies.',
      summary: '90% of messages were delivered and two in three were read. Only 6.7% replied.',
      suggestions: ['Follow up with readers who did not reply.', 'Add a quick-reply button.'],
    });
  });

  it('reads JSON inside a code fence with prose around it', () => {
    const raw = `Sure! Here it is:\n\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``;
    expect(parseOverview(raw).headline).toBe('Strong reach, few replies.');
  });

  it('strips stray markdown and folds line breaks in the paragraph', () => {
    const out = parseOverview(
      JSON.stringify({ headline: '**Good**', summary: 'Fast reads.\n\nFew replies.', suggestions: ['- Retry'] }),
    );
    expect(out.headline).toBe('Good');
    expect(out.summary).toBe('Fast reads. Few replies.');
    expect(out.suggestions).toEqual(['Retry']);
  });

  it('turns the old went_well / went_wrong lists into the paragraph', () => {
    const out = parseOverview(
      JSON.stringify({ headline: 'x', went_well: ['90% delivered.'], went_wrong: ['Few replies.'] }),
    );
    expect(out.summary).toBe('90% delivered. Few replies.');
    expect(out.suggestions).toEqual([]);
  });

  it('drops non-string suggestions and caps how many', () => {
    const out = parseOverview(
      JSON.stringify({ headline: 'x', summary: 's', suggestions: [1, null, 'a', 'b', 'c', 'd', 'e', 'f'] }),
    );
    expect(out.suggestions).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('throws a typed error when there is no usable object', () => {
    expect(() => parseOverview('I could not analyse this.')).toThrow(AiError);
    expect(() => parseOverview('{"summary": "no headline"}')).toThrow(AiError);
    expect(() => parseOverview('{not json}')).toThrow(AiError);
  });
});
