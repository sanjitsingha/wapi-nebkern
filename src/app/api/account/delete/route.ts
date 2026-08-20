import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/account/admin-client';
import { sendMailQuietly } from '@/lib/email/deomail';
import {
  DELETION_WINDOW_DAYS,
  deletionScheduledEmail,
  purgeDateFrom,
} from '@/lib/account/deletion';

/**
 * Start the deletion window for the caller's account.
 *
 * Owner only. Deleting an organisation destroys the work of everyone in
 * it, so it is not something an admin can do — and `requireRole` has
 * already thrown by the time we get here if the account is itself
 * locked, which is what stops a second request restarting the clock.
 *
 * Nothing is deleted now. The row is stamped, which locks every member
 * out on their next request, and the accounts cron does the real
 * removal once the window closes.
 *
 * The confirmation goes to the OWNER's address, not the caller's. When
 * those differ it is because someone else's session pressed the button,
 * and that email is how the owner learns about it while there is still
 * time to undo it.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole('owner');

    const body = await request.json().catch(() => null);
    const reason =
      body && typeof body === 'object' && typeof body.reason === 'string'
        ? body.reason.trim().slice(0, 500)
        : null;

    const admin = supabaseAdmin();
    const requestedAt = new Date();
    const purgeAt = purgeDateFrom(requestedAt);

    // Guarded on `deletion_requested_at IS NULL` so two clicks racing
    // each other cannot move the purge date twice — the second finds no
    // row and leaves the first window intact.
    const { data: locked, error } = await admin
      .from('accounts')
      .update({
        deletion_requested_at: requestedAt.toISOString(),
        deletion_purge_at: purgeAt.toISOString(),
        deletion_requested_by: ctx.userId,
        deletion_reason: reason,
      })
      .eq('id', ctx.accountId)
      .is('deletion_requested_at', null)
      .select('id, name, owner_user_id')
      .maybeSingle();

    if (error) {
      console.error('[account-delete] update failed:', error.message);
      return NextResponse.json(
        { error: 'Could not schedule deletion' },
        { status: 500 }
      );
    }
    if (!locked) {
      // Already inside a window. Idempotent rather than an error — the
      // caller wanted it deleted and it is.
      return NextResponse.json({ alreadyScheduled: true });
    }

    // Best-effort mail: a delivery failure must not leave the account
    // in a state where the lock applied but the caller was told it did
    // not. sendMailQuietly logs and swallows.
    const {
      data: { user: owner },
    } = await admin.auth.admin.getUserById(locked.owner_user_id as string);
    const actorEmail =
      ctx.userId === locked.owner_user_id
        ? null
        : ((await admin.auth.admin.getUserById(ctx.userId)).data.user?.email ??
          null);

    if (owner?.email) {
      const mail = deletionScheduledEmail({
        accountName: locked.name as string,
        purgeAt,
        actorEmail,
      });
      await sendMailQuietly(
        { from: 'system', to: owner.email, ...mail },
        'account deletion scheduled'
      );
    }

    return NextResponse.json({
      scheduled: true,
      purgeAt: purgeAt.toISOString(),
      windowDays: DELETION_WINDOW_DAYS,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
