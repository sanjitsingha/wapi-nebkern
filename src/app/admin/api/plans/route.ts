import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { adminDb } from '../../_lib/admin-db';
import { sanitizeLimitsInput } from '@/lib/billing/entitlements';

const KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** Normalize a features payload → string[] (trimmed, non-empty, capped). */
function parseFeatures(input: unknown): string[] | null {
  if (input == null) return [];
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const f of input) {
    if (typeof f !== 'string') return null;
    const t = f.trim();
    if (t) out.push(t.slice(0, 200));
  }
  return out.slice(0, 30);
}

/**
 * Create a billing plan. Admin-only.
 *
 * Required: key (slug, immutable identity), name, amount (minor units).
 * Optional: description, currency, interval, tagline, features[],
 * is_featured, is_active, sort_order.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key.trim().toLowerCase() : '';
  if (!KEY_RE.test(key)) {
    return NextResponse.json(
      { error: 'Key must be a slug: lowercase letters, numbers, hyphens' },
      { status: 400 },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!Number.isInteger(body.amount) || body.amount < 0) {
    return NextResponse.json(
      { error: 'amount must be a non-negative integer (minor units)' },
      { status: 400 },
    );
  }

  const currency =
    typeof body.currency === 'string' && /^[A-Za-z]{3}$/.test(body.currency)
      ? body.currency.toUpperCase()
      : 'INR';

  const interval = body.interval === 'yearly' ? 'yearly' : 'monthly';

  const features = parseFeatures(body.features);
  if (features === null) {
    return NextResponse.json(
      { error: 'features must be an array of strings' },
      { status: 400 },
    );
  }

  // Per-plan limits & feature gates (migration 062).
  const limits = sanitizeLimitsInput(body.limits);
  if (limits === null) {
    return NextResponse.json(
      { error: 'Invalid limits payload' },
      { status: 400 },
    );
  }

  const row = {
    key,
    name,
    amount: body.amount,
    currency,
    interval,
    description:
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null,
    tagline:
      typeof body.tagline === 'string' && body.tagline.trim()
        ? body.tagline.trim()
        : null,
    features,
    limits,
    is_featured: body.is_featured === true,
    is_active: body.is_active !== false,
    sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 0,
  };

  const { data, error } = await adminDb()
    .from('billing_plans')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation on the key.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `A plan with key "${key}" already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ plan: data });
}
