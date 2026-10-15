import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMetaAssets } from './connect';

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

const personalPage = { id: 'P1', name: 'Personal', access_token: 'tok-p1' };
const portfolioPage = {
  id: 'B1',
  name: 'Nebkern Technology',
  access_token: 'tok-b1',
  instagram_business_account: { id: 'IG1', username: 'nebkern' },
};
const granted = (ids: string[]) =>
  json({ data: { granular_scopes: [{ scope: 'pages_show_list', target_ids: ids }, { scope: 'email' }] } });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getMetaAssets', () => {
  it('adds a granted portfolio Page that /me/accounts left out', async () => {
    const fetchMock = routeFetch([
      ['/me/accounts', () => json({ data: [personalPage] })],
      ['/debug_token', () => granted(['P1', 'B1'])],
      ['/B1?', () => json(portfolioPage)],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const assets = await getMetaAssets('user-token');
    expect(assets.map((a) => [a.pageId, a.instagram?.username ?? null])).toEqual([
      ['P1', null],
      ['B1', 'nebkern'],
    ]);
    // P1 came from /me/accounts already — not fetched a second time.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/P1?'))).toBe(false);
  });

  it('finds portfolio Pages when /me/accounts returns none', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch([
        ['/me/accounts', () => json({ data: [] })],
        ['/debug_token', () => granted(['B1'])],
        ['/B1?', () => json(portfolioPage)],
      ]),
    );
    const assets = await getMetaAssets('user-token');
    expect(assets.map((a) => a.pageId)).toEqual(['B1']);
  });

  it('keeps the /me/accounts result when the token can’t be inspected', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch([
        ['/me/accounts', () => json({ data: [personalPage] })],
        ['/debug_token', () => json({ error: { message: 'nope' } }, 400)],
      ]),
    );
    const assets = await getMetaAssets('user-token');
    expect(assets.map((a) => a.pageId)).toEqual(['P1']);
  });

  it('skips a granted Page that returns no Page token', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch([
        ['/me/accounts', () => json({ data: [] })],
        ['/debug_token', () => granted(['B1'])],
        ['/B1?', () => json({ id: 'B1', name: 'No token' })],
      ]),
    );
    expect(await getMetaAssets('user-token')).toEqual([]);
  });
});
