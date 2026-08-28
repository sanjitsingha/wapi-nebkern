import { describe, expect, it } from 'vitest';

import {
  activeMentionQuery,
  mentionPlainText,
  mentionToken,
  parseMentions,
  resolveMentions,
  segmentBody,
} from './mentions';
import type { MentionableMember } from '@/types';

const ARJUN = '11111111-1111-4111-8111-111111111111';
const PRIYA = '22222222-2222-4222-8222-222222222222';
const OUTSIDER = '33333333-3333-4333-8333-333333333333';

const MEMBERS: MentionableMember[] = [
  { user_id: ARJUN, full_name: 'Arjun Nair', email: 'a@x.com' },
  { user_id: PRIYA, full_name: 'Priya Raman', email: 'p@x.com' },
];

describe('parseMentions', () => {
  it('finds a mention', () => {
    expect(parseMentions(`hey @[Priya Raman](${PRIYA}) look`)).toEqual([
      { label: 'Priya Raman', userId: PRIYA },
    ]);
  });

  it('deduplicates the same person mentioned twice', () => {
    const body = `@[Priya Raman](${PRIYA}) and again @[Priya Raman](${PRIYA})`;
    expect(parseMentions(body)).toHaveLength(1);
  });

  it('ignores a bare @name with no token', () => {
    expect(parseMentions('hey @priya can you look')).toEqual([]);
  });

  it('ignores a non-uuid target', () => {
    expect(parseMentions('@[Someone](not-a-uuid)')).toEqual([]);
  });
});

describe('resolveMentions — the notification gate', () => {
  it('returns members of this account', () => {
    const body = `@[Priya Raman](${PRIYA})`;
    expect(resolveMentions(body, MEMBERS, ARJUN)).toEqual([PRIYA]);
  });

  it('DROPS a user who is not on the account', () => {
    // A hand-written token naming someone from another tenant must not
    // produce a notification.
    const body = `@[Outsider](${OUTSIDER})`;
    expect(resolveMentions(body, MEMBERS, ARJUN)).toEqual([]);
  });

  it('drops the author mentioning themselves', () => {
    const body = `@[Arjun Nair](${ARJUN}) note to self`;
    expect(resolveMentions(body, MEMBERS, ARJUN)).toEqual([]);
  });

  it('is case-insensitive on the uuid', () => {
    const body = `@[Priya Raman](${PRIYA.toUpperCase()})`;
    expect(resolveMentions(body, MEMBERS, ARJUN)).toEqual([PRIYA]);
  });
});

describe('segmentBody', () => {
  it('splits text and mentions in order', () => {
    expect(segmentBody(`hi @[Priya Raman](${PRIYA}) ok`)).toEqual([
      { kind: 'text', text: 'hi ' },
      { kind: 'mention', label: 'Priya Raman', userId: PRIYA },
      { kind: 'text', text: ' ok' },
    ]);
  });

  it('handles a body that is only a mention', () => {
    expect(segmentBody(`@[Priya Raman](${PRIYA})`)).toEqual([
      { kind: 'mention', label: 'Priya Raman', userId: PRIYA },
    ]);
  });

  it('returns plain text unchanged', () => {
    expect(segmentBody('no mentions here')).toEqual([
      { kind: 'text', text: 'no mentions here' },
    ]);
  });
});

describe('mentionPlainText', () => {
  it('renders the readable form', () => {
    expect(mentionPlainText(`ping @[Priya Raman](${PRIYA}) please`)).toBe(
      'ping @Priya Raman please',
    );
  });
});

describe('mentionToken', () => {
  it('builds the stored form', () => {
    expect(mentionToken(MEMBERS[1])).toBe(`@[Priya Raman](${PRIYA})`);
  });

  it('strips brackets that would corrupt the token', () => {
    expect(
      mentionToken({ user_id: PRIYA, full_name: 'Priya [Ops]', email: '' }),
    ).toBe(`@[Priya Ops](${PRIYA})`);
  });
});

describe('activeMentionQuery — when the picker opens', () => {
  it('opens on @ at the start', () => {
    expect(activeMentionQuery('@pri', 4)).toEqual({ query: 'pri', start: 0 });
  });

  it('opens on @ after a space', () => {
    expect(activeMentionQuery('hey @pri', 8)).toEqual({
      query: 'pri',
      start: 4,
    });
  });

  it('does NOT open inside an email address', () => {
    expect(activeMentionQuery('mail priya@example.com', 22)).toBeNull();
  });

  it('closes once a space is typed', () => {
    expect(activeMentionQuery('@priya raman', 12)).toBeNull();
  });

  it('returns null with no @ at all', () => {
    expect(activeMentionQuery('plain text', 10)).toBeNull();
  });
});
