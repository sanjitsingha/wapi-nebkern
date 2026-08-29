import { describe, expect, it } from 'vitest';

import { errorSummary, extractErrorCode } from './errors';

// These two drive the dashboard's failure grouping: the code is the
// group key and the summary is its label, so a miss here silently
// splits one problem into several rows.
describe('extractErrorCode', () => {
  it('reads the code the formatter writes', () => {
    expect(
      extractErrorCode('[Code 132001] Template Not Found\nSomething'),
    ).toBe(132001);
  });

  it('reads a code and subcode pair', () => {
    expect(extractErrorCode('[Code 100/2494010] Invalid parameter')).toBe(100);
  });

  it('reads the legacy (#code) shape', () => {
    expect(extractErrorCode('Meta API error (#131047) window closed')).toBe(
      131047,
    );
  });

  it('returns null when there is no code', () => {
    expect(extractErrorCode('Network timeout')).toBeNull();
    expect(extractErrorCode(null)).toBeNull();
    expect(extractErrorCode('')).toBeNull();
  });
});

describe('errorSummary', () => {
  it('prefers the mapped title', () => {
    expect(errorSummary('[Code 131047] 24-Hour Window Expired\nblah')).toBe(
      '24-Hour Window Expired',
    );
  });

  it('falls back to the first line for an unmapped code', () => {
    expect(errorSummary('[Code 999999] — Weird thing\nsecond line')).toBe(
      '[Code 999999] — Weird thing',
    );
  });

  it('handles a message with no code at all', () => {
    expect(errorSummary('Network timeout')).toBe('Network timeout');
  });

  it('never returns an empty label', () => {
    // An empty label would render as a blank row in the panel.
    expect(errorSummary(null)).toBeTruthy();
    expect(errorSummary('   ')).toBeTruthy();
  });

  it('groups two failures of the same cause under one key', () => {
    const a = '[Code 132001] Template Not Found\nMeta said: foo';
    const b = '[Code 132001] Template Not Found\nMeta said: bar';
    expect(extractErrorCode(a)).toBe(extractErrorCode(b));
    expect(errorSummary(a)).toBe(errorSummary(b));
  });
});
