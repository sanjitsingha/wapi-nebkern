import { NextResponse } from 'next/server';
import { getAdminUser, isAdminEmail } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permanently delete a user. Admin-only, irreversible.
 *
 * Deleting the auth user cascades their profile (ON DELETE CASCADE). Two
 * guards:
 *   - Admin-allowlisted accounts are never deletable from here.
 *   - A user who OWNS an account is blocked: `accounts.owner_user_id` is
 *     ON DELETE RESTRICT, so the delete would fail at the DB anyway — we
 *     catch it first and return a clear message. Reassign ownership or
 *     delete that workspace before removing the person.
 */
export async function DELETE(
  _request: Request,
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

  const db = adminDb();

  const { data: target, error: getErr } = await db.auth.admin.getUserById(id);
  if (getErr || !target?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (isAdminEmail(target.user.email)) {
    return NextResponse.json(
      { error: 'This is an admin account and cannot be deleted.' },
      { status: 403 },
    );
  }

  const { data: owned, error: ownErr } = await db
    .from('accounts')
    .select('id, name')
    .eq('owner_user_id', id);
  if (ownErr) {
    return NextResponse.json({ error: ownErr.message }, { status: 500 });
  }
  if (owned && owned.length > 0) {
    const name = owned[0].name;
    return NextResponse.json(
      {
        error:
          `This user owns the workspace "${name}". Reassign ownership to ` +
          `another member (or delete that account) before deleting the user.`,
      },
      { status: 409 },
    );
  }

  const { error } = await db.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
