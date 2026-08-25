import { describe, expect, it } from 'vitest';
import { isCompleteOtp } from '@/lib/auth/mfa';

describe('isCompleteOtp', () => {
  it('accepts six digits', () => {
    expect(isCompleteOtp('123456')).toBe(true);
  });
  it('rejects a code with an interior gap', () => {
    expect(isCompleteOtp('12 456')).toBe(false);
  });
  it('rejects short, long, empty and non-numeric', () => {
    for (const c of ['12345', '1234567', '', 'abcdef', '12345 ']) {
      expect(isCompleteOtp(c)).toBe(false);
    }
  });
});
