import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { isR2Configured, presignUpload, r2PublicUrl } from '@/lib/storage/r2';
import { buildMediaPath } from '@/lib/storage/paths';

/**
 * POST /api/storage/upload-url
 *
 * Hands the browser a short-lived link to upload one file straight to
 * Cloudflare R2, plus the public URL that file will be served from.
 *
 * WHY THE SERVER OWNS THE PATH
 *
 * On Supabase Storage the bucket's RLS policy enforced tenant
 * separation: a client could ask to write anywhere, and the database
 * rejected anything outside its own `account-<uuid>/` folder. R2 has no
 * equivalent — a presigned link grants exactly what it was signed for
 * and nothing else. So the account prefix is built HERE, from the
 * caller's verified session, and the requested path is never trusted.
 * A client cannot ask to write into another account's folder because it
 * never gets to name the folder.
 *
 * Size and type limits move server-side for the same reason: the
 * bucket's own `file_size_limit` no longer applies once we leave
 * Supabase, so this route is the only thing standing between a caller
 * and an arbitrarily large object.
 */

/** Buckets become path prefixes in the single R2 bucket. Allow-listed
 *  rather than free-text so a caller can't invent a namespace. */
const ALLOWED_PREFIXES = new Set([
  'chat-media',
  'flow-media',
  'template-media',
  'avatars',
]);

/** 16 MB — the ceiling the UI has always advertised (upload-media.ts). */
const MAX_BYTES = 16 * 1024 * 1024;

/** Per-kind caps mirroring Meta's WhatsApp Cloud API limits, so a file
 *  R2 would accept but Meta would reject is refused before it is
 *  stored rather than failing confusingly at send time. */
const MAX_BYTES_BY_TYPE: { test: RegExp; max: number }[] = [
  { test: /^image\//, max: 5 * 1024 * 1024 },
  { test: /^video\//, max: 16 * 1024 * 1024 },
  { test: /^audio\//, max: 16 * 1024 * 1024 },
];

export async function POST(request: Request) {
  try {
    const { accountId } = await getCurrentAccount();

    if (!isR2Configured()) {
      // Not an error — the client falls back to Supabase Storage.
      return NextResponse.json(
        { configured: false },
        { status: 200 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      bucket?: unknown;
      fileName?: unknown;
      contentType?: unknown;
      size?: unknown;
    } | null;

    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { bucket, fileName, contentType, size } = body;

    if (typeof bucket !== 'string' || !ALLOWED_PREFIXES.has(bucket)) {
      return NextResponse.json({ error: 'Unknown bucket' }, { status: 400 });
    }
    if (typeof fileName !== 'string' || !fileName.trim()) {
      return NextResponse.json({ error: 'A file name is required' }, { status: 400 });
    }
    if (typeof contentType !== 'string' || !contentType.trim()) {
      return NextResponse.json({ error: 'A content type is required' }, { status: 400 });
    }
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'A file size is required' }, { status: 400 });
    }

    const kindCap = MAX_BYTES_BY_TYPE.find((r) => r.test.test(contentType));
    const cap = kindCap ? kindCap.max : MAX_BYTES;
    if (size > cap) {
      return NextResponse.json(
        {
          error: `That file is too large — the limit for this type is ${Math.floor(
            cap / (1024 * 1024),
          )} MB.`,
        },
        { status: 413 },
      );
    }

    // Path is derived from the SESSION's account, never from input.
    const path = `${bucket}/${buildMediaPath(accountId, fileName)}`;
    const uploadUrl = await presignUpload(path, contentType);

    return NextResponse.json({
      configured: true,
      uploadUrl,
      publicUrl: r2PublicUrl(path),
      path,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
