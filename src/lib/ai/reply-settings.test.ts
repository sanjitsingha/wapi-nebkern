import { describe, expect, it } from 'vitest';
import {
  RESPONSE_DELAY,
  SNOOZE,
  defaultOperatingHours,
  isWithinOperatingHours,
  parseOperatingHours,
  parseSeconds,
  type OperatingHours,
} from './reply-settings';

describe('parseSeconds', () => {
  it('accepts whole numbers in range, from numbers or strings', () => {
    expect(parseSeconds(30, RESPONSE_DELAY)).toBe(30);
    expect(parseSeconds('3', RESPONSE_DELAY)).toBe(3);
    expect(parseSeconds(0, SNOOZE)).toBe(0);
    expect(parseSeconds(6000, SNOOZE)).toBe(6000);
  });

  it('rejects out of range, fractions and junk', () => {
    expect(parseSeconds(2, RESPONSE_DELAY)).toBeNull();
    expect(parseSeconds(6001, SNOOZE)).toBeNull();
    expect(parseSeconds(1.5, SNOOZE)).toBeNull();
    expect(parseSeconds('', SNOOZE)).toBeNull();
    expect(parseSeconds('abc', SNOOZE)).toBeNull();
    expect(parseSeconds(null, SNOOZE)).toBeNull();
  });
});

describe('parseOperatingHours', () => {
  it('round-trips the default schedule', () => {
    const hours = defaultOperatingHours('Asia/Kolkata');
    expect(parseOperatingHours(JSON.parse(JSON.stringify(hours)))).toEqual(hours);
  });

  it('rejects a bad timezone, a missing day or an end before its start', () => {
    const good = defaultOperatingHours('UTC');
    expect(parseOperatingHours({ ...good, timezone: 'Mars/Olympus' })).toBeNull();
    const missingMonday: Partial<OperatingHours['days']> = { ...good.days };
    delete missingMonday.mon;
    expect(parseOperatingHours({ ...good, days: missingMonday })).toBeNull();
    expect(
      parseOperatingHours({ ...good, days: { ...good.days, tue: { start: '18:00', end: '09:00' } } }),
    ).toBeNull();
    expect(parseOperatingHours({ ...good, days: { ...good.days, wed: { start: '9:00', end: '18:00' } } })).toBeNull();
    expect(parseOperatingHours(null)).toBeNull();
  });
});

describe('isWithinOperatingHours', () => {
  const schedule = (over: Partial<OperatingHours> = {}): OperatingHours => ({
    ...defaultOperatingHours('Asia/Kolkata'),
    enabled: true,
    ...over,
  });

  it('is always open with no schedule or a disabled one', () => {
    expect(isWithinOperatingHours(null)).toBe(true);
    expect(isWithinOperatingHours({ ...schedule(), enabled: false })).toBe(true);
  });

  it('reads the clock in the schedule’s timezone', () => {
    // Wed 2026-10-14 04:00 UTC = 09:30 in Kolkata (open); 13:00 UTC = 18:30 (closed).
    expect(isWithinOperatingHours(schedule(), new Date('2026-10-14T04:00:00Z'))).toBe(true);
    expect(isWithinOperatingHours(schedule(), new Date('2026-10-14T13:00:00Z'))).toBe(false);
  });

  it('treats the start as open and the end as closed', () => {
    // 09:00 and 18:00 Kolkata are 03:30 and 12:30 UTC.
    expect(isWithinOperatingHours(schedule(), new Date('2026-10-14T03:30:00Z'))).toBe(true);
    expect(isWithinOperatingHours(schedule(), new Date('2026-10-14T12:30:00Z'))).toBe(false);
  });

  it('is closed all day on a day with no hours', () => {
    // Sun 2026-10-18 06:00 UTC = 11:30 in Kolkata, and Sunday is closed.
    expect(isWithinOperatingHours(schedule(), new Date('2026-10-18T06:00:00Z'))).toBe(false);
  });

  it('fails open on an unreadable timezone', () => {
    expect(isWithinOperatingHours(schedule({ timezone: 'Nowhere/Land' }))).toBe(true);
  });
});
