import { beforeAll, describe, expect, it } from 'vitest';

import { goodbyeEmail, welcomeEmail } from './newsletter-templates';

// unsubscribeUrl signs with this; without it the welcome template
// throws rather than producing a link.
beforeAll(() => {
  process.env.UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test';
});

describe('welcomeEmail', () => {
  it('carries a working unsubscribe link in both parts', () => {
    const mail = welcomeEmail('sam@example.com');

    // The whole point of the compliance check: bulk mail with no way
    // out is what gets a domain reported rather than unsubscribed from.
    // It has to be in the plain-text part too — some clients render
    // only that.
    expect(mail.html).toContain('/unsubscribe?e=sam%40example.com&t=');
    expect(mail.text).toContain('/unsubscribe?e=sam%40example.com&t=');
  });

  it('greets by name when there is one, and degrades without', () => {
    expect(welcomeEmail('sam@example.com', 'Sam').html).toContain('Hi Sam,');
    expect(welcomeEmail('sam@example.com', '  ').html).toContain('Hi,');
    expect(welcomeEmail('sam@example.com', null).html).toContain('Hi,');
  });

  it('always ships a text part alongside the html', () => {
    const mail = welcomeEmail('sam@example.com');
    expect(mail.text.trim().length).toBeGreaterThan(0);
    expect(mail.subject.length).toBeGreaterThan(0);
  });
});

describe('goodbyeEmail', () => {
  it('does NOT contain an unsubscribe link', () => {
    const mail = goodbyeEmail('sam@example.com');
    // They just unsubscribed. Offering the link again is confusing at
    // best, and a second click on a dead link reads as "it didn't work".
    expect(mail.html).not.toContain('/unsubscribe?');
    expect(mail.text).not.toContain('/unsubscribe?');
  });

  it('offers a way back instead', () => {
    const mail = goodbyeEmail('sam@example.com');
    expect(mail.html).toContain('https://example.test/newsletter');
    expect(mail.text).toContain('https://example.test/newsletter');
  });
});
