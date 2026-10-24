import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const r2 = vi.hoisted(() => ({
  isR2Configured: vi.fn(() => true),
  putR2Object: vi.fn(async () => {}),
  r2PublicUrl: vi.fn((path: string) => `https://media.example/${path}`),
}));
vi.mock('@/lib/storage/r2', () => r2);

/** Records the contacts update chain: update(row).eq().eq().is(). */
const db = vi.hoisted(() => {
  const calls: { update?: unknown; filters: unknown[][] } = { filters: [] };
  const chain = {
    eq: (...a: unknown[]) => (calls.filters.push(['eq', ...a]), chain),
    is: (...a: unknown[]) => (calls.filters.push(['is', ...a]), Promise.resolve({ error: null })),
  };
  return {
    calls,
    supabaseAdmin: () => ({
      from: () => ({ update: (row: unknown) => ((calls.update = row), chain) }),
    }),
  };
});
vi.mock('@/lib/flows/admin-client', () => ({ supabaseAdmin: db.supabaseAdmin }));

import { avatarType, saveContactAvatar } from './avatar';

function image(type: string, bytes = 64): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': type } });
}

const ARGS = { accountId: 'acc', contactId: 'c1', sourceUrl: 'https://scontent.xx.fbcdn.net/a.jpg' };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  db.calls.update = undefined;
  db.calls.filters = [];
  r2.putR2Object.mockClear();
  r2.isR2Configured.mockReturnValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('avatarType', () => {
  it('keeps the common image types and nothing else', () => {
    expect(avatarType('image/jpeg; charset=binary')).toEqual({ type: 'image/jpeg', ext: 'jpg' });
    expect(avatarType('image/webp')).toEqual({ type: 'image/webp', ext: 'webp' });
    expect(avatarType('text/html')).toBeNull();
    expect(avatarType(null)).toBeNull();
  });
});

describe('saveContactAvatar', () => {
  it('stores the image on R2 and fills an empty avatar with our copy', async () => {
    fetchMock.mockResolvedValueOnce(image('image/jpeg'));
    expect(await saveContactAvatar(ARGS)).toBe(true);

    const [path, , type] = r2.putR2Object.mock.calls[0] as unknown as [string, Uint8Array, string];
    expect(path).toMatch(/^contact-avatars\/account-acc\/c1-\d+\.jpg$/);
    expect(type).toBe('image/jpeg');
    expect(db.calls.update).toEqual({ avatar_url: `https://media.example/${path}` });
    // Never replaces an avatar that is already there.
    expect(db.calls.filters).toContainEqual(['is', 'avatar_url', null]);
  });

  it('skips anything that is not an image', async () => {
    fetchMock.mockResolvedValueOnce(image('text/html'));
    expect(await saveContactAvatar(ARGS)).toBe(false);
    expect(r2.putR2Object).not.toHaveBeenCalled();
  });

  it('skips an oversized file', async () => {
    fetchMock.mockResolvedValueOnce(image('image/png', 3 * 1024 * 1024));
    expect(await saveContactAvatar(ARGS)).toBe(false);
    expect(r2.putR2Object).not.toHaveBeenCalled();
  });

  it('does nothing without R2, and never throws on a failed download', async () => {
    r2.isR2Configured.mockReturnValue(false);
    expect(await saveContactAvatar(ARGS)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    r2.isR2Configured.mockReturnValue(true);
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    expect(await saveContactAvatar(ARGS)).toBe(false);
  });
});
