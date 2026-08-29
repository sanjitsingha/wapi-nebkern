import { describe, expect, it } from 'vitest';

import { formatDetailedMetaError, META_ERROR_CODE_MAP } from './errors';

describe('formatDetailedMetaError', () => {
  it('explains a known code and says what to do', () => {
    const out = formatDetailedMetaError({ code: 131047 });
    expect(out).toContain('131047');
    expect(out).toContain('24-Hour Window Expired');
    expect(out).toContain('→');
  });

  it('keeps OUR explanation AND Meta’s specifics', () => {
    // The regression this guards: `details` used to replace the
    // explanation, so the sentence saying what to do vanished whenever
    // Meta sent anything at all.
    const out = formatDetailedMetaError({
      code: 132001,
      message: 'Template name error',
      details: 'template name (order_update) does not exist in en_US',
    });
    expect(out).toContain('Template Not Found');
    expect(out).toContain('does not exist in en_US');
    expect(out).toContain('→');
  });

  it('prints the code even when nothing is known about it', () => {
    // An unmapped code is exactly when the number matters most — it is
    // what makes a search or a support ticket productive.
    const out = formatDetailedMetaError({
      code: 999999,
      message: 'Something went wrong',
    });
    expect(out).toContain('999999');
    expect(out).toContain('Something went wrong');
  });

  it('includes the subcode when present', () => {
    const out = formatDetailedMetaError({ code: 100, subcode: 2494010 });
    expect(out).toMatch(/100/);
  });

  it('surfaces every distinct field for an unknown code', () => {
    const out = formatDetailedMetaError({
      code: 888888,
      userTitle: 'Cannot send',
      userMsg: 'The recipient blocked your number.',
      details: 'recipient_blocked',
    });
    expect(out).toContain('Cannot send');
    expect(out).toContain('blocked your number');
    expect(out).toContain('recipient_blocked');
  });

  it('does not repeat a field that duplicates the message', () => {
    const out = formatDetailedMetaError({
      code: 777777,
      message: 'Same text',
      title: 'Same text',
    });
    expect(out.match(/Same text/g)).toHaveLength(1);
  });

  it('parses a code out of a plain string', () => {
    const out = formatDetailedMetaError('Meta API error (#131047)');
    expect(out).toContain('24-Hour Window Expired');
  });

  it('passes an unrecognised string through unchanged', () => {
    expect(formatDetailedMetaError('Network timeout')).toBe('Network timeout');
  });

  it('admits ignorance rather than diagnosing, when given nothing', () => {
    const out = formatDetailedMetaError(null);
    // Must not claim "Undeliverable" — that reads as a finding, and we
    // have not found anything.
    expect(out.toLowerCase()).not.toContain('undeliverable');
    expect(out.toLowerCase()).toContain('failed');
  });
});

describe('META_ERROR_CODE_MAP coverage', () => {
  it('covers the template failure family', () => {
    // 132xxx is the most common cause of a failed send once an account
    // is past its first week, and was absent entirely.
    for (const code of [132000, 132001, 132005, 132007, 132012, 132015, 132016]) {
      expect(META_ERROR_CODE_MAP[code], `missing ${code}`).toBeDefined();
    }
  });

  it('covers account-level blockers', () => {
    for (const code of [131031, 131042, 131045, 133010]) {
      expect(META_ERROR_CODE_MAP[code], `missing ${code}`).toBeDefined();
    }
  });

  it('gives every entry an actionable next step', () => {
    for (const [code, entry] of Object.entries(META_ERROR_CODE_MAP)) {
      expect(entry.title, `${code} title`).toBeTruthy();
      expect(entry.explanation, `${code} explanation`).toBeTruthy();
      expect(entry.action, `${code} action`).toBeTruthy();
    }
  });
});
