/**
 * The name behind a Messenger PSID or an Instagram IGSID.
 *
 * Messenger and Instagram webhooks carry only an opaque, Page-scoped id
 * for the sender, so a contact created from one used to be named by
 * that id — a row of random digits in the inbox. Meta's User Profile
 * APIs turn the id into a name, using the Page token we already hold.
 *
 * Best-effort by design: null whenever Meta won't say (the person's
 * privacy settings, a missing permission, a deleted account, a slow
 * response) — the caller keeps the id and tries again on their next
 * message. Never throws, and gives up after LOOKUP_TIMEOUT_MS so a slow
 * Graph call can't hold up the webhook.
 *
 * Server-only — the URLs carry Page tokens.
 */

const META_API_VERSION = 'v21.0';
const LOOKUP_TIMEOUT_MS = 3000;

async function getProfile(url: string, op: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) {
      // The status alone: the URL holds the Page token.
      console.warn(`[meta:${op}] profile lookup failed: ${response.status}`);
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn(`[meta:${op}] profile lookup failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** "First Last" for a Messenger sender, via the Page token. */
export async function getMessengerSenderName(args: {
  psid: string;
  pageAccessToken: string;
}): Promise<string | null> {
  const params = new URLSearchParams({
    fields: 'first_name,last_name',
    access_token: args.pageAccessToken,
  });
  const profile = await getProfile(
    `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(args.psid)}?${params.toString()}`,
    'getMessengerSenderName',
  );
  if (!profile) return null;
  const name = [text(profile.first_name), text(profile.last_name)].filter(Boolean).join(' ');
  return name || null;
}

/**
 * An Instagram sender's name, else their @username. A Page token (the
 * Facebook-Page connection) goes through graph.facebook.com; a token
 * from Instagram Login, which has no Page, through graph.instagram.com.
 */
export async function getInstagramSenderName(args: {
  igsid: string;
  accessToken: string;
  viaPage: boolean;
}): Promise<string | null> {
  const host = args.viaPage ? 'graph.facebook.com' : 'graph.instagram.com';
  const params = new URLSearchParams({ fields: 'name,username', access_token: args.accessToken });
  const profile = await getProfile(
    `https://${host}/${META_API_VERSION}/${encodeURIComponent(args.igsid)}?${params.toString()}`,
    'getInstagramSenderName',
  );
  if (!profile) return null;
  const username = text(profile.username);
  return text(profile.name) || (username ? `@${username}` : null);
}

/** A profile picture link, if the profile holds a usable one. */
function pictureUrl(profile: Record<string, unknown> | null): string | null {
  const url = text(profile?.profile_pic);
  return url.startsWith('https://') ? url : null;
}

/**
 * A Messenger sender's profile picture: a signed Meta CDN link that
 * stops working within days, so store a copy rather than the link
 * (lib/contacts/avatar.ts). Asked for on its own, not alongside the
 * name, so a refusal here can never cost the contact its name.
 */
export async function getMessengerSenderPicture(args: {
  psid: string;
  pageAccessToken: string;
}): Promise<string | null> {
  const params = new URLSearchParams({ fields: 'profile_pic', access_token: args.pageAccessToken });
  return pictureUrl(
    await getProfile(
      `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(args.psid)}?${params.toString()}`,
      'getMessengerSenderPicture',
    ),
  );
}

/** An Instagram sender's profile picture — as above, and on the same
 *  host choice as getInstagramSenderName. */
export async function getInstagramSenderPicture(args: {
  igsid: string;
  accessToken: string;
  viaPage: boolean;
}): Promise<string | null> {
  const host = args.viaPage ? 'graph.facebook.com' : 'graph.instagram.com';
  const params = new URLSearchParams({ fields: 'profile_pic', access_token: args.accessToken });
  return pictureUrl(
    await getProfile(
      `https://${host}/${META_API_VERSION}/${encodeURIComponent(args.igsid)}?${params.toString()}`,
      'getInstagramSenderPicture',
    ),
  );
}

/**
 * Whether a contact still carries the placeholder name the webhook gave
 * it (the raw sender id, or nothing) — the only names a lookup may
 * replace. A name a teammate typed in is never overwritten.
 */
export function hasPlaceholderName(name: unknown, senderId: string): boolean {
  const current = text(name);
  return current === '' || current === senderId;
}
