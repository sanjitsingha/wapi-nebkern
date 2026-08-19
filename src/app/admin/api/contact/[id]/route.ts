import { NextResponse } from 'next/server';

import { getAdminUser } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';
import { ADMIN_TAGS, revalidateAdmin } from '../../../_lib/admin-cache';

/** The only field the back office may change — the triage state. The
 *  enquiry itself is what somebody sent us and is not ours to edit. */
const STATUSES = new Set(['new', 'read', 'replied', 'spam']);

const ID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!ID_RE.test(id)) {
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
    .from('contact_submissions')
    .update({ status })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateAdmin(ADMIN_TAGS.contact);
  return NextResponse.json({ ok: true });
}

/**
 * Drop an enquiry for good.
 *
 * There is no soft-delete column on contact_submissions, so this is a
 * real row delete with nothing to restore from — the caller is expected
 * to have confirmed with a human first. `spam` exists for the "hide it
 * but keep it" case; deletion is for genuine junk and for erasure
 * requests, where keeping a copy is the wrong answer.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  }

  const { error } = await adminDb()
    .from('contact_submissions')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidateAdmin(ADMIN_TAGS.contact);
  return NextResponse.json({ ok: true });
}
