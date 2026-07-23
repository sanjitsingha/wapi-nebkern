import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import {
  razorpay,
  razorpayConfigured,
  verifyPaymentSignature,
} from '@/lib/billing/razorpay';

/** now / current period end (same plan) + one billing interval. */
function nextPeriodEnd(base: Date, interval: 'monthly' | 'yearly'): Date {
  const end = new Date(base);
  if (interval === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

/**
 * POST /api/billing/razorpay/verify — confirm a Standard Checkout
 * payment and activate the purchased plan.
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }.
 * Owner/admin only. The signature is verified first (HMAC-SHA256 of
 * "order|payment" with the key secret); the order is then re-fetched
 * from Razorpay and its notes — written server-side at order creation —
 * are the source of truth for which account/plan is being activated, so
 * a signature from one account can never activate another. The verified
 * payment is recorded as a paid invoice; the invoice's payment_reference
 * doubles as the idempotency key.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');

    if (!razorpayConfigured()) {
      return NextResponse.json(
        { error: 'Online payment is not set up yet.' },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => null);
    const orderId =
      typeof body?.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const paymentId =
      typeof body?.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const signature =
      typeof body?.razorpay_signature === 'string' ? body.razorpay_signature : '';

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: 'Missing payment verification fields.' },
        { status: 400 },
      );
    }

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      return NextResponse.json(
        { error: 'Payment could not be verified.' },
        { status: 400 },
      );
    }

    // Signature is genuine — now confirm the order belongs to THIS
    // account and read the plan it was created for.
    let order;
    try {
      order = await razorpay().orders.fetch(orderId);
    } catch (err) {
      console.error('[razorpay/verify] order fetch failed:', err);
      return NextResponse.json(
        { error: 'Could not confirm the payment with Razorpay.' },
        { status: 502 },
      );
    }

    const notes = (order.notes ?? {}) as Record<string, string>;
    if (notes.account_id !== ctx.accountId) {
      return NextResponse.json(
        { error: 'This payment belongs to a different account.' },
        { status: 403 },
      );
    }
    const planKey = notes.plan_key;
    if (!planKey) {
      return NextResponse.json(
        { error: 'This payment is not linked to a plan.' },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Idempotency: a retried verify for an already-recorded payment just
    // reports the existing state instead of extending the period twice.
    const { data: existing } = await db
      .from('invoices')
      .select('id, invoice_number, period_end')
      .eq('payment_reference', paymentId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        planKey,
        alreadyProcessed: true,
        invoiceNumber: existing.invoice_number,
        periodEnd: existing.period_end,
      });
    }

    // Plan row (not filtered on is_active — the payment already happened;
    // deactivating a plan stops new orders, not verification of paid ones).
    const { data: plan } = await db
      .from('billing_plans')
      .select('key, name, amount, currency, interval')
      .eq('key', planKey)
      .maybeSingle();
    if (!plan) {
      console.error(`[razorpay/verify] paid order for unknown plan "${planKey}"`);
      return NextResponse.json(
        { error: 'The purchased plan no longer exists — contact support.' },
        { status: 500 },
      );
    }

    const interval: 'monthly' | 'yearly' =
      plan.interval === 'yearly' ? 'yearly' : 'monthly';

    // Stack onto an unexpired period of the same plan, else start now —
    // the same semantics as activation-code redemption (migration 065).
    const { data: account } = await db
      .from('accounts')
      .select('billing_plan_key, current_period_end, onboarded_at')
      .eq('id', ctx.accountId)
      .maybeSingle();

    const now = new Date();
    const currentEnd = account?.current_period_end
      ? new Date(account.current_period_end)
      : null;
    const stacking =
      account?.billing_plan_key === plan.key &&
      currentEnd !== null &&
      currentEnd > now;
    const base = stacking ? (currentEnd as Date) : now;
    const end = nextPeriodEnd(base, interval);

    const accountUpdate: Record<string, unknown> = {
      plan: plan.key,
      subscription_status: 'active',
      billing_plan_key: plan.key,
      billing_amount: plan.amount,
      billing_currency: plan.currency,
      billing_interval: interval,
      current_period_end: end.toISOString(),
    };
    if (!stacking) accountUpdate.current_period_start = now.toISOString();
    // Paying IS a completed plan-selection choice — clear the onboarding
    // gate (migration 070) so a first payment lands the user in the app.
    // Only stamp it once, to preserve the original onboarding time.
    if (!account?.onboarded_at) accountUpdate.onboarded_at = now.toISOString();

    const { error: updateErr } = await db
      .from('accounts')
      .update(accountUpdate)
      .eq('id', ctx.accountId);
    if (updateErr) {
      console.error('[razorpay/verify] account update failed:', updateErr);
      return NextResponse.json(
        { error: 'Payment received but activation failed — contact support.' },
        { status: 500 },
      );
    }

    // Record the payment in the invoices ledger (tenant sees it in
    // Settings → Plan; printable at /invoices/[id]).
    const { data: invoice, error: invoiceErr } = await db
      .from('invoices')
      .insert({
        account_id: ctx.accountId,
        plan_key: plan.key,
        description: `${plan.name} plan — ${interval === 'yearly' ? '1 year' : '1 month'} (Razorpay)`,
        amount: Number(order.amount) || plan.amount,
        currency: plan.currency,
        status: 'paid',
        period_start: base.toISOString(),
        period_end: end.toISOString(),
        paid_at: now.toISOString(),
        payment_method: 'razorpay',
        payment_reference: paymentId,
        notes: `Razorpay order ${orderId}`,
        created_by: ctx.userId,
      })
      .select('id, invoice_number')
      .single();
    if (invoiceErr) {
      // The plan IS active — don't fail the whole request over ledger
      // bookkeeping; log loudly instead.
      console.error('[razorpay/verify] invoice insert failed:', invoiceErr);
    }

    return NextResponse.json({
      planKey: plan.key,
      planName: plan.name,
      periodEnd: end.toISOString(),
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoice_number ?? null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
