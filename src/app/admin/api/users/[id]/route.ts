import { NextResponse } from 'next/server';

import { ADMIN_TAGS, revalidateAdmin } from '../../../_lib/admin-cache';
import { getAdminUser, isAdminEmail } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permanently delete a user. Admin-only, irreversible.
 *
 * Two-step by design, because of how the schema is wired.
 * `accounts.owner_user_id` is ON DELETE RESTRICT — the one FK to
 * auth.users that doesn't cascade — so Postgres refuses to remove a user
 * while they still own an account. Every signup owns one (the signup
 * trigger creates it), so "delete the user" almost always means "delete
 * their workspace too".
 *
 * That's a big enough hammer to require saying so out loud:
 *
 *   1st call  -> 409 { requiresAccountDeletion, workspaces, otherMembers }
 *   2nd call  -> with { deleteOwnedAccount: true }, does it
 *
 * Deleting the account row cascades roughly forty tables (contacts,
 * conversations, deals, invoices, templates, media, webhooks, and the
 * profiles of every member). Members other than the owner keep their
 * auth.users row but lose their profile, which leaves them signed in
 * with no account context — hence the member count in the 409, so the
 * admin sees what they're about to take down.
 *
 * One user can own several workspaces: `remove_account_member` mints a
 * fresh one for whoever was removed, and `transfer_account_ownership`
 * can hand someone a second on top of the one signup gave them. So this
 * works on the whole set — deleting only the first would clear the way
 * for nothing, since the RESTRICT still fires on the rest and we'd stop
 * half-done with a workspace already destroyed.
 *
 * Admin-allowlisted accounts are never deletable from here.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  // Body is optional — a bare DELETE is the first, confirmation-seeking
  // call. Only an explicit flag authorises taking the workspace with it.
  const body = await request.json().catch(() => null);
  const deleteOwnedAccount = body?.deleteOwnedAccount === true;

  const db = adminDb();

  const { data: target, error: getErr } = await db.auth.admin.getUserById(id);
  if (getErr || !target?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (isAdminEmail(target.user.email)) {
    return NextResponse.json(
      { error: 'This is an admin account and cannot be deleted.' },
      { status: 403 }
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
    const accountIds = owned.map((a) => a.id);
    const workspaces = owned.map((a) => a.name);

    const { data: memberRows, error: memErr } = await db
      .from('profiles')
      .select('user_id')
      .in('account_id', accountIds);
    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    // Count the *other* people explicitly rather than subtracting one for
    // the owner: a user has a single profile row, so when they own two
    // workspaces they're only a member of one of them, and "minus one"
    // would undercount who actually loses access.
    const otherMembers = (memberRows ?? []).filter(
      (m) => m.user_id !== id
    ).length;

    if (!deleteOwnedAccount) {
      return NextResponse.json(
        {
          error:
            workspaces.length === 1
              ? `This user owns the workspace "${workspaces[0]}".`
              : `This user owns ${workspaces.length} workspaces.`,
          requiresAccountDeletion: true,
          workspaces,
          otherMembers,
        },
        { status: 409 }
      );
    }

    // Cascades the whole tenant. Must happen before the auth user, or
    // the RESTRICT on owner_user_id blocks it.
    const { error: accErr } = await db
      .from('accounts')
      .delete()
      .in('id', accountIds);
    if (accErr) {
      return NextResponse.json({ error: accErr.message }, { status: 500 });
    }
  }

  const { error } = await db.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Drop the cached account list and overview counters — without
  // this the edit is invisible for up to a minute and reads as a
  // save that silently failed.
  revalidateAdmin(ADMIN_TAGS.accounts, ADMIN_TAGS.overview);
  return NextResponse.json({ success: true });
}
