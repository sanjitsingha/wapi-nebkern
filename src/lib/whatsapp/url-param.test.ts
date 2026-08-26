import { describe, expect, it } from 'vitest';

import { encodeUrlParam } from './template-send-builder';

// Meta appends this value to the approved base URL verbatim, so
// anything that survives unescaped lands in a live link. These are the
// shapes real order data actually takes.
describe('encodeUrlParam', () => {
  it('leaves a plain id alone', () => {
    expect(encodeUrlParam('12345')).toBe('12345');
    expect(encodeUrlParam('ORD-1042')).toBe('ORD-1042');
  });

  it('escapes spaces', () => {
    expect(encodeUrlParam('ORD 12')).toBe('ORD%2012');
  });

  it('escapes query metacharacters that would truncate the link', () => {
    expect(encodeUrlParam('a&b')).toBe('a%26b');
    expect(encodeUrlParam('a?b')).toBe('a%3Fb');
    expect(encodeUrlParam('a#b')).toBe('a%23b');
  });

  it('keeps slashes so a path suffix stays a path', () => {
    expect(encodeUrlParam('orders/12345')).toBe('orders/12345');
  });

  it('trims surrounding whitespace', () => {
    expect(encodeUrlParam('  12345  ')).toBe('12345');
  });

  it('does not double-encode a value that is already escaped', () => {
    expect(encodeUrlParam('ORD%2012')).toBe('ORD%2012');
  });

  it('still encodes a bare space even when a % appears', () => {
    // Not already-encoded — the space proves it — so escape the lot.
    expect(encodeUrlParam('50% off')).toBe('50%25%20off');
  });
});
