import { afterEach, describe, expect, it } from 'vitest';

import {
  ZOHO_SCOPES,
  accountsUrlFromCallback,
  buildZohoAuthorizeUrl,
  zohoRedirectUri,
} from './client';

// A malformed scope is invisible until a user reaches Zoho's consent
// screen, where it fails as "Invalid OAuth Scope — Scope does not
// exist" without naming which one. These assert the grammar instead.
describe('ZOHO_SCOPES', () => {
  it('uses Zoho’s Service.Resource.Operation grammar', () => {
    for (const scope of ZOHO_SCOPES) {
      expect(scope, `${scope} must start with ZohoCRM.`).toMatch(/^ZohoCRM\./);
      // Three or four dot-separated parts. `ZohoCRM.org.READ` is three;
      // `ZohoCRM.settings.modules.READ` is four. Five never parses.
      const parts = scope.split('.');
      expect(
        parts.length,
        `${scope} has ${parts.length} segments`,
      ).toBeLessThanOrEqual(4);
      expect(parts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('never appends an operation to the ALL wildcard', () => {
    // `ZohoCRM.modules.ALL.READ` is the exact mistake that shipped once:
    // ALL is already the operation, so .READ makes a segment too many.
    for (const scope of ZOHO_SCOPES) {
      expect(scope).not.toMatch(/\.ALL\.(READ|WRITE|CREATE|UPDATE|DELETE)$/);
    }
  });

  it('asks for nothing beyond what the code actually calls', () => {
    // Each of these is paid for by a call somewhere. If a scope is
    // added here, the call that needs it belongs in the same change —
    // otherwise it is access to a customer's CRM for nothing.
    expect(ZOHO_SCOPES).toEqual([
      'ZohoCRM.org.READ',
      'ZohoCRM.modules.contacts.ALL',
      'ZohoCRM.modules.leads.ALL',
      'ZohoCRM.modules.deals.READ',
      'ZohoCRM.modules.notes.CREATE',
    ]);
  });

  it('never asks for the blanket modules scope', () => {
    // ZohoCRM.modules.ALL covers everything these name individually,
    // and also grants write and delete on Tasks, Calls, Campaigns and
    // every other module we do not touch. Naming modules keeps a bug
    // here from reaching them.
    expect(ZOHO_SCOPES).not.toContain('ZohoCRM.modules.ALL');
  });

  it('keeps write access to the two modules that are synced', () => {
    // deals is READ and notes is CREATE on purpose: nothing writes a
    // Deal, and logging a conversation appends notes rather than
    // editing what someone else wrote.
    expect(ZOHO_SCOPES).toContain('ZohoCRM.modules.deals.READ');
    expect(ZOHO_SCOPES).not.toContain('ZohoCRM.modules.deals.ALL');
    expect(ZOHO_SCOPES).toContain('ZohoCRM.modules.notes.CREATE');
    expect(ZOHO_SCOPES).not.toContain('ZohoCRM.modules.notes.ALL');
  });
});

describe('buildZohoAuthorizeUrl', () => {
  const base = {
    clientId: '1000.ABC',
    redirectUri: 'https://example.com/api/integrations/zoho/oauth/callback',
    state: 'nonce-1.tab',
  };

  it('targets the accounts host it was given', () => {
    const url = buildZohoAuthorizeUrl({
      ...base,
      accountsUrl: 'https://accounts.zoho.in',
    });
    expect(url.startsWith('https://accounts.zoho.in/oauth/v2/auth')).toBe(true);
  });

  it('defaults to the multi-DC entry point', () => {
    // Nobody picks a region any more. accounts.zoho.com is where every
    // new connection starts: Zoho recognises the user's home data
    // centre from their login and forwards them to it. Defaulting to
    // any OTHER host would refuse everyone not in that one region.
    const url = buildZohoAuthorizeUrl(base);
    expect(url.startsWith('https://accounts.zoho.com/oauth/v2/auth')).toBe(
      true,
    );
  });

  it('requests offline access, or there is no refresh token', () => {
    // Without this the connection dies silently an hour after it is
    // made — the single easiest way to get Zoho OAuth wrong.
    const url = new URL(buildZohoAuthorizeUrl(base));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('forces the consent prompt', () => {
    // Zoho returns a refresh token only on the FIRST consent otherwise,
    // so a reconnect after a revoke would yield nothing durable.
    const url = new URL(buildZohoAuthorizeUrl(base));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('round-trips the state and redirect URI unchanged', () => {
    const url = new URL(buildZohoAuthorizeUrl(base));
    expect(url.searchParams.get('state')).toBe(base.state);
    expect(url.searchParams.get('redirect_uri')).toBe(base.redirectUri);
  });

  it('sends the scopes comma-separated, as Zoho expects', () => {
    const url = new URL(buildZohoAuthorizeUrl(base));
    expect(url.searchParams.get('scope')).toBe(ZOHO_SCOPES.join(','));
  });
});

describe('accountsUrlFromCallback', () => {
  it('maps the location code Zoho returns to its data centre', () => {
    expect(accountsUrlFromCallback('in', null)).toBe(
      'https://accounts.zoho.in',
    );
    expect(accountsUrlFromCallback('eu', null)).toBe(
      'https://accounts.zoho.eu',
    );
    expect(accountsUrlFromCallback('AU', null)).toBe(
      'https://accounts.zoho.com.au',
    );
  });

  it('falls back to a known host when only accounts-server is given', () => {
    expect(
      accountsUrlFromCallback(null, 'https://accounts.zoho.jp'),
    ).toBe('https://accounts.zoho.jp');
    // Trailing slashes are Zoho's, not a different host.
    expect(
      accountsUrlFromCallback(null, 'https://accounts.zoho.jp/'),
    ).toBe('https://accounts.zoho.jp');
  });

  it('never returns a host it was not already compiled with', () => {
    // This is the security property, not a nicety. These values arrive
    // on an attacker-reachable callback URL and decide where the token
    // exchange POSTs our client secret. Anything unrecognised has to
    // land on a known host, never on what the query string asked for.
    const hostile = [
      'https://accounts.zoho.in.evil.test',
      'https://evil.test',
      'https://accounts.zoho.in@evil.test',
      '//evil.test',
      'javascript:alert(1)',
    ];
    for (const server of hostile) {
      expect(accountsUrlFromCallback(null, server)).toBe(
        'https://accounts.zoho.com',
      );
    }
    // Same for a location code that is not one of Zoho's.
    expect(accountsUrlFromCallback('evil', null)).toBe(
      'https://accounts.zoho.com',
    );
    expect(accountsUrlFromCallback(null, null)).toBe(
      'https://accounts.zoho.com',
    );
  });

  it('prefers location over accounts-server when both are present', () => {
    // Both are attacker-reachable, so this is not about trust between
    // them — it is that `location` is matched against a fixed map and
    // is the value Zoho documents as authoritative.
    expect(
      accountsUrlFromCallback('in', 'https://accounts.zoho.eu'),
    ).toBe('https://accounts.zoho.in');
  });
});

describe('zohoRedirectUri', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('is the SITE url, not the origin the admin is browsing', () => {
    // The bug this pins: deriving it from the request origin meant
    // connecting from a dev server sent Zoho a localhost callback that
    // was not registered, and that Zoho could never have reached.
    process.env.NEXT_PUBLIC_SITE_URL = 'https://instant.example.com';
    delete process.env.ZOHO_REDIRECT_URI;
    expect(zohoRedirectUri('http://localhost:3000')).toBe(
      'https://instant.example.com/api/integrations/zoho/oauth/callback',
    );
  });

  it('does not double up a slash when the site url has a trailing one', () => {
    // Zoho matches byte for byte, so "…com//api/…" is a different URI
    // and is refused with no indication of why.
    process.env.NEXT_PUBLIC_SITE_URL = 'https://instant.example.com/';
    delete process.env.ZOHO_REDIRECT_URI;
    expect(zohoRedirectUri()).toBe(
      'https://instant.example.com/api/integrations/zoho/oauth/callback',
    );
  });

  it('lets ZOHO_REDIRECT_URI win outright', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://instant.example.com';
    process.env.ZOHO_REDIRECT_URI = 'https://other.example.net/cb';
    expect(zohoRedirectUri('http://localhost:3000')).toBe(
      'https://other.example.net/cb',
    );
  });

  it('falls back to the request origin only when no site url is set', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.ZOHO_REDIRECT_URI;
    expect(zohoRedirectUri('https://fallback.example.org')).toBe(
      'https://fallback.example.org/api/integrations/zoho/oauth/callback',
    );
  });
});
