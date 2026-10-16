import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./dispatch', () => ({ triggerAiReplyEngine: vi.fn(async () => {}) }));

import { triggerAiReplyEngine } from './dispatch';
import { sweepDueAiReplies } from './due-replies';

const trigger = vi.mocked(triggerAiReplyEngine);

/** A chainable stand-in for the two queries the sweep makes. */
function fakeDb(tables: Record<string, unknown[]>) {
  const calls: Record<string, string[]> = {};
  const db = {
    from(table: string) {
      calls[table] = [];
      const result = { data: tables[table] ?? [], error: null };
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      for (const method of ['select', 'not', 'lte', 'gte', 'order', 'limit', 'in']) {
        chain[method] = (...args: unknown[]) => {
          calls[table].push(`${method}:${JSON.stringify(args[0])}`);
          return chain;
        };
      }
      return chain;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

beforeEach(() => trigger.mockClear());

describe('sweepDueAiReplies', () => {
  it('hands each due conversation to the engine with its sequence and the WhatsApp owner', async () => {
    const { db, calls } = fakeDb({
      conversations: [
        { id: 'c1', account_id: 'a1', contact_id: 'p1', ai_debounce_seq: 7 },
        { id: 'c2', account_id: 'a2', contact_id: 'p2', ai_debounce_seq: '12' },
      ],
      whatsapp_config: [{ account_id: 'a1', user_id: 'owner-1' }],
    });

    const result = await sweepDueAiReplies(db, 'http://127.0.0.1:3000');

    expect(result).toEqual({ due: 2 });
    // a2 has no WhatsApp owner, so nothing to send through.
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith('http://127.0.0.1:3000', {
      accountId: 'a1',
      conversationId: 'c1',
      contactId: 'p1',
      configOwnerUserId: 'owner-1',
      messageText: '',
      dueSeq: 7,
    });
    // Only passed, still-pending deadlines are read.
    expect(calls.conversations).toContain('not:"ai_debounce_deadline"');
  });

  it('does nothing when no deadline is due', async () => {
    const { db } = fakeDb({ conversations: [] });
    expect(await sweepDueAiReplies(db, 'http://x')).toEqual({ due: 0 });
    expect(trigger).not.toHaveBeenCalled();
  });
});
