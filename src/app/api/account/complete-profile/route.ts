import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { canEditSettings } from '@/lib/auth/roles';
import {
  OTHER_REFERRAL_VALUE,
  isReferralSource,
} from '@/lib/auth/referral-sources';

/**
 * POST /api/account/complete-profile
 *
 * Finishes the one-time details step shown after a Google sign-up
 * (/welcome). Stamps profiles.profile_completed_at (migration 073),
 * which is what clears the middleware gate — so this is the ONLY way
 * out of /welcome, and it must succeed before the user sees the app.
 *
 * Body: { full_name, organization_name?, referral_source, referral_other? }
 *
 * Password signups never reach here: they type their name on the
 * signup form, so the trigger stamps them complete at insert.
 */

const MAX_NAME = 120;
const MAX_ORG = 120;
const MAX_OTHER = 120;

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, accountId, role } = await getCurrentAccount();

    const body = await request.json().catch(() => null);
    const fullName = clean(body?.full_name, MAX_NAME);
    const organization = clean(body?.organization_name, MAX_ORG);
    const source = clean(body?.referral_source, 40);
    const other = clean(body?.referral_other, MAX_OTHER);

    if (!fullName) {
      return NextResponse.json(
        { error: 'Please enter your full name.' },
        { status: 400 },
      );
    }
    if (!source || !isReferralSource(source)) {
      return NextResponse.json(
        { error: 'Please tell us where you found us.' },
        { status: 400 },
      );
    }

    // "other" keeps the free text alongside its key so every answer
    // stays in one column and still splits cleanly for reporting.
    const referral =
      source === OTHER_REFERRAL_VALUE && other ? `${source}:${other}` : source;

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        referral_source: referral,
        profile_completed_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (profileErr) {
      console.error('[complete-profile] profile update failed:', profileErr);
      return NextResponse.json(
        { error: 'Could not save your details. Please try again.' },
        { status: 500 },
      );
    }

    // Organization name is optional, and renaming the account is an
    // admin-tier write (RLS accounts_update). A brand-new Google signup
    // owns their account so this normally applies; someone who landed
    // here after accepting an invite into someone else's account does
    // not, and must not be able to rename it — skip rather than 403,
    // since their own profile above is what the gate actually needs.
    if (organization && canEditSettings(role)) {
      const { error: accountErr } = await supabase
        .from('accounts')
        .update({ name: organization })
        .eq('id', accountId);
      if (accountErr) {
        // Non-fatal: the gate is cleared and the name is editable later
        // in Settings. Failing the whole request here would trap the
        // user on /welcome over an optional field.
        console.error('[complete-profile] account rename failed:', accountErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
