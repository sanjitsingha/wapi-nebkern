import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from './defaults';

describe("buildSystemPrompt — the composer's instruction", () => {
  it("carries what the agent asked for, as the business's words", () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'draft',
      instruction: '  ask for their delivery address  ',
    });
    expect(prompt).toContain('"ask for their delivery address"');
    expect(prompt).toMatch(/from the business, not the customer/);
  });

  it('adds nothing when there is no instruction', () => {
    const withBlank = buildSystemPrompt({
      userPrompt: null,
      mode: 'draft',
      instruction: '   ',
    });
    const without = buildSystemPrompt({ userPrompt: null, mode: 'draft' });
    expect(withBlank).toBe(without);
  });
});

describe('buildSystemPrompt — personalization', () => {
  it('adds the chosen personality as style, below the safety rules', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      personality: 'spartan',
    });
    expect(prompt).toContain('Personality — Spartan');
    expect(prompt).toContain('- No emojis.');
    // Style never outranks the handoff rule.
    expect(prompt.indexOf('Personality — Spartan')).toBeGreaterThan(
      prompt.indexOf('[[HANDOFF]]')
    );
    expect(prompt).toContain('those rules win');
  });

  it("adds the business's restrictions in its own words", () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'draft',
      restrictions: "- Don't discuss competitors.",
    });
    expect(prompt).toContain('Restrictions set by the business');
    expect(prompt).toContain("- Don't discuss competitors.");
  });

  it('adds neither section when none is set', () => {
    const prompt = buildSystemPrompt({ userPrompt: null, mode: 'draft' });
    expect(prompt).not.toContain('Personality —');
    expect(prompt).not.toContain('Restrictions set by the business');
  });
});
