import { describe, expect, it } from 'vitest';

import { buildChatNotes, isChatDue, messageText, type ChatLine } from './chat-log';

describe('messageText', () => {
  it('writes text as is and labels everything else', () => {
    expect(messageText({ sender_type: 'customer', content_type: 'text', content_text: ' Hi ', created_at: '' })).toBe('Hi');
    expect(messageText({ sender_type: 'customer', content_type: 'image', content_text: 'menu', created_at: '' })).toBe('[Image] menu');
    expect(messageText({ sender_type: 'customer', content_type: 'audio', created_at: '' })).toBe('[Voice note]');
    expect(messageText({ sender_type: 'agent', content_type: 'template', template_name: 'welcome', created_at: '' })).toBe('[Template: welcome]');
    expect(messageText({ sender_type: 'customer', content_type: 'interactive', content_text: 'Yes', created_at: '' })).toBe('↩ Yes');
  });
});

describe('buildChatNotes', () => {
  const at = (min: number) => new Date(Date.parse('2026-10-14T04:30:00Z') + min * 60_000).toISOString();
  const lines: ChatLine[] = [
    { at: at(0), who: 'Maya', text: 'Hi, price for the 2BHK?' },
    { at: at(2), who: 'Sanjit', text: 'Sharing it now' },
    { at: at(3), who: 'Maya', text: 'Thanks' },
  ];

  it('writes one note per stretch, newest message as its cursor', () => {
    const notes = buildChatNotes(lines, 'WhatsApp');
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toMatch(/^WhatsApp chat · /);
    expect(notes[0].content.split('\n')).toHaveLength(3);
    expect(notes[0].content).toContain('Maya: Hi, price for the 2BHK?');
    expect(notes[0].until).toBe(at(3));
  });

  it('splits a long stretch, each part carrying its own cursor', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ at: at(i), who: 'Maya', text: 'x'.repeat(40) }));
    const notes = buildChatNotes(many, 'WhatsApp', 600);
    expect(notes.length).toBeGreaterThan(1);
    for (const n of notes) expect(n.content.length).toBeLessThanOrEqual(600);
    expect(notes[0].title).toMatch(/\(1\/\d+\)$/);
    expect(notes[notes.length - 1].until).toBe(at(49));
  });

  it('cuts a single message too long for one note', () => {
    const notes = buildChatNotes([{ at: at(0), who: 'Maya', text: 'y'.repeat(2000) }], 'WhatsApp', 500);
    expect(notes).toHaveLength(1);
    expect(notes[0].content.length).toBeLessThanOrEqual(500);
    expect(notes[0].content.endsWith('…')).toBe(true);
  });
});

describe('isChatDue', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');

  it('is due when the customer wrote after the last note', () => {
    expect(isChatDue({ customer_replied_at: '2026-10-14T11:00:00Z' }, undefined, now)).toBe(true);
    expect(
      isChatDue(
        { customer_replied_at: '2026-10-14T11:00:00Z' },
        { logged_until: '2026-10-14T10:00:00Z', checked_at: '2026-10-14T10:00:00Z' },
        now,
      ),
    ).toBe(true);
  });

  it('is not due once logged past the customer’s last message', () => {
    expect(
      isChatDue(
        { customer_replied_at: '2026-10-14T11:00:00Z' },
        { logged_until: '2026-10-14T11:00:00Z', checked_at: null },
        now,
      ),
    ).toBe(false);
    expect(isChatDue({ customer_replied_at: null }, undefined, now)).toBe(false);
  });

  it('waits before looking again at one it could not log', () => {
    expect(
      isChatDue(
        { customer_replied_at: '2026-10-14T11:00:00Z' },
        { logged_until: null, checked_at: '2026-10-14T11:50:00Z' },
        now,
      ),
    ).toBe(false);
  });
});
