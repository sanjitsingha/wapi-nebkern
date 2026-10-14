import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectFlowError, discoverPhoneNumbers, isPinMismatchError, registerNumber } from './connect-flow';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Route fetch by URL substring; first match wins. */
function routeFetch(routes: [string, () => Response][]) {
  return vi.fn(async (url: string) => {
    const hit = routes.find(([part]) => url.includes(part));
    if (!hit) throw new Error(`unexpected fetch: ${url}`);
    return hit[1]();
  });
}

let fetchMock: ReturnType<typeof routeFetch>;
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function registerBody(): { pin?: string } {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/register'));
  return JSON.parse(String((call as unknown as [string, RequestInit])[1].body));
}

const PIN_MISMATCH = () =>
  json({ error: { message: 'Two step verification PIN Mismatch', code: 133005 } }, 400);

describe('registerNumber', () => {
  it('uses the stored PIN when none is typed, and returns it to keep', async () => {
    fetchMock = routeFetch([['/register', () => json({ success: true })]]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await registerNumber({ phoneNumberId: 'P1', wabaId: 'W1', accessToken: 't', storedPin: '111111' });
    expect(registerBody().pin).toBe('111111');
    expect(out).toMatchObject({ pin: '111111', error: null, needsPin: false, skipped: false });
    expect(out.registeredAt).not.toBeNull();
  });

  it('generates a six-digit PIN when there is none, which becomes the number’s PIN', async () => {
    fetchMock = routeFetch([['/register', () => json({ success: true })]]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await registerNumber({ phoneNumberId: 'P1', wabaId: 'W1', accessToken: 't' });
    expect(registerBody().pin).toMatch(/^\d{6}$/);
    expect(out.pin).toBe(registerBody().pin);
  });

  it('asks for the PIN when the number already has its own', async () => {
    fetchMock = routeFetch([['/register', PIN_MISMATCH]]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await registerNumber({ phoneNumberId: 'P1', wabaId: 'W1', accessToken: 't' });
    expect(out).toMatchObject({ registeredAt: null, pin: null, needsPin: true, skipped: false });
    expect(out.error).toMatch(/already has a two-step verification PIN/);
  });

  it('says so when a typed PIN is wrong', async () => {
    fetchMock = routeFetch([['/register', PIN_MISMATCH]]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await registerNumber({ phoneNumberId: 'P1', wabaId: 'W1', accessToken: 't', userPin: '222222' });
    expect(out.needsPin).toBe(true);
    expect(out.error).toMatch(/doesn't match/);
  });

  it('treats a failed guess on a number Meta already reports live as skipped, not an error', async () => {
    fetchMock = routeFetch([
      ['/register', () => json({ error: { message: 'Test numbers cannot be registered', code: 100 } }, 400)],
      ['/phone_numbers', () => json({ data: [{ id: 'P1', display_phone_number: '+1 555', status: 'CONNECTED' }] })],
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await registerNumber({ phoneNumberId: 'P1', wabaId: 'W1', accessToken: 't' });
    expect(out).toMatchObject({ registeredAt: null, error: null, needsPin: false, skipped: true });
  });

  it('reports other failures on a number that is not live yet', async () => {
    fetchMock = routeFetch([
      ['/register', () => json({ error: { message: 'Phone number not verified', code: 100 } }, 400)],
      ['/phone_numbers', () => json({ data: [{ id: 'P1', display_phone_number: '+1 555', status: 'PENDING' }] })],
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await registerNumber({ phoneNumberId: 'P1', wabaId: 'W1', accessToken: 't' });
    expect(out).toMatchObject({ skipped: false, needsPin: false, error: 'Phone number not verified' });
  });
});

describe('isPinMismatchError', () => {
  it('matches Meta’s code or its wording', () => {
    expect(isPinMismatchError(Object.assign(new Error('x'), { code: 133005 }))).toBe(true);
    expect(isPinMismatchError(new Error('Two step verification PIN Mismatch'))).toBe(true);
    expect(isPinMismatchError(new Error('Rate limit hit'))).toBe(false);
  });
});

describe('discoverPhoneNumbers', () => {
  const numbers = () =>
    json({
      data: [{ id: 'P1', display_phone_number: '+91 98765 43210', verified_name: 'Acme', status: 'PENDING' }],
    });

  it('finds numbers under the WABAs named in the token’s granular scopes', async () => {
    fetchMock = routeFetch([
      [
        '/debug_token',
        () =>
          json({
            data: {
              app_id: 'APP',
              is_valid: true,
              granular_scopes: [
                { scope: 'whatsapp_business_management', target_ids: ['W1'] },
                { scope: 'whatsapp_business_messaging', target_ids: ['W1'] },
                { scope: 'business_management', target_ids: ['B9'] },
              ],
            },
          }),
      ],
      ['/W1/phone_numbers', numbers],
      ['/W1?fields', () => json({ id: 'W1', name: 'Acme WABA' })],
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await discoverPhoneNumbers({ accessToken: 't', appId: 'APP', appSecret: 's' });
    expect(out.sameApp).toBe(true);
    expect(out.numbers).toEqual([
      {
        phoneNumberId: 'P1',
        displayPhoneNumber: '+91 98765 43210',
        verifiedName: 'Acme',
        status: 'PENDING',
        qualityRating: null,
        wabaId: 'W1',
        wabaName: 'Acme WABA',
      },
    ]);
  });

  it('flags a token issued for another Meta app', async () => {
    fetchMock = routeFetch([
      [
        '/debug_token',
        () => json({ data: { app_id: 'OTHER', is_valid: true, granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['W1'] }] } }),
      ],
      ['/W1/phone_numbers', numbers],
      ['/W1?fields', () => json({ id: 'W1' })],
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await discoverPhoneNumbers({ accessToken: 't', appId: 'APP', appSecret: 's' });
    expect(out.sameApp).toBe(false);
  });

  it('falls back to the token’s businesses when no WABA is named', async () => {
    fetchMock = routeFetch([
      ['/debug_token', () => json({ data: { app_id: 'APP', is_valid: true, granular_scopes: [] } })],
      ['/me/businesses', () => json({ data: [{ id: 'B1' }] })],
      ['/B1/owned_whatsapp_business_accounts', () => json({ data: [{ id: 'W1', name: 'Owned' }] })],
      ['/B1/client_whatsapp_business_accounts', () => json({ error: { message: 'no permission' } }, 403)],
      ['/W1/phone_numbers', numbers],
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const out = await discoverPhoneNumbers({ accessToken: 't' });
    expect(out.numbers.map((n) => [n.phoneNumberId, n.wabaName])).toEqual([['P1', 'Owned']]);
    expect(out.sameApp).toBeNull();
  });

  it('rejects a token Meta says is no longer valid', async () => {
    fetchMock = routeFetch([['/debug_token', () => json({ data: { is_valid: false } })]]);
    vi.stubGlobal('fetch', fetchMock);
    await expect(discoverPhoneNumbers({ accessToken: 't' })).rejects.toThrow(ConnectFlowError);
  });

  it('explains when the token reaches no WhatsApp account', async () => {
    fetchMock = routeFetch([
      ['/debug_token', () => json({ data: { is_valid: true, granular_scopes: [] } })],
      ['/me/businesses', () => json({ data: [] })],
    ]);
    vi.stubGlobal('fetch', fetchMock);
    await expect(discoverPhoneNumbers({ accessToken: 't' })).rejects.toThrow(/can't see any WhatsApp Business Account/);
  });
});
