/**
 * A contact's profile picture, copied into our own media bucket.
 *
 * Messenger and Instagram hand out profile pictures as signed Meta CDN
 * links that stop working within days, so the link itself can't be the
 * avatar: the image is fetched once, stored on R2, and the contact
 * points at our copy. (WhatsApp shares no profile pictures at all, so
 * WhatsApp contacts keep their initials.)
 *
 * Best effort: false whenever anything is off — no R2 here, a refused or
 * slow download, something that isn't an image — and the caller tries
 * again on the person's next message. Never throws.
 *
 * Server-only.
 */

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { isR2Configured, putR2Object, r2PublicUrl } from '@/lib/storage/r2';

const FETCH_TIMEOUT_MS = 8000;
/** Profile pictures are a few dozen KB; anything near this isn't one. */
const MAX_BYTES = 2 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** The bare image type and its file extension, or null if it isn't one we keep. */
export function avatarType(contentType: string | null): { type: string; ext: string } | null {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXTENSIONS[type];
  return ext ? { type, ext } : null;
}

export async function saveContactAvatar(args: {
  accountId: string;
  contactId: string;
  sourceUrl: string;
}): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    const res = await fetch(args.sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      // The status alone: the link is signed.
      console.warn(`[contact-avatar] download failed: ${res.status}`);
      return false;
    }
    const image = avatarType(res.headers.get('content-type'));
    if (!image || Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return false;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return false;

    // A fresh name each time: stored objects are cached as immutable.
    const path = `contact-avatars/account-${args.accountId}/${args.contactId}-${Date.now()}.${image.ext}`;
    await putR2Object(path, bytes, image.type);

    // Fills an empty avatar only — never replaces one already there.
    const { error } = await supabaseAdmin()
      .from('contacts')
      .update({ avatar_url: r2PublicUrl(path) })
      .eq('id', args.contactId)
      .eq('account_id', args.accountId)
      .is('avatar_url', null);
    if (error) {
      console.warn('[contact-avatar] save failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[contact-avatar] failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
