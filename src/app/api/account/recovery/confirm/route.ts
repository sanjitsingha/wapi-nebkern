import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/account/admin-client';
import { hashRecoveryToken } from '@/lib/account/deletion';

/**
 * Spend a recovery link and bring the account back.
 *
 * Public, like the request route — the whole point is that the person
 * cannot sign in. What stands in for a session is the token: 256 bits
 * of randomness delivered to the address already on the account.
 *
 * Clearing `deletion_requested_at` fires the 086 trigger, which
 * rewrites app_metadata for every member. Because getUser() reads the
 * live auth row rather than the JWT's copy, they are back in on their
 * very next request — no re-login, no waiting for a token refresh.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token =
    body && typeof body === 'object' && typeof body.token === 'string'
      ? body.token.trim()
      : '';

  const invalid = NextResponse.json(
    { error: 'That recovery link is invalid, already used, or expired.' },
    { status: 400 }
  );

  if (!token) return invalid;

  const admin = supabaseAdmin();

  try {
    // Look the token up BY ITS HASH. The raw token is never stored, so
    // this is the only way to find the row — and it means a database
    // leak yields no usable links.
    const { data: row } = await admin
      .from('account_recovery_tokens')
      .select('id, account_id, expires_at, consumed_at')
      .eq('token_hash', hashRecoveryToken(token))
      .maybeSingle();

    if (!row || row.consumed_at) return invalid;
    if (new Date(row.expires_at as string).getTime() <= Date.now()) {
      return invalid;
    }

    // Consume first, guarded on still being unconsumed. If two clicks
    // race, only one wins the update and the other gets `invalid` —
    // better that than both proceeding to restore.
    const { data: consumed } = await admin
      .from('account_recovery_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle();
    if (!consumed) return invalid;

    // Restore, but only if the purge has not already run past it. A
    // token minted at hour 23 of day 29 could otherwise be spent after
    // the sweep had come and gone.
    const { data: restored, error } = await admin
      .from('accounts')
      .update({
        deletion_requested_at: null,
        deletion_purge_at: null,
        deletion_requested_by: null,
        deletion_reason: null,
      })
      .eq('id', row.account_id)
      .not('deletion_requested_at', 'is', null)
      .gt('deletion_purge_at', new Date().toISOString())
      .select('id, name')
      .maybeSingle();

    if (error) {
      console.error('[account-recovery] restore failed:', error.message);
      return NextResponse.json(
        { error: 'Could not restore the account. Please contact support.' },
        { status: 500 }
      );
    }
    if (!restored) return invalid;

    return NextResponse.json({
      restored: true,
      accountName: restored.name,
    });
  } catch (err) {
    console.error('[account-recovery] confirm failed:', err);
    return NextResponse.json(
      { error: 'Could not restore the account. Please contact support.' },
      { status: 500 }
    );
  }
}
