import crypto from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  HUBSPOT_SCOPES,
  HUBSPOT_SCOPE_LABELS,
  buildHubSpotAuthorizeUrl,
  hubspotPermissionLabels,
  verifyHubSpotSignature,
} from './client';
import { HUBSPOT_EVENTS } from './events';

const SECRET = 'test-client-secret';
const URI = 'https://instant.example.com/api/integrations/hubspot/webhook';

function v3Headers(body: string, timestamp: number, uri = URI) {
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(`POST${uri}${body}${timestamp}`)
    .digest('base64');
  return new Headers({
    'x-hubspot-signature-v3': sig,
    'x-hubspot-request-timestamp': String(timestamp),
  });
}

describe('verifyHubSpotSignature', () => {
  const body = '[{"objectId":1}]';
  const now = 1_760_000_000_000;

  it('accepts a fresh v3 signature for the public URL', () => {
    expect(
      verifyHubSpotSignature({
        method: 'POST',
        uris: ['https://localhost:3000/api/integrations/hubspot/webhook', URI],
        body,
        headers: v3Headers(body, now),
        clientSecret: SECRET,
        now,
      }),
    ).toBe(true);
  });

  it('refuses a tampered body, a wrong secret and a stale timestamp', () => {
    const headers = v3Headers(body, now);
    const base = { method: 'POST', uris: [URI], headers, now };
    expect(verifyHubSpotSignature({ ...base, body: '[]', clientSecret: SECRET })).toBe(false);
    expect(verifyHubSpotSignature({ ...base, body, clientSecret: 'other' })).toBe(false);
    expect(
      verifyHubSpotSignature({ ...base, body, clientSecret: SECRET, now: now + 6 * 60_000 }),
    ).toBe(false);
  });

  it('accepts the older v1 hash', () => {
    const sig = crypto.createHash('sha256').update(`${SECRET}${body}`).digest('hex');
    expect(
      verifyHubSpotSignature({
        method: 'POST',
        uris: [URI],
        body,
        headers: new Headers({ 'x-hubspot-signature': sig, 'x-hubspot-signature-version': 'v1' }),
        clientSecret: SECRET,
      }),
    ).toBe(true);
  });

  it('refuses an unsigned request', () => {
    expect(
      verifyHubSpotSignature({ method: 'POST', uris: [URI], body, headers: new Headers(), clientSecret: SECRET }),
    ).toBe(false);
  });
});

describe('authorize URL', () => {
  it('asks for every scope, space-separated', () => {
    const url = new URL(
      buildHubSpotAuthorizeUrl({ clientId: 'cid', redirectUri: URI, state: 'abc' }),
    );
    expect(url.origin + url.pathname).toBe('https://app.hubspot.com/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe(HUBSPOT_SCOPES.join(' '));
    expect(url.searchParams.get('state')).toBe('abc');
  });

  it('labels every scope it asks for', () => {
    for (const s of HUBSPOT_SCOPES) expect(s in HUBSPOT_SCOPE_LABELS).toBe(true);
    expect(hubspotPermissionLabels()).toContain('Contacts — read and write');
  });
});

describe('the HubSpot app project agrees with the code', () => {
  const root = path.resolve(__dirname, '../../../hubspot/src/app');
  const app = JSON.parse(readFileSync(path.join(root, 'app-hsmeta.json'), 'utf8'));
  const hooks = JSON.parse(readFileSync(path.join(root, 'webhooks/webhooks-hsmeta.json'), 'utf8'));

  it('requires exactly the scopes the code requests', () => {
    expect([...app.config.auth.requiredScopes].sort()).toEqual([...HUBSPOT_SCOPES].sort());
  });

  it('subscribes to what the automation events are built from', () => {
    const subs = hooks.config.subscriptions.crmObjects as {
      subscriptionType: string;
      objectType: string;
      propertyName?: string;
    }[];
    const has = (type: string, object: string, prop?: string) =>
      subs.some((s) => s.subscriptionType === type && s.objectType === object && s.propertyName === prop);
    expect(has('object.creation', 'contact')).toBe(true);
    expect(has('object.propertyChange', 'contact', 'lifecyclestage')).toBe(true);
    expect(has('object.propertyChange', 'contact', 'hs_lead_status')).toBe(true);
    expect(has('object.creation', 'deal')).toBe(true);
    expect(has('object.propertyChange', 'deal', 'dealstage')).toBe(true);
    expect(HUBSPOT_EVENTS).toHaveLength(7);
  });
});
