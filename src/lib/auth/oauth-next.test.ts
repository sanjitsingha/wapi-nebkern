import { describe, it, expect } from 'vitest';

import { safeNextPath } from './oauth-next';

// The value guarded here arrives from a cookie the browser owns, so it is
// attacker-controllable: the callback route redirects to whatever comes
// back. These cases are the open-redirect surface, not style points.
describe('safeNextPath', () => {
  it('accepts same-site relative paths', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/join/abc123')).toBe('/join/abc123');
    expect(safeNextPath('/settings/profile?tab=security&linked=google')).toBe(
      '/settings/profile?tab=security&linked=google',
    );
  });

  it('refuses absolute URLs', () => {
    expect(safeNextPath('https://evil.example/steal')).toBeNull();
    expect(safeNextPath('http://evil.example')).toBeNull();
  });

  it('refuses protocol-relative and backslash forms', () => {
    // `//evil.example` is a protocol-relative URL, and browsers normalise
    // the backslash variant to the same thing.
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
  });

  it('refuses empty and missing values', () => {
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
