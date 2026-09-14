import { NextResponse } from 'next/server';

import { PAYMENT_METHODS } from '@/lib/billing/invoice';
import { ADMIN_TAGS, revalidateAdmin } from '../../../../_lib/admin-cache';
import { getAdminUser } from '../../../../_lib/auth';
import { adminDb } from '../../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PaymentStatus = 'paid' | 'due' | 'complimentary';
const PAYMENT_STATUSES = new Set<PaymentStatus>(['paid', 'due', 'complimentary']);
const METHOD_VALUES = new Set<string>(PAYMENT_METHODS.map((m) => m.value));

/**
 * Whole billing cycles between two dates, rounded, never below one.
 * "Sep 14 → Dec 14" on a monthly plan is 3; the day-of-month term keeps a
 * period that ends a day or two off a calendar boundary from rounding to
 * the wrong count.
 */
function cyclesBetween(
  start: Date,
  end: Date,
  interval: 'monthly' | 'yearly'
): number {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    (end.getUTCDate() - start.getUTCDate()) / 30;
  const cycles = interval === 'yearly' ? months / 12 : months;
  return Math.max(1, Math.round(cycles));
}

function periodLabel(cycles: number, interval: 'monthly' | 'yearly'): string {
  const unit = interval === 'yearly' ? 'year' : 'month';
  return `${cycles} ${unit}${cycles === 1 ? '' : 's'}`;
}

/**
 * Set an account's billing arrangement (manual). Admin-only.
 *
 * Accepts any subset of { billing_plan_key, billing_amount (minor units),
 * billing_currency, billing_interval, current_period_start,
 * current_period_end }, plus an optional `payment`:
 * { status: 'paid' | 'due' | 'complimentary', method?, reference? }.
 * A `null` clears a field. `billing_plan_key`, when non-null, must
 * reference an existing plan.
 *
 * ASSIGNING A PLAN ACTIVATES IT
 *
 * This route used to write only the billing_* columns. The plan and
 * status the rest of the app reads (accounts.plan / subscription_status)
 * were left on the trial, onboarded_at stayed empty so the customer was
 * still behind the paywall, and no invoice was written. The Accounts page
 * kept showing "trialing, N days left" for an account that had been given
 * a paid plan.
 *
 * Now, once the account has a plan AND a period, saving does what a
 * Razorpay payment does (api/billing/razorpay/verify):
 *   - plan = the billing plan, subscription_status = 'active';
 *   - onboarded_at stamped if empty, which opens the paywall;
 *   - an invoice for the period, unless one already exists for exactly
 *     this plan and period — so re-saving to fix a typo in the price
 *     doesn't bill twice.
 * The accounts_app_metadata_sync trigger carries plan and status to the
 * login token, so the customer's own app agrees on the next request.
 *
 * Clearing the plan does NOT downgrade the account. Turning an active
 * customer back into an expired trial is a decision for the Subscription
 * card, not a side effect of emptying a dropdown.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const db = adminDb();
  const update: Record<string, unknown> = {};
  let planName: string | null = null;

  if ('billing_plan_key' in body) {
    if (body.billing_plan_key === null) {
      update.billing_plan_key = null;
    } else if (typeof body.billing_plan_key === 'string') {
      const key = body.billing_plan_key.trim();
      const { data: plan } = await db
        .from('billing_plans')
        .select('key, name')
        .eq('key', key)
        .maybeSingle();
      if (!plan) {
        return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
      }
      update.billing_plan_key = key;
      planName = plan.name;
    } else {
      return NextResponse.json(
        { error: 'Invalid billing_plan_key' },
        { status: 400 }
      );
    }
  }

  if ('billing_amount' in body) {
    if (body.billing_amount === null) {
      update.billing_amount = null;
    } else if (
      Number.isInteger(body.billing_amount) &&
      body.billing_amount >= 0
    ) {
      update.billing_amount = body.billing_amount;
    } else {
      return NextResponse.json(
        {
          error: 'billing_amount must be a non-negative integer (minor units)',
        },
        { status: 400 }
      );
    }
  }

  if ('billing_currency' in body) {
    if (
      typeof body.billing_currency !== 'string' ||
      !/^[A-Za-z]{3}$/.test(body.billing_currency)
    ) {
      return NextResponse.json(
        { error: 'billing_currency must be a 3-letter code' },
        { status: 400 }
      );
    }
    update.billing_currency = body.billing_currency.toUpperCase();
  }

  if ('billing_interval' in body) {
    const v = body.billing_interval;
    if (v === null || v === 'monthly' || v === 'yearly') {
      update.billing_interval = v;
    } else {
      return NextResponse.json(
        { error: "billing_interval must be 'monthly', 'yearly', or null" },
        { status: 400 }
      );
    }
  }

  for (const field of ['current_period_start', 'current_period_end'] as const) {
    if (field in body) {
      const v = body[field];
      if (v === null) {
        update[field] = null;
      } else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
        update[field] = v;
      } else {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
    }
  }

  let paymentStatus: PaymentStatus = 'due';
  let paymentMethod: string | null = null;
  let paymentReference: string | null = null;
  if ('payment' in body && body.payment != null) {
    const p = body.payment;
    if (typeof p !== 'object' || !PAYMENT_STATUSES.has(p.status)) {
      return NextResponse.json(
        { error: "payment.status must be 'paid', 'due' or 'complimentary'" },
        { status: 400 }
      );
    }
    paymentStatus = p.status;
    if (paymentStatus === 'paid') {
      if (typeof p.method !== 'string' || !METHOD_VALUES.has(p.method)) {
        return NextResponse.json(
          { error: 'Choose how the payment was made' },
          { status: 400 }
        );
      }
      paymentMethod = p.method;
      if (typeof p.reference === 'string' && p.reference.trim()) {
        paymentReference = p.reference.trim().slice(0, 120);
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // The body may carry only some fields, so activation has to be decided
  // on the account as it will stand AFTER this write, not on the body.
  const { data: current, error: readErr } = await db
    .from('accounts')
    .select(
      'billing_plan_key, billing_amount, billing_currency, billing_interval, current_period_start, current_period_end, onboarded_at'
    )
    .eq('id', id)
    .maybeSingle();
  if (readErr || !current) {
    return NextResponse.json(
      { error: readErr?.message ?? 'Account not found' },
      { status: readErr ? 500 : 404 }
    );
  }
  const next = { ...current, ...update } as typeof current;

  const activating =
    next.billing_plan_key != null &&
    next.current_period_start != null &&
    next.current_period_end != null;

  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (activating) {
    periodStart = new Date(next.current_period_start as string);
    periodEnd = new Date(next.current_period_end as string);
    if (periodEnd <= periodStart) {
      return NextResponse.json(
        { error: 'Period end must be after period start' },
        { status: 400 }
      );
    }
    update.plan = next.billing_plan_key;
    update.subscription_status = 'active';
    if (!current.onboarded_at) update.onboarded_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from('accounts')
    .update(update)
    .eq('id', id)
    .select(
      'id, plan, subscription_status, onboarded_at, billing_plan_key, billing_amount, billing_currency, billing_interval, current_period_start, current_period_end'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Invoices and the account list both change below; drop both caches
  // before any early return so a partial success is still visible.
  revalidateAdmin(ADMIN_TAGS.accounts, ADMIN_TAGS.invoices);

  if (!activating || !periodStart || !periodEnd) {
    return NextResponse.json({ account: data, invoice: null });
  }

  const planKey = next.billing_plan_key as string;
  if (!planName) {
    const { data: plan } = await db
      .from('billing_plans')
      .select('name')
      .eq('key', planKey)
      .maybeSingle();
    planName = plan?.name ?? planKey;
  }

  // One invoice per plan + period. Matching on the exact period means a
  // re-save with the same dates is a no-op, while a genuinely new period
  // (a renewal, an extension) gets its own invoice.
  const { data: existing } = await db
    .from('invoices')
    .select('id, invoice_number')
    .eq('account_id', id)
    .eq('plan_key', planKey)
    .eq('period_start', periodStart.toISOString())
    .eq('period_end', periodEnd.toISOString())
    .neq('status', 'void')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      account: data,
      invoice: existing,
      invoiceExisted: true,
    });
  }

  const interval = next.billing_interval === 'yearly' ? 'yearly' : 'monthly';
  const cycles = cyclesBetween(periodStart, periodEnd, interval);
  const complimentary = paymentStatus === 'complimentary';
  const now = new Date().toISOString();

  const { data: invoice, error: invoiceErr } = await db
    .from('invoices')
    .insert({
      account_id: id,
      created_by: admin.id,
      plan_key: planKey,
      description: `${planName} plan — ${periodLabel(cycles, interval)}${
        complimentary ? ' (complimentary)' : ''
      }`,
      amount: complimentary ? 0 : (next.billing_amount ?? 0) * cycles,
      currency: next.billing_currency ?? 'INR',
      status: paymentStatus === 'due' ? 'due' : 'paid',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      due_date: paymentStatus === 'due' ? periodStart.toISOString() : null,
      paid_at: paymentStatus === 'due' ? null : now,
      payment_method: complimentary ? 'other' : paymentMethod,
      payment_reference: paymentReference,
      notes: complimentary
        ? 'Complimentary — assigned from the admin panel, no charge.'
        : 'Assigned from the admin panel.',
    })
    .select('id, invoice_number')
    .single();

  if (invoiceErr) {
    // The plan is live either way; say plainly that the ledger isn't, so
    // it gets fixed instead of discovered at the next audit.
    console.error('[admin/billing] invoice insert failed:', invoiceErr);
    return NextResponse.json(
      {
        error: `Plan activated, but the invoice could not be created: ${invoiceErr.message}`,
        account: data,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ account: data, invoice });
}
