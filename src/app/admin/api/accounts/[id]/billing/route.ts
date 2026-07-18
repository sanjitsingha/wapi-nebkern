import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../_lib/auth';
import { adminDb } from '../../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Set an account's billing arrangement (manual). Admin-only.
 *
 * Accepts any subset of { billing_plan_key, billing_amount (minor units),
 * billing_currency, billing_interval, current_period_start,
 * current_period_end }. A `null` clears the field. `billing_plan_key`, when
 * non-null, must reference an existing plan.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
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

  if ('billing_plan_key' in body) {
    if (body.billing_plan_key === null) {
      update.billing_plan_key = null;
    } else if (typeof body.billing_plan_key === 'string') {
      const key = body.billing_plan_key.trim();
      const { data: plan } = await db
        .from('billing_plans')
        .select('key')
        .eq('key', key)
        .maybeSingle();
      if (!plan) {
        return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
      }
      update.billing_plan_key = key;
    } else {
      return NextResponse.json({ error: 'Invalid billing_plan_key' }, { status: 400 });
    }
  }

  if ('billing_amount' in body) {
    if (body.billing_amount === null) {
      update.billing_amount = null;
    } else if (Number.isInteger(body.billing_amount) && body.billing_amount >= 0) {
      update.billing_amount = body.billing_amount;
    } else {
      return NextResponse.json(
        { error: 'billing_amount must be a non-negative integer (minor units)' },
        { status: 400 },
      );
    }
  }

  if ('billing_currency' in body) {
    if (typeof body.billing_currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.billing_currency)) {
      return NextResponse.json(
        { error: 'billing_currency must be a 3-letter code' },
        { status: 400 },
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
        { status: 400 },
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
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await db
    .from('accounts')
    .update(update)
    .eq('id', id)
    .select(
      'id, billing_plan_key, billing_amount, billing_currency, billing_interval, current_period_start, current_period_end',
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data });
}
