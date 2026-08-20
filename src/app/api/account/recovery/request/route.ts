import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/account/admin-client';
import { sendMailQuietly } from '@/lib/email/deomail';
import { mintRecoveryToken, recoveryEmail } from '@/lib/account/deletion';

/**
 * Ask for a recovery link. Public — nobody can be signed in to a locked
 * account, so there is no session to authenticate against.
 *
 * The reply is deliberately identical whether or not the address maps
 * to a recoverable account. This endpoint is unauthenticated and takes
 * an email address, so a truthful answer would turn it into an oracle
 * for "does this business use Instant, and is it on the way out" —
 * useful to a competitor and to anyone phishing the owner mid-deletion.
 *
 * Verification is possession of the inbox: the link only ever goes to
 * the address already on the account, never to one supplied here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email =
    body && typeof body === 'object' && typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';

  // Same body on every path below.
  const accepted = NextResponse.json({
    ok: true,
    message:
      'If that address belongs to an account that can still be restored, a recovery link is on its way.',
  });

  if (!email || !email.includes('@')) return accepted;

  const admin = supabaseAdmin();

  try {
    // Resolve the address through auth, then the profile, then the
    // account — the owner's email lives in auth.users, not on accounts.
    const { data: userList } = await admin.auth.admin.listUsers();
    const user = userList?.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) return accepted;

    const { data: profile } = await admin
      .from('profiles')
      .select(
        'account_id, account:accounts!inner(id, name, owner_user_id, deletion_requested_at, deletion_purge_at)'
      )
      .eq('user_id', user.id)
      .maybeSingle();

    const account = Array.isArray(profile?.account)
      ? profile?.account[0]
      : profile?.account;
    if (!account) return accepted;

    // Only the owner can bring an account back. An agent's mailbox is
    // not authority to reverse the owner's decision.
    if (account.owner_user_id !== user.id) return accepted;

    // Live, or already past its purge date — nothing to recover.
    if (!account.deletion_requested_at || !account.deletion_purge_at) {
      return accepted;
    }
    const purgeAt = new Date(account.deletion_purge_at as string);
    if (purgeAt.getTime() <= Date.now()) return accepted;

    const minted = mintRecoveryToken();

    // Retire any outstanding links first. Otherwise every request adds
    // another working key to the same inbox, each valid for a day.
    await admin
      .from('account_recovery_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('account_id', account.id)
      .is('consumed_at', null);

    const { error: insertErr } = await admin
      .from('account_recovery_tokens')
      .insert({
        account_id: account.id,
        email,
        token_hash: minted.hash,
        expires_at: minted.expiresAt.toISOString(),
        requested_ip:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
    if (insertErr) {
      console.error(
        '[account-recovery] token insert failed:',
        insertErr.message
      );
      return accepted;
    }

    const mail = recoveryEmail({
      accountName: account.name as string,
      token: minted.token,
      purgeAt,
    });
    await sendMailQuietly(
      { from: 'system', to: email, ...mail },
      'account recovery link'
    );
  } catch (err) {
    // Never leak the shape of a failure to an unauthenticated caller.
    console.error('[account-recovery] request failed:', err);
  }

  return accepted;
}
