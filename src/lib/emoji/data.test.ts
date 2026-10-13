import { describe, expect, it } from 'vitest';

import { EMOJI_GROUPS } from './data';

// The data is generated from Unicode's emoji-test.txt. These pin what
// the picker relies on, so a regeneration that goes wrong fails here
// rather than in someone's reaction menu.
describe('EMOJI_GROUPS', () => {
  const all = EMOJI_GROUPS.flatMap((g) => g.emojis);

  it('has the nine picker groups, in order, none empty', () => {
    expect(EMOJI_GROUPS.map((g) => g.id)).toEqual([
      'smileys',
      'people',
      'animals',
      'food',
      'travel',
      'activities',
      'objects',
      'symbols',
      'flags',
    ]);
    for (const g of EMOJI_GROUPS) expect(g.emojis.length).toBeGreaterThan(50);
  });

  it('lists each emoji once, with a name to search by', () => {
    expect(new Set(all.map(([e]) => e)).size).toBe(all.length);
    for (const [, name] of all) expect(name.length).toBeGreaterThan(0);
  });

  it('leaves out skin-tone variants', () => {
    const skin = /[\u{1F3FB}-\u{1F3FF}]/u;
    expect(all.some(([e]) => skin.test(e))).toBe(false);
  });

  it('contains the quick reactions, in the form they are sent', () => {
    const set = new Set(all.map(([e]) => e));
    for (const e of ['👍', '❤️', '😂', '😮', '😢', '🙏']) expect(set.has(e)).toBe(true);
  });
});
