// ============================================================
// The inbox list's filters: one set of conditions, matched ALL or ANY.
//
// Pure, so the menu (components/inbox/inbox-filter-menu.tsx) and the
// list share one definition of what each condition means, and the
// date and "awaiting" rules are tested without a browser.
//
// Within a condition the picked values are OR-ed (Labels "VIP" or
// "Lead"); across conditions it is ALL (every condition) or ANY (at
// least one), per the menu's toggle. A condition with nothing picked
// does not take part.
// ============================================================

import type { ConversationStatus } from '@/types';

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface DateCondition {
  preset: DatePreset;
  /** 'yyyy-MM-dd', inclusive — for 'custom'. Either may be blank. */
  from?: string;
  to?: string;
}

export interface InboxFilters {
  match: 'all' | 'any';
  /** Tag ids on the contact. */
  tags: string[];
  statuses: ConversationStatus[];
  read: ('unread' | 'read')[];
  /** 'us': the customer wrote last and is waiting for us.
   *  'customer': we wrote last. */
  awaiting: ('us' | 'customer')[];
  /** 'unassigned' | 'ai' | 'bot' | 'user:<user_id>' */
  assignees: string[];
  created: DateCondition | null;
  lastActive: DateCondition | null;
  /** WhatsApp's 24-hour customer-service window. */
  window: ('open' | 'closed')[];
}

export const EMPTY_FILTERS: InboxFilters = {
  match: 'all',
  tags: [],
  statuses: [],
  read: [],
  awaiting: [],
  assignees: [],
  created: null,
  lastActive: null,
  window: [],
};

export type FilterKey = Exclude<keyof InboxFilters, 'match'>;

/** The conversation fields the filters read. */
export interface FilterableConversation {
  status: ConversationStatus;
  unread_count: number;
  created_at: string;
  last_message_at?: string | null;
  customer_replied_at?: string | null;
  assigned_agent_id?: string | null;
  assigned_flow_id?: string | null;
  ai_agent_assigned?: boolean | null;
  ai_autoreply_disabled?: boolean | null;
  contact?: { contact_tags?: { tag_id: string }[] | null } | null;
}

/**
 * Maya handed this chat to a human (lib/ai/auto-reply.ts) and nobody has
 * picked it up — no teammate, and no bot it was passed on to. The
 * inbox's "Needs a human" filter. A closed chat is finished, so it no
 * longer waits on anyone.
 */
export function needsHuman(c: FilterableConversation): boolean {
  return (
    !!c.ai_autoreply_disabled &&
    !c.assigned_agent_id &&
    !c.assigned_flow_id &&
    c.status !== 'closed'
  );
}

export function isActive(filters: InboxFilters, key: FilterKey): boolean {
  const v = filters[key];
  return Array.isArray(v) ? v.length > 0 : v !== null;
}

export function activeCount(filters: InboxFilters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof InboxFilters)[]).filter(
    (k) => k !== 'match' && isActive(filters, k as FilterKey),
  ).length;
}

const DAY_MS = 24 * 3600 * 1000;

function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 'yyyy-MM-dd' as the start of that local day. */
function localDate(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/** [from, to) for a date condition, in ms. */
export function dateWindow(c: DateCondition, now: number): [number, number] {
  const today = startOfLocalDay(now);
  switch (c.preset) {
    case 'today':
      return [today, Infinity];
    case 'yesterday':
      return [today - DAY_MS, today];
    case '7d':
      return [now - 7 * DAY_MS, Infinity];
    case '30d':
      return [now - 30 * DAY_MS, Infinity];
    case 'custom': {
      const from = c.from ? localDate(c.from) : -Infinity;
      // Inclusive "to": up to the start of the following day.
      const to = c.to ? localDate(c.to) + DAY_MS : Infinity;
      return [from, to];
    }
  }
}

function inDate(iso: string | null | undefined, c: DateCondition, now: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const [from, to] = dateWindow(c, now);
  return t >= from && t < to;
}

/** The customer wrote last — their message is the newest one. */
export function customerWroteLast(c: FilterableConversation): boolean {
  if (!c.customer_replied_at || !c.last_message_at) return false;
  // A second of slack: both are stamped from the same inbound message,
  // by separate writes.
  return Date.parse(c.customer_replied_at) >= Date.parse(c.last_message_at) - 1000;
}

function assignedAs(c: FilterableConversation): string[] {
  const out: string[] = [];
  if (c.ai_agent_assigned) out.push('ai');
  if (c.assigned_flow_id) out.push('bot');
  if (c.assigned_agent_id) out.push(`user:${c.assigned_agent_id}`);
  if (out.length === 0) out.push('unassigned');
  return out;
}

/** Each active condition's verdict for one conversation. */
function verdicts(c: FilterableConversation, f: InboxFilters, now: number): boolean[] {
  const out: boolean[] = [];
  if (f.tags.length) {
    const tags = new Set((c.contact?.contact_tags ?? []).map((t) => t.tag_id));
    out.push(f.tags.some((t) => tags.has(t)));
  }
  if (f.statuses.length) out.push(f.statuses.includes(c.status));
  if (f.read.length) out.push(f.read.includes(c.unread_count > 0 ? 'unread' : 'read'));
  if (f.awaiting.length) {
    out.push(f.awaiting.includes(customerWroteLast(c) ? 'us' : 'customer'));
  }
  if (f.assignees.length) {
    const as = assignedAs(c);
    out.push(f.assignees.some((a) => as.includes(a)));
  }
  if (f.created) out.push(inDate(c.created_at, f.created, now));
  if (f.lastActive) out.push(inDate(c.last_message_at, f.lastActive, now));
  if (f.window.length) {
    const open =
      !!c.customer_replied_at && now - Date.parse(c.customer_replied_at) < DAY_MS;
    out.push(f.window.includes(open ? 'open' : 'closed'));
  }
  return out;
}

export function matchesFilters(
  c: FilterableConversation,
  f: InboxFilters,
  now: number = Date.now(),
): boolean {
  const v = verdicts(c, f, now);
  if (v.length === 0) return true;
  return f.match === 'all' ? v.every(Boolean) : v.some(Boolean);
}
