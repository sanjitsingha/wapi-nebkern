import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../_lib/auth';
import { adminDb } from '../../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = new Set(['open', 'pending', 'resolved', 'closed']);

/** Change a support ticket's status. Admin-only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!STATUSES.has(body?.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from('support_tickets')
    .update({ status: body.status })
    .eq('id', id)
    .select('id, status')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ticket: data });
}
