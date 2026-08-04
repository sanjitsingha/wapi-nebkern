import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { deleteR2Object, isR2Configured } from '@/lib/storage/r2';

/**
 * DELETE /api/storage/object?path=<key>
 *
 * Removes an R2 object. Used to garbage-collect media that was staged
 * but never sent — a cancelled draft, a failed Meta send, or a media
 * library row whose insert failed after the upload succeeded.
 *
 * The ownership check is the whole point of this route existing. R2
 * credentials can delete anything in the bucket, so the path is
 * verified to sit inside the caller's own `account-<uuid>/` folder
 * before the delete is issued. Without that, any signed-in user could
 * pass another account's path and wipe their attachments.
 */
export async function DELETE(request: Request) {
  try {
    const { accountId } = await getCurrentAccount();

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'R2 is not configured' },
        { status: 501 },
      );
    }

    const path = new URL(request.url).searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'A path is required' }, { status: 400 });
    }

    // Paths are `<bucket-prefix>/account-<uuid>/<file>`. Require the
    // caller's own account segment, and reject any traversal attempt
    // before it reaches the S3 client.
    if (path.includes('..') || !path.includes(`/account-${accountId}/`)) {
      return NextResponse.json({ error: 'Not your file' }, { status: 403 });
    }

    await deleteR2Object(path);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
