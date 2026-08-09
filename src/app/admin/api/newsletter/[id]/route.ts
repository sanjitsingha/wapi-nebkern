import { NextResponse } from 'next/server';

import { getAdminUser } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';
import { ADMIN_TAGS, revalidateAdmin } from '../../../_lib/admin-cache';

/**
 * POST /admin/api/newsletter/[id] — { status }
 *
 * The manual lever for when someone asks to come off the list by
 * replying to an email or writing in, rather than clicking the link.
 * Honouring that request is not optional, so there has to be a way to
 * do it that is not "edit the row in Supabase".
 */
const STATUSES = new Set(['subscribed', 'unsubscribed']);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  const status = typeof body?.status === 'string' ? body.status : '';
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
  }

  const { error } = await adminDb()
    .from('newsletter_subscribers')
    .update({
      status,
      unsubscribed_at:
        status === 'unsubscribed' ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateAdmin(ADMIN_TAGS.newsletter);
  return NextResponse.json({ ok: true });
}
