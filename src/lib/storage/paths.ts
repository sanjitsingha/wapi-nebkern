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
