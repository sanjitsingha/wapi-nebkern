import { NextResponse } from 'next/server';

import { isR2Configured, presignUpload, r2PublicUrl } from '@/lib/storage/r2';
import { getAdminUser } from '../../../_lib/auth';

/**
 * POST /admin/api/blog/upload-url
 *
 * Hands the editor a short-lived link to PUT one blog cover image
 * straight to R2, plus the public URL it will be served from.
 *
 * WHY A SEPARATE ROUTE FROM /api/storage/upload-url
 *
 * That one authenticates with `getCurrentAccount()` and builds its key
 * from the caller's tenant — every object lands under `account-<uuid>/`
 * in a prefix meant for chat media. A blog cover has no tenant: it is
 * published on the public marketing site. Reusing it would file site
 * artwork inside whichever customer workspace the operator happened to
 * be signed into, and delete it with that account.
 *
 * So: admin allowlist instead of a tenant session, and a fixed public
 * `blog/` prefix. As there, the server owns the path — the client sends
 * a filename and content type, never a key.
 */

/** Covers are hero images on a marketing page, not raw camera files. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Allow-listed rather than "anything image/*": SVG is an image type
 *  that can carry script, and these are served from our own domain. */
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
]);

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: 'Image storage is not configured on this deployment' },
      { status: 501 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    contentType?: unknown;
    size?: unknown;
    kind?: unknown;
  } | null;

  const contentType =
    typeof body?.contentType === 'string' ? body.contentType : '';
  const ext = ALLOWED.get(contentType);
  if (!ext) {
    return NextResponse.json(
      { error: 'Use a JPEG, PNG, WebP, AVIF or GIF image' },
      { status: 400 }
    );
  }

  const size = typeof body?.size === 'number' ? body.size : 0;
  if (!size || size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Keep the image under ${MAX_BYTES / 1024 / 1024} MB` },
      { status: 400 }
    );
  }

  // Two prefixes so a cover and an in-body illustration stay tellable
  // apart in the bucket. Allow-listed, never free text — the client
  // picks between fixed options and cannot name a folder.
  const prefix = body?.kind === 'inline' ? 'blog/inline' : 'blog/covers';

  // Random, timestamped key: images are replaced often, and a stable
  // name would be served stale for a year by the immutable cache header
  // `presignUpload` sets. Nothing user-supplied reaches the path.
  const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const uploadUrl = await presignUpload(key, contentType);
  return NextResponse.json({ uploadUrl, publicUrl: r2PublicUrl(key) });
}
