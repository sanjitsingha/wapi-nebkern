import { describe, expect, it } from 'vitest';

import { collapseRepetition, parseGeneration } from './generate';
import { HANDOFF_SENTINEL } from './defaults';

describe('collapseRepetition', () => {
  it('drops a rephrased restatement of the same greeting', () => {
    // The exact output that prompted this: a free-tier model answering
    // once politely and once casually. No two words are spelled the
    // same, so an equality check would not catch it.
    const raw =
      'Hello! How can I assist you today?\n\nhii hello how can i help you today?';
    expect(collapseRepetition(raw)).toBe('Hello! How can I assist you today?');
  });

  it('keeps the first phrasing, not the last', () => {
    // The opening block is usually the better-formed one — punctuated,
    // capitalised — and it is what a reader would have seen first.
    const out = collapseRepetition(
      'Sure, I can help you with that today.\n\nsure i can help you with that today'
    );
    expect(out).toBe('Sure, I can help you with that today.');
  });

  it('leaves a loose paraphrase alone — conservative by design', () => {
    // Only ~2/3 of these words are shared, below the threshold. Tuning
    // it down would catch this, and would also start deleting real
    // follow-on detail. A duplicated line is a much cheaper mistake
    // than a silently truncated answer, so the bar stays high.
    const raw =
      'We ship across India in 3-5 days.\n\nshipping india 3-5 days yes we ship';
    expect(collapseRepetition(raw)).toBe(raw);
  });

  it('leaves genuinely different paragraphs alone', () => {
    const raw =
      'Yes, we deliver to Mumbai.\n\nDelivery takes three working days and costs 90 rupees.';
    expect(collapseRepetition(raw)).toBe(raw);
  });

  it('does not touch a single paragraph', () => {
    const raw = 'Hello! How can I assist you today?';
    expect(collapseRepetition(raw)).toBe(raw);
  });

  it('leaves short follow-ups alone', () => {
    // "Yes." shares 100% of its tokens with the line above, but it is a
    // legitimate reply rather than a restatement — too short to judge.
    const raw = 'Do you mean the annual plan?\n\nYes.';
    expect(collapseRepetition(raw)).toBe(raw);
  });

  it('collapses every later restatement, not just the first', () => {
    const raw = [
      'We do not accept refunds, sorry.',
      'we do not accept refunds sorry',
      'Sorry, we do not accept refunds.',
    ].join('\n\n');
    expect(collapseRepetition(raw)).toBe('We do not accept refunds, sorry.');
  });
});

describe('parseGeneration', () => {
  it('detects the handoff sentinel and strips it', () => {
    const r = parseGeneration(`I cannot help with that. ${HANDOFF_SENTINEL}`);
    expect(r.handoff).toBe(true);
    expect(r.text).toBe('I cannot help with that.');
  });

  it('treats a bare sentinel as a handoff with no text', () => {
    const r = parseGeneration(HANDOFF_SENTINEL);
    expect(r.handoff).toBe(true);
    expect(r.text).toBe('');
  });

  it('de-duplicates on the way through', () => {
    const r = parseGeneration(
      'Hello! How can I assist you today?\n\nhii hello how can i help you today?'
    );
    expect(r.handoff).toBe(false);
    expect(r.text).toBe('Hello! How can I assist you today?');
  });
});
