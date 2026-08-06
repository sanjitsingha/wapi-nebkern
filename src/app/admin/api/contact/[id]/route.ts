import { NextResponse } from 'next/server';

import { getAdminUser } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';

/** The only field the back office may change — the triage state. The
 *  enquiry itself is what somebody sent us and is not ours to edit. */
const STATUSES = new Set(['new', 'read', 'replied', 'spam']);

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
    .from('contact_submissions')
    .update({ status })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
