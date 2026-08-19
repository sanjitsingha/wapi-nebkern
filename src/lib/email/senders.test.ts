import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SENDERS, listSenders, resolveSender } from './senders';

const VARS = [
  'MAIL_DOMAIN',
  'MAIL_FROM_NEWSLETTER',
  'MAIL_FROM_SUPPORT',
  'MAIL_FROM_BILLING',
  'MAIL_FROM_SYSTEM',
];

function clear() {
  for (const v of VARS) delete process.env[v];
}

describe('resolveSender', () => {
  beforeEach(clear);
  afterEach(clear);

  it('derives every sender from MAIL_DOMAIN alone', () => {
    process.env.MAIL_DOMAIN = 'example.test';

    expect(resolveSender('newsletter')?.address).toBe(
      'newsletter@example.test'
    );
    expect(resolveSender('support')?.address).toBe('support@example.test');
    expect(resolveSender('billing')?.address).toBe('billing@example.test');
    expect(resolveSender('system')?.address).toBe('no-reply@example.test');
  });

  it('carries the display name separately from the address', () => {
    // The name rides in `from_name`, never inside `from` — see the
    // note in senders.ts on why the combined header is rejected.
    process.env.MAIL_DOMAIN = 'example.test';
    expect(resolveSender('newsletter')?.name).toBe('Contact - Instant');
    expect(resolveSender('support')?.name).toBe('Support - Instant');
  });

  it('keeps the registry name when the address is overridden', () => {
    // The name is brand copy, not deployment config. Reading it from
    // the override too would let the two drift apart.
    process.env.MAIL_FROM_NEWSLETTER = 'Whatever <contact@example.test>';
    const s = resolveSender('newsletter');
    expect(s?.address).toBe('contact@example.test');
    expect(s?.name).toBe('Contact - Instant');
  });

  it('never emits a display name — DeoMail rejects Name <addr>', () => {
    // Verified against the live API: the angle-bracket form comes back
    // SENDER_NOT_AUTHORIZED, the bare address sends. See senders.ts.
    process.env.MAIL_DOMAIN = 'example.test';
    for (const key of Object.keys(SENDERS) as (keyof typeof SENDERS)[]) {
      expect(resolveSender(key)?.address).not.toContain('<');
      expect(resolveSender(key)?.address).not.toContain(' ');
    }
  });

  it('strips a display name from an override rather than failing', () => {
    // People write this format from habit; passing it through produces
    // a 403 that reads like an unverified domain.
    process.env.MAIL_FROM_NEWSLETTER = 'Instant <contact@example.test>';
    expect(resolveSender('newsletter')?.address).toBe('contact@example.test');

    process.env.MAIL_FROM_SUPPORT = '  Support <help@example.test>  ';
    expect(resolveSender('support')?.address).toBe('help@example.test');
  });

  it('lets a per-sender override beat MAIL_DOMAIN', () => {
    process.env.MAIL_DOMAIN = 'example.test';
    process.env.MAIL_FROM_NEWSLETTER = 'news@mail.other.test';

    expect(resolveSender('newsletter')?.address).toBe('news@mail.other.test');
    // ...without disturbing the others.
    expect(resolveSender('support')?.address).toBe('support@example.test');
  });

  it('works from an override with no MAIL_DOMAIN at all', () => {
    process.env.MAIL_FROM_BILLING = 'billing@only.test';

    expect(resolveSender('billing')?.address).toBe('billing@only.test');
    expect(resolveSender('support')).toBeNull();
  });

  it('returns null rather than throwing when nothing is configured', () => {
    // Callers send mail as a side effect of work that already
    // succeeded, so an unconfigured sender has to degrade quietly.
    for (const key of Object.keys(SENDERS) as (keyof typeof SENDERS)[]) {
      expect(resolveSender(key)).toBeNull();
    }
  });

  it('tolerates a MAIL_DOMAIN written with a leading @', () => {
    process.env.MAIL_DOMAIN = '@example.test';
    expect(resolveSender('system')?.address).toBe('no-reply@example.test');
  });

  it('ignores whitespace-only config', () => {
    process.env.MAIL_DOMAIN = '   ';
    process.env.MAIL_FROM_SUPPORT = '  ';
    expect(resolveSender('support')).toBeNull();
  });
});

describe('listSenders', () => {
  beforeEach(clear);
  afterEach(clear);

  it('reports where each address came from, for a health check', () => {
    process.env.MAIL_DOMAIN = 'example.test';
    process.env.MAIL_FROM_SUPPORT = 'help@other.test';

    const bySource = Object.fromEntries(
      listSenders().map((s) => [s.key, s.source])
    );

    expect(bySource).toMatchObject({
      support: 'override',
      newsletter: 'domain',
      billing: 'domain',
      system: 'domain',
    });
  });

  it('marks everything unset when there is no config', () => {
    expect(listSenders().every((s) => s.source === 'unset')).toBe(true);
    expect(listSenders().every((s) => s.address === null)).toBe(true);
  });
});
