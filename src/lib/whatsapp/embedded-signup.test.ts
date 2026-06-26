import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exchangeEmbeddedSignupCode,
  getWabaInfo,
  getWabaPhoneNumbers,
} from './meta-api';

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('exchangeEmbeddedSignupCode', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs /oauth/access_token with client_id, client_secret, and code', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({ access_token: 'BIZ_TOKEN', token_type: 'bearer', expires_in: 0 }),
    );
    const result = await exchangeEmbeddedSignupCode({
      code: 'AUTH_CODE',
      appId: 'APP_1',
      appSecret: 'SECRET_1',
    });
    expect(result).toEqual({
      accessToken: 'BIZ_TOKEN',
      tokenType: 'bearer',
      expiresIn: 0,
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/oauth/access_token');
    expect(url).toContain('client_id=APP_1');
    expect(url).toContain('client_secret=SECRET_1');
    expect(url).toContain('code=AUTH_CODE');
    // Embedded Signup code exchange must NOT include a redirect_uri.
    expect(url).not.toContain('redirect_uri');
  });

  it('throws when Meta returns no access_token', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ token_type: 'bearer' }));
    await expect(
      exchangeEmbeddedSignupCode({ code: 'c', appId: 'a', appSecret: 's' }),
    ).rejects.toThrow(/no access_token/i);
  });

  it("surfaces Meta's error message on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(400, { error: { message: 'Invalid application ID' } }),
    );
    await expect(
      exchangeEmbeddedSignupCode({ code: 'c', appId: 'a', appSecret: 's' }),
    ).rejects.toThrow(/Invalid application ID/);
  });
});

describe('getWabaInfo', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs /{waba_id} with the bearer token and returns the body', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({ id: 'WABA_1', name: 'Acme', currency: 'USD' }),
    );
    const info = await getWabaInfo({ wabaId: 'WABA_1', accessToken: 'tok' });
    expect(info.id).toBe('WABA_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/WABA_1?fields=');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('throws on non-OK', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(401, { error: { message: 'Invalid OAuth token' } }),
    );
    await expect(
      getWabaInfo({ wabaId: 'WABA_1', accessToken: 'tok' }),
    ).rejects.toThrow(/Invalid OAuth token/);
  });
});

describe('getWabaPhoneNumbers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the list of phone numbers under the WABA', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        data: [
          { id: 'PNID_1', display_phone_number: '+1 555', status: 'PENDING' },
          { id: 'PNID_2', display_phone_number: '+1 556', status: 'CONNECTED' },
        ],
      }),
    );
    const numbers = await getWabaPhoneNumbers({
      wabaId: 'WABA_1',
      accessToken: 'tok',
    });
    expect(numbers).toHaveLength(2);
    expect(numbers[0].id).toBe('PNID_1');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/WABA_1/phone_numbers');
  });

  it('returns empty array when Meta returns no data field', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    const numbers = await getWabaPhoneNumbers({
      wabaId: 'WABA_1',
      accessToken: 'tok',
    });
    expect(numbers).toEqual([]);
  });

  it('throws on non-OK', async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(403, { error: { message: 'Insufficient permissions' } }),
    );
    await expect(
      getWabaPhoneNumbers({ wabaId: 'WABA_1', accessToken: 'tok' }),
    ).rejects.toThrow(/Insufficient permissions/);
  });
});
