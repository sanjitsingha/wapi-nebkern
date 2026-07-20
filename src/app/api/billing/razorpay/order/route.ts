import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  razorpay,
  razorpayConfigured,
  razorpayKeyId,
} from '@/lib/billing/razorpay';

/**
 * POST /api/billing/razorpay/order — create a Razorpay order for a plan.
 *
 * Body: { plan_key }. Owner/admin only. The amount comes from the
 * admin-managed billing_plans row — never from the client — and the
 * account/plan identity rides along in the order notes, which the verify
 * endpoint later treats as the source of truth.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');

    if (!razorpayConfigured()) {
      return NextResponse.json(
        { error: 'Online payment is not set up yet. Please contact support.' },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => null);
    const planKey =
      typeof body?.plan_key === 'string' ? body.plan_key.trim().toLowerCase() : '';
    if (!planKey) {
      return NextResponse.json({ error: 'plan_key is required' }, { status: 400 });
    }

    const { data: plan } = await ctx.supabase
      .from('billing_plans')
      .select('key, name, amount, currency, interval')
      .eq('key', planKey)
      .eq('is_active', true)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json(
        { error: 'This plan is not available.' },
        { status: 404 },
      );
    }
    // Razorpay's minimum order value is ₹1 (100 paise).
    if (!Number.isInteger(plan.amount) || plan.amount < 100) {
      return NextResponse.json(
        { error: 'This plan cannot be purchased online. Please contact support.' },
        { status: 400 },
      );
    }

    let order;
    try {
      order = await razorpay().orders.create({
        amount: plan.amount,
        currency: plan.currency,
        // receipt is capped at 40 chars — a timestamp + account prefix is
        // plenty; the durable linkage lives in notes.
        receipt: `wacrm-${Date.now()}-${ctx.accountId.slice(0, 8)}`,
        notes: {
          account_id: ctx.accountId,
          plan_key: plan.key,
          user_id: ctx.userId,
        },
      });
    } catch (err) {
      console.error('[razorpay/order] create failed:', err);
      return NextResponse.json(
        { error: 'Could not start the payment. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      orderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      keyId: razorpayKeyId(),
      planKey: plan.key,
      planName: plan.name,
      accountName: ctx.account.name,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
