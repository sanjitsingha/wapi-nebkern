// ============================================================
// Object-path construction. Pure — no imports, no I/O, no Supabase.
//
// Split out of upload-media.ts so the server can use it too. That file
// imports the browser Supabase client, which a Route Handler has no
// business pulling in; this one is safe on both sides of the wire.
// ============================================================

/**
 * Build the account-scoped object path for an upload.
 *
 *   account-<account_id>/<timestamp>-<basename>.<ext>
 *
 * The leading `account-<uuid>` segment is load-bearing twice over. On
 * Supabase Storage it is what the bucket's RLS write policies match on
 * (migrations 020/023), so a mismatched segment is silently rejected.
 * On R2 there is no RLS at all, so the segment is instead built
 * server-side from the caller's verified session and never accepted
 * from the client — see /api/storage/upload-url.
 *
 * - `basename` is stripped of its extension, unsafe chars collapse to
 *   `_`, and it's capped at 40 chars (falls back to "file" when empty).
 * - The timestamp plus the original name make a collision between two
 *   concurrent uploads astronomically unlikely.
 */
export function buildMediaPath(
  accountId: string,
  fileName: string,
  now: number = Date.now(),
): string {
  // Only treat the trailing segment as an extension when there's a real
  // one — a bare name like "README" has no extension and falls back to
  // "bin" rather than becoming "readme".
  const hasExt = /\.[^.]+$/.test(fileName);
  const ext = hasExt ? fileName.split('.').pop()!.toLowerCase() : 'bin';
  const safeBase =
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40) || 'file';
  return `account-${accountId}/${now}-${safeBase}.${ext}`;
}

/**
 * The inverse of an upload: recover an object's storage path from the
 * public URL we stored in the database.
 *
 * Needed because rows keep the public URL, not the path — so replacing
 * a file (a new avatar over an old one) has nothing to hand
 * `deleteAccountMedia` without parsing it back out.
 *
 * The two backends print different URLs, and the path each expects
 * differs to match:
 *
 *   Supabase  <origin>/storage/v1/object/public/<bucket>/account-<id>/<file>
 *             -> "account-<id>/<file>"        (bucket is a separate arg)
 *   R2        <public-base>/<bucket>/account-<id>/<file>
 *             -> "<bucket>/account-<id>/<file>"  (bucket is the prefix)
 *
 * Returns null for anything that is not one of ours — an OAuth
 * provider's avatar, a Gravatar, a hand-entered URL, or a malformed
 * one. That case is the whole reason this returns a nullable: a caller
 * about to delete "the old file" must not delete a URL it never
 * uploaded. Requiring the `account-` segment is what draws that line;
 * a URL without it is not something this app put in a bucket.
 *
 * Note this establishes only that a path LOOKS like ours. It is not an
 * ownership check — the delete route re-derives the caller's account
 * from their session and refuses any path outside it, which is where
 * tenant separation is actually enforced.
 */
export function storagePathFromPublicUrl(
  bucket: string,
  url: string,
): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  const supabaseMarker = `/storage/v1/object/public/${bucket}/`;
  const supabaseAt = pathname.indexOf(supabaseMarker);
  if (supabaseAt !== -1) {
    const rest = pathname.slice(supabaseAt + supabaseMarker.length);
    return rest.startsWith('account-') ? decodeURIComponent(rest) : null;
  }

  // Leading slash dropped so the bucket prefix leads, which is the shape
  // R2 keys take.
  const r2Marker = `/${bucket}/account-`;
  const r2At = pathname.indexOf(r2Marker);
  if (r2At !== -1) return decodeURIComponent(pathname.slice(r2At + 1));

  return null;
}
