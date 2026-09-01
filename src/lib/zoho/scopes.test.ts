import { describe, expect, it } from 'vitest';

import { ZOHO_SCOPES, buildZohoAuthorizeUrl } from './client';

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
    // The only Zoho API call in this integration is /crm/v5/org. A
    // module scope would grant read+write on every CRM record to
    // satisfy no call at all — if a scope is added here, a call using
    // it should be added in the same change.
    expect(ZOHO_SCOPES).toEqual(['ZohoCRM.org.READ']);
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
