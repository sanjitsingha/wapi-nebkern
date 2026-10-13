import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from './defaults';

describe('buildSystemPrompt — the composer\'s instruction', () => {
  it('carries what the agent asked for, as the business\'s words', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'draft',
      instruction: '  ask for their delivery address  ',
    });
    expect(prompt).toContain('"ask for their delivery address"');
    expect(prompt).toMatch(/from the business, not the customer/);
  });

  it('adds nothing when there is no instruction', () => {
    const withBlank = buildSystemPrompt({ userPrompt: null, mode: 'draft', instruction: '   ' });
    const without = buildSystemPrompt({ userPrompt: null, mode: 'draft' });
    expect(withBlank).toBe(without);
  });
});
