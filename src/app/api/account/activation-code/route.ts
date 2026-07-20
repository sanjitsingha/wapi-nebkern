import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';

/** RPC error slug → user-facing message + HTTP status. */
const ERRORS: Record<string, { message: string; status: number }> = {
  invalid_code: {
    message: 'That code doesn’t exist — check for typos and try again.',
    status: 404,
  },
  code_disabled: { message: 'This code has been disabled.', status: 410 },
  code_expired: { message: 'This code has expired.', status: 410 },
  code_exhausted: {
    message: 'This code has already been used the maximum number of times.',
    status: 410,
  },
  already_redeemed: {
    message: 'Your account has already redeemed this code.',
    status: 409,
  },
  plan_unavailable: {
    message: 'The plan behind this code is no longer available.',
    status: 410,
  },
  no_account: { message: 'Your profile is not linked to an account.', status: 403 },
  forbidden: {
    message: 'Only account owners and admins can redeem activation codes.',
    status: 403,
  },
};

/**
 * POST /api/account/activation-code — redeem an activation code for the
 * caller's account. Owner/admin only (checked both here and inside the
 * RPC). The RPC does the whole redemption atomically.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireRole('admin');

    const body = await request.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code || code.length > 40) {
      return NextResponse.json(
        { error: 'Enter an activation code.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc('redeem_activation_code', {
      p_code: code,
    });

    if (error) {
      // Function missing (migration not applied) or unexpected failure.
      console.error('[activation-code] rpc error:', error);
      return NextResponse.json(
        { error: 'Could not redeem the code. Please try again later.' },
        { status: 500 },
      );
    }

    const result = data as {
      ok: boolean;
      error?: string;
      plan_key?: string;
      plan_name?: string;
      duration_days?: number;
      period_end?: string;
    } | null;

    if (!result?.ok) {
      const mapped = (result?.error && ERRORS[result.error]) || {
        message: 'Could not redeem the code.',
        status: 400,
      };
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    return NextResponse.json({
      planKey: result.plan_key,
      planName: result.plan_name,
      durationDays: result.duration_days,
      periodEnd: result.period_end,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
