import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { canEditSettings, type AccountRole } from '@/lib/auth/roles';
import {
  OTHER_REFERRAL_VALUE,
  isReferralSource,
} from '@/lib/auth/referral-sources';
import {
  SIGNUP_PHONE_ERROR,
  normalizeSignupPhone,
} from '@/lib/auth/signup-phone';

/**
 * POST /api/account/complete-profile
 *
 * Finishes the one-time details step (/welcome). Stamps
 * profiles.profile_completed_at (migration 073), which is what clears
 * the middleware gate — so this is the ONLY way out of /welcome, and it
 * must succeed before the user sees the app.
 *
 * Who lands there:
 *   - a Google signup, which brings no organization, attribution or
 *     phone;
 *   - since migration 100, anyone whose profile has no phone — every
 *     account that predates phone becoming required, once;
 *   - a password signup whose phone never reached the signup trigger.
 *
 * Body: { full_name, phone, organization_name, referral_source,
 *         referral_other? }
 *
 * `organization_name` is required only for someone who can rename the
 * workspace (owner/admin). A teammate who joined someone else's
 * workspace can't rename it, so asking them for a name we'd discard
 * would be a required field that does nothing.
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
    const phone = normalizeSignupPhone(clean(body?.phone, 40));
    const organization = clean(body?.organization_name, MAX_ORG);
    const source = clean(body?.referral_source, 40);
    const other = clean(body?.referral_other, MAX_OTHER);
    const canNameWorkspace = canEditSettings(role as AccountRole);

    if (!fullName) {
      return NextResponse.json(
        { error: 'Please enter your full name.' },
        { status: 400 },
      );
    }
    // Checked here as well as in the form: the form is a convenience,
    // this is the gate.
    if (!phone) {
      return NextResponse.json({ error: SIGNUP_PHONE_ERROR }, { status: 400 });
    }
    if (canNameWorkspace && !organization) {
      return NextResponse.json(
        { error: 'Please enter your organization name.' },
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
        phone,
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

    // Renaming the account is an admin-tier write (RLS accounts_update),
    // which is exactly the set `canNameWorkspace` requires it from.
    if (organization && canNameWorkspace) {
      const { error: accountErr } = await supabase
        .from('accounts')
        .update({ name: organization })
        .eq('id', accountId);
      if (accountErr) {
        // Non-fatal: the gate is cleared and the name is editable later
        // in Settings. Failing the whole request here would trap the
        // user on /welcome over a rename that can be retried any time.
        console.error('[complete-profile] account rename failed:', accountErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
