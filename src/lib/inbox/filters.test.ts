import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  activeCount,
  customerWroteLast,
  dateWindow,
  matchesFilters,
  needsHuman,
  type FilterableConversation,
  type InboxFilters,
} from './filters';

const now = new Date(2026, 9, 14, 15, 0, 0).getTime(); // 14 Oct 2026, 15:00 local

const conv = (over: Partial<FilterableConversation> = {}): FilterableConversation => ({
  status: 'open',
  unread_count: 0,
  created_at: new Date(2026, 9, 14, 9, 0).toISOString(),
  last_message_at: new Date(2026, 9, 14, 14, 0).toISOString(),
  customer_replied_at: new Date(2026, 9, 14, 14, 0).toISOString(),
  assigned_agent_id: null,
  assigned_flow_id: null,
  ai_agent_assigned: false,
  contact: { contact_tags: [{ tag_id: 'vip' }] },
  ...over,
});

const f = (over: Partial<InboxFilters>): InboxFilters => ({ ...EMPTY_FILTERS, ...over });

describe('matchesFilters', () => {
  it('lets everything through with no condition set', () => {
    expect(matchesFilters(conv(), EMPTY_FILTERS, now)).toBe(true);
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
  });

  it('ORs the values within one condition', () => {
    expect(matchesFilters(conv(), f({ tags: ['lead', 'vip'] }), now)).toBe(true);
    expect(matchesFilters(conv(), f({ tags: ['lead'] }), now)).toBe(false);
    expect(matchesFilters(conv({ status: 'pending' }), f({ statuses: ['open', 'pending'] }), now)).toBe(true);
  });

  it('needs every condition with ALL, any one with ANY', () => {
    const both = { tags: ['vip'], statuses: ['closed' as const] };
    expect(matchesFilters(conv(), f({ ...both, match: 'all' }), now)).toBe(false);
    expect(matchesFilters(conv(), f({ ...both, match: 'any' }), now)).toBe(true);
    expect(activeCount(f(both))).toBe(2);
  });

  it('reads unread from the unread count', () => {
    expect(matchesFilters(conv({ unread_count: 3 }), f({ read: ['unread'] }), now)).toBe(true);
    expect(matchesFilters(conv({ unread_count: 0 }), f({ read: ['unread'] }), now)).toBe(false);
  });

  it('matches assignees, including unassigned and one teammate', () => {
    expect(matchesFilters(conv(), f({ assignees: ['unassigned'] }), now)).toBe(true);
    expect(matchesFilters(conv({ assigned_agent_id: 'u1' }), f({ assignees: ['user:u1'] }), now)).toBe(true);
    expect(matchesFilters(conv({ assigned_agent_id: 'u2' }), f({ assignees: ['user:u1'] }), now)).toBe(false);
    expect(matchesFilters(conv({ ai_agent_assigned: true }), f({ assignees: ['ai'] }), now)).toBe(true);
    expect(matchesFilters(conv({ assigned_flow_id: 'flow' }), f({ assignees: ['bot', 'unassigned'] }), now)).toBe(true);
  });

  it('tells who is waiting on whom', () => {
    const waitingForUs = conv();
    const weReplied = conv({ last_message_at: new Date(2026, 9, 14, 14, 30).toISOString() });
    expect(customerWroteLast(waitingForUs)).toBe(true);
    expect(customerWroteLast(weReplied)).toBe(false);
    expect(matchesFilters(waitingForUs, f({ awaiting: ['us'] }), now)).toBe(true);
    expect(matchesFilters(weReplied, f({ awaiting: ['customer'] }), now)).toBe(true);
  });

  it('knows whether WhatsApp\'s 24-hour window is open', () => {
    const recent = conv();
    const old = conv({ customer_replied_at: new Date(2026, 9, 12, 9, 0).toISOString() });
    expect(matchesFilters(recent, f({ window: ['open'] }), now)).toBe(true);
    expect(matchesFilters(old, f({ window: ['closed'] }), now)).toBe(true);
    expect(matchesFilters(conv({ customer_replied_at: null }), f({ window: ['open'] }), now)).toBe(false);
  });

  it('filters by when a chat started and when it was last active', () => {
    expect(matchesFilters(conv(), f({ created: { preset: 'today' } }), now)).toBe(true);
    expect(matchesFilters(conv(), f({ created: { preset: 'yesterday' } }), now)).toBe(false);
    const lastWeek = conv({ last_message_at: new Date(2026, 9, 9, 10, 0).toISOString() });
    expect(matchesFilters(lastWeek, f({ lastActive: { preset: '7d' } }), now)).toBe(true);
    expect(matchesFilters(lastWeek, f({ lastActive: { preset: 'today' } }), now)).toBe(false);
  });
});

describe('dateWindow', () => {
  it('makes a custom range inclusive of its last day', () => {
    const [from, to] = dateWindow({ preset: 'custom', from: '2026-10-10', to: '2026-10-14' }, now);
    expect(from).toBe(new Date(2026, 9, 10).getTime());
    expect(to).toBe(new Date(2026, 9, 15).getTime());
    const [openFrom, openTo] = dateWindow({ preset: 'custom', to: '2026-10-14' }, now);
    expect(openFrom).toBe(-Infinity);
    expect(openTo).toBe(new Date(2026, 9, 15).getTime());
  });
});

describe('needsHuman', () => {
  const handedOff = { ai_autoreply_disabled: true };

  it('is a handed-off chat nobody has picked up', () => {
    expect(needsHuman(conv(handedOff))).toBe(true);
    expect(needsHuman(conv({ ...handedOff, status: 'pending' }))).toBe(true);
  });

  it('is not one Maya is still answering', () => {
    expect(needsHuman(conv())).toBe(false);
    expect(needsHuman(conv({ ai_autoreply_disabled: null }))).toBe(false);
  });

  it('stops once a teammate or a bot has it', () => {
    expect(needsHuman(conv({ ...handedOff, assigned_agent_id: 'user-1' }))).toBe(false);
    expect(needsHuman(conv({ ...handedOff, assigned_flow_id: 'flow-1' }))).toBe(false);
  });

  it('stops once the chat is closed', () => {
    expect(needsHuman(conv({ ...handedOff, status: 'closed' }))).toBe(false);
  });
});
