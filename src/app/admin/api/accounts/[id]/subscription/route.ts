import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../_lib/auth';
import { adminDb } from '../../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
]);

/**
 * Update an account's subscription/trial. Admin-only. Any subset of
 * { plan, subscription_status, trial_ends_at } may be sent; only the
 * provided fields are written. `trial_ends_at` accepts an ISO string or
 * null (to clear it).
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

  const update: Record<string, unknown> = {};

  if ('plan' in body) {
    if (typeof body.plan !== 'string' || body.plan.length > 64) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    update.plan = body.plan.trim();
  }

  if ('subscription_status' in body) {
    if (!STATUSES.has(body.subscription_status)) {
      return NextResponse.json(
        { error: 'Invalid subscription_status' },
        { status: 400 },
      );
    }
    update.subscription_status = body.subscription_status;
  }

  if ('trial_ends_at' in body) {
    const v = body.trial_ends_at;
    if (v === null) {
      update.trial_ends_at = null;
    } else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
      update.trial_ends_at = v;
    } else {
      return NextResponse.json(
        { error: 'Invalid trial_ends_at' },
        { status: 400 },
      );
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from('accounts')
    .update(update)
    .eq('id', id)
    .select('id, plan, subscription_status, trial_started_at, trial_ends_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ account: data });
}
