import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';
import { sanitizeLimitsInput } from '@/lib/billing/entitlements';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Update a billing plan's pricing/details. Admin-only.
 *
 * Accepts any subset of { name, description, amount, currency, interval,
 * is_active }. `amount` is in MINOR units (paise/cents) and must be a
 * non-negative integer. The plan `key` is immutable (accounts reference
 * it), so it's not editable here.
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
    return NextResponse.json({ error: 'Invalid plan id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    update.name = body.name.trim();
  }

  if ('description' in body) {
    if (body.description === null) {
      update.description = null;
    } else if (typeof body.description === 'string' && body.description.length <= 500) {
      update.description = body.description.trim() || null;
    } else {
      return NextResponse.json({ error: 'Invalid description' }, { status: 400 });
    }
  }

  if ('amount' in body) {
    if (!Number.isInteger(body.amount) || body.amount < 0) {
      return NextResponse.json(
        { error: 'amount must be a non-negative integer (minor units)' },
        { status: 400 },
      );
    }
    update.amount = body.amount;
  }

  if ('currency' in body) {
    if (typeof body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.currency)) {
      return NextResponse.json(
        { error: 'currency must be a 3-letter code' },
        { status: 400 },
      );
    }
    update.currency = body.currency.toUpperCase();
  }

  if ('interval' in body) {
    if (body.interval !== 'monthly' && body.interval !== 'yearly') {
      return NextResponse.json(
        { error: "interval must be 'monthly' or 'yearly'" },
        { status: 400 },
      );
    }
    update.interval = body.interval;
  }

  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid is_active' }, { status: 400 });
    }
    update.is_active = body.is_active;
  }

  if ('is_featured' in body) {
    if (typeof body.is_featured !== 'boolean') {
      return NextResponse.json({ error: 'Invalid is_featured' }, { status: 400 });
    }
    update.is_featured = body.is_featured;
  }

  if ('tagline' in body) {
    if (body.tagline === null) {
      update.tagline = null;
    } else if (typeof body.tagline === 'string' && body.tagline.length <= 160) {
      update.tagline = body.tagline.trim() || null;
    } else {
      return NextResponse.json({ error: 'Invalid tagline' }, { status: 400 });
    }
  }

  if ('sort_order' in body) {
    if (!Number.isInteger(body.sort_order)) {
      return NextResponse.json({ error: 'Invalid sort_order' }, { status: 400 });
    }
    update.sort_order = body.sort_order;
  }

  if ('features' in body) {
    if (!Array.isArray(body.features)) {
      return NextResponse.json(
        { error: 'features must be an array of strings' },
        { status: 400 },
      );
    }
    const out: string[] = [];
    for (const f of body.features) {
      if (typeof f !== 'string') {
        return NextResponse.json(
          { error: 'features must be an array of strings' },
          { status: 400 },
        );
      }
      const t = f.trim();
      if (t) out.push(t.slice(0, 200));
    }
    update.features = out.slice(0, 30);
  }

  if ('limits' in body) {
    const limits = sanitizeLimitsInput(body.limits);
    if (limits === null) {
      return NextResponse.json({ error: 'Invalid limits payload' }, { status: 400 });
    }
    update.limits = limits;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from('billing_plans')
    .update(update)
    .eq('id', id)
    .select('id, key')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ plan: data });
}

/** Delete a plan (admin-only). Accounts keep their snapshot price, so a
 *  deleted plan just disappears from the catalog. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid plan id' }, { status: 400 });
  }

  const { error } = await adminDb().from('billing_plans').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
