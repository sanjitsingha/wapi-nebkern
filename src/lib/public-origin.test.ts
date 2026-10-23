import { describe, expect, it } from 'vitest';

import { publicOrigin } from './public-origin';

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe('publicOrigin', () => {
  it('uses the Host nginx forwards, not the listen address Next reports', () => {
    // What production actually hands a route handler: request.url is
    // the internal address, the Host header is the public one.
    expect(
      publicOrigin(
        req('https://localhost:3000/api/meta/oauth/start', {
          host: 'dripo.nebkern.com',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toBe('https://dripo.nebkern.com');
  });

  it('prefers X-Forwarded-Host when a proxy sets it', () => {
    expect(
      publicOrigin(
        req('http://localhost:3000/x', {
          host: 'localhost:3000',
          'x-forwarded-host': 'dripo.nebkern.com, edge.internal',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toBe('https://dripo.nebkern.com');
  });

  it('keeps localhost on a dev server', () => {
    expect(publicOrigin(req('http://localhost:3000/x', { host: 'localhost:3000' }))).toBe(
      'http://localhost:3000',
    );
  });

  it('takes the protocol from request.url when no proxy names one', () => {
    expect(publicOrigin(req('https://localhost:3000/x', { host: 'app.example.com' }))).toBe(
      'https://app.example.com',
    );
  });

  it('ignores a Host header that is not a host', () => {
    expect(
      publicOrigin(req('http://localhost:3000/x', { host: 'evil.com/path?x=1' })),
    ).toBe('http://localhost:3000');
  });

  it('ignores a forwarded protocol other than http or https', () => {
    expect(
      publicOrigin(
        req('https://localhost:3000/x', {
          host: 'dripo.nebkern.com',
          'x-forwarded-proto': 'javascript',
        }),
      ),
    ).toBe('https://dripo.nebkern.com');
  });
});
