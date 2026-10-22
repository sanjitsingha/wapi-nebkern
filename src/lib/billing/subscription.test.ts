import { describe, expect, it } from 'vitest';

import { computeSubscription } from './subscription';

const NOW = Date.parse('2026-10-22T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('computeSubscription', () => {
  it('ends a paid plan when its period does', () => {
    // Given on 3 Aug with the period ending 3 Sep, looked at on 22 Oct.
    const s = computeSubscription(
      {
        plan: 'business',
        subscription_status: 'active',
        current_period_end: '2026-09-03T10:00:00Z',
      },
      NOW,
    );
    expect(s.status).toBe('expired');
    expect(s.hasAccess).toBe(false);
    expect(s.periodDaysLeft).toBe(0);
    expect(s.periodEndsAt).toBe('2026-09-03T10:00:00Z');
  });

  it('keeps a paid plan live until its period ends', () => {
    const s = computeSubscription(
      { plan: 'growth', subscription_status: 'active', current_period_end: iso(NOW + 5 * DAY) },
      NOW,
    );
    expect(s.status).toBe('active');
    expect(s.hasAccess).toBe(true);
    expect(s.periodDaysLeft).toBe(5);
  });

  it('ends it at the exact moment the period does', () => {
    const row = { plan: 'growth', subscription_status: 'active', current_period_end: iso(NOW) };
    expect(computeSubscription(row, NOW - 1).hasAccess).toBe(true);
    expect(computeSubscription(row, NOW).hasAccess).toBe(false);
  });

  it('never ends an active account with no period (grandfathered, full access)', () => {
    const s = computeSubscription({ plan: 'grandfathered', subscription_status: 'active' }, NOW);
    expect(s.status).toBe('active');
    expect(s.hasAccess).toBe(true);
    expect(s.periodEndsAt).toBeNull();
  });

  it('keeps a canceled plan until its period ends, then not', () => {
    const live = computeSubscription(
      { plan: 'growth', subscription_status: 'canceled', current_period_end: iso(NOW + DAY) },
      NOW,
    );
    expect(live.status).toBe('canceled');
    expect(live.hasAccess).toBe(true);

    const over = computeSubscription(
      { plan: 'growth', subscription_status: 'canceled', current_period_end: iso(NOW - DAY) },
      NOW,
    );
    expect(over.hasAccess).toBe(false);
  });

  it('blocks past due and expired whatever the period says', () => {
    for (const status of ['past_due', 'expired']) {
      const s = computeSubscription(
        { plan: 'growth', subscription_status: status, current_period_end: iso(NOW + 9 * DAY) },
        NOW,
      );
      expect(s.hasAccess).toBe(false);
    }
  });

  it('still expires a trial by its own end date', () => {
    const live = computeSubscription(
      { plan: 'trial', subscription_status: 'trialing', trial_ends_at: iso(NOW + 3 * DAY) },
      NOW,
    );
    expect(live.status).toBe('trialing');
    expect(live.trialDaysLeft).toBe(3);

    const over = computeSubscription(
      { plan: 'trial', subscription_status: 'trialing', trial_ends_at: iso(NOW - DAY) },
      NOW,
    );
    expect(over.status).toBe('expired');
    expect(over.hasAccess).toBe(false);
  });

  it('fails open when the status is unknown', () => {
    const s = computeSubscription(null, NOW);
    expect(s.status).toBe('active');
    expect(s.hasAccess).toBe(true);
  });
});
