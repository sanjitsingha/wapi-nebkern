import { NextResponse } from 'next/server';
import { getAdminUser, isAdminEmail } from '../../../../_lib/auth';
import { adminDb } from '../../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ~100 years — Supabase's ban mechanism is time-boxed (`banned_until`), so an
// "indefinite" suspend is just a very long ban we lift on reactivate.
const BAN_INDEFINITE = '876000h';

/**
 * Suspend or reactivate a user's login. Admin-only.
 *
 * Body: { action: 'suspend' | 'reactivate' }. Suspend sets `banned_until`
 * far in the future (they can't sign in); reactivate clears it. Reversible
 * either way — no data is touched. Admin-allowlisted accounts are protected
 * so an operator can't lock themselves (or a peer) out of the back office.
 */
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
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'suspend' && action !== 'reactivate') {
    return NextResponse.json(
      { error: "action must be 'suspend' or 'reactivate'" },
      { status: 400 },
    );
  }

  const db = adminDb();
  const { data: target, error: getErr } = await db.auth.admin.getUserById(id);
  if (getErr || !target?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (isAdminEmail(target.user.email)) {
    return NextResponse.json(
      { error: 'This is an admin account and cannot be suspended.' },
      { status: 403 },
    );
  }

  const { error } = await db.auth.admin.updateUserById(id, {
    ban_duration: action === 'suspend' ? BAN_INDEFINITE : 'none',
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
