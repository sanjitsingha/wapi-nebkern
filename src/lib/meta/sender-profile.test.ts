import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getInstagramSenderName,
  getInstagramSenderPicture,
  getMessengerSenderName,
  getMessengerSenderPicture,
  hasPlaceholderName,
} from './sender-profile';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getMessengerSenderName', () => {
  it('joins first and last name from the PSID profile', async () => {
    fetchMock.mockResolvedValueOnce(json({ first_name: 'Asha', last_name: 'Rai', id: '123' }));
    expect(await getMessengerSenderName({ psid: '123', pageAccessToken: 'tok' })).toBe('Asha Rai');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('graph.facebook.com/v21.0/123?');
    expect(url).toContain('fields=first_name%2Clast_name');
  });

  it('returns null when Meta refuses, so the caller keeps the id', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'no permission' } }, 400));
    expect(await getMessengerSenderName({ psid: '123', pageAccessToken: 'tok' })).toBeNull();
  });

  it('returns null on a network failure instead of throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    expect(await getMessengerSenderName({ psid: '123', pageAccessToken: 'tok' })).toBeNull();
  });
});

describe('getInstagramSenderName', () => {
  it('prefers the name, through graph.facebook.com for a Page token', async () => {
    fetchMock.mockResolvedValueOnce(json({ name: 'Asha Rai', username: 'asha' }));
    expect(await getInstagramSenderName({ igsid: '987', accessToken: 'tok', viaPage: true })).toBe('Asha Rai');
    expect(fetchMock.mock.calls[0][0]).toContain('https://graph.facebook.com/v21.0/987?');
  });

  it('falls back to @username, through graph.instagram.com without a Page', async () => {
    fetchMock.mockResolvedValueOnce(json({ username: 'asha' }));
    expect(await getInstagramSenderName({ igsid: '987', accessToken: 'tok', viaPage: false })).toBe('@asha');
    expect(fetchMock.mock.calls[0][0]).toContain('https://graph.instagram.com/v21.0/987?');
  });

  it('returns null when the profile has neither', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: '987' }));
    expect(await getInstagramSenderName({ igsid: '987', accessToken: 'tok', viaPage: true })).toBeNull();
  });
});

describe('sender pictures', () => {
  const PIC = 'https://scontent.xx.fbcdn.net/v/t1/abc.jpg?oh=1&oe=2';

  it('reads a Messenger sender’s profile_pic, asking for nothing else', async () => {
    fetchMock.mockResolvedValueOnce(json({ profile_pic: PIC, id: '123' }));
    expect(await getMessengerSenderPicture({ psid: '123', pageAccessToken: 'tok' })).toBe(PIC);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('graph.facebook.com/v21.0/123?');
    expect(url).toContain('fields=profile_pic&');
  });

  it('reads an Instagram sender’s picture on the same host as their name', async () => {
    fetchMock.mockResolvedValueOnce(json({ profile_pic: PIC }));
    expect(await getInstagramSenderPicture({ igsid: '987', accessToken: 'tok', viaPage: false })).toBe(PIC);
    expect(fetchMock.mock.calls[0][0]).toContain('https://graph.instagram.com/v21.0/987?');
  });

  it('returns null when Meta refuses or the link is not https', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'no permission' } }, 400));
    expect(await getMessengerSenderPicture({ psid: '123', pageAccessToken: 'tok' })).toBeNull();
    fetchMock.mockResolvedValueOnce(json({ profile_pic: 'http://insecure.example/a.jpg' }));
    expect(await getInstagramSenderPicture({ igsid: '987', accessToken: 'tok', viaPage: true })).toBeNull();
  });
});

describe('hasPlaceholderName', () => {
  it('is true only for an empty name or the raw sender id', () => {
    expect(hasPlaceholderName('123', '123')).toBe(true);
    expect(hasPlaceholderName('', '123')).toBe(true);
    expect(hasPlaceholderName(null, '123')).toBe(true);
    expect(hasPlaceholderName('Asha', '123')).toBe(false);
  });
});
