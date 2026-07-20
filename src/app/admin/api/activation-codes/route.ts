import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminUser } from '../../_lib/auth';
import { adminDb } from '../../_lib/admin-db';

// Unambiguous alphabet — no I/L/O/0/1, so codes survive being read
// aloud or retyped from a screenshot.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomGroup(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** e.g. WAPI-7K2M-XJ4P-QR8T */
function generateCode(): string {
  return `WAPI-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

/**
 * POST /admin/api/activation-codes — generate a batch of codes.
 *
 * Body: { plan_key, duration_days, quantity?, max_uses?, expires_at?,
 * note? }. Codes are generated server-side and returned so the admin can
 * copy them immediately.
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

  const planKey =
    typeof body.plan_key === 'string' ? body.plan_key.trim().toLowerCase() : '';
  if (!planKey) {
    return NextResponse.json({ error: 'plan_key is required' }, { status: 400 });
  }

  const duration = body.duration_days;
  if (!Number.isInteger(duration) || duration < 1 || duration > 3650) {
    return NextResponse.json(
      { error: 'duration_days must be an integer between 1 and 3650' },
      { status: 400 },
    );
  }

  const quantity = Number.isInteger(body.quantity) ? body.quantity : 1;
  if (quantity < 1 || quantity > 100) {
    return NextResponse.json(
      { error: 'quantity must be between 1 and 100' },
      { status: 400 },
    );
  }

  const maxUses = Number.isInteger(body.max_uses) ? body.max_uses : 1;
  if (maxUses < 1 || maxUses > 10000) {
    return NextResponse.json(
      { error: 'max_uses must be between 1 and 10000' },
      { status: 400 },
    );
  }

  let expiresAt: string | null = null;
  if (body.expires_at != null && body.expires_at !== '') {
    if (
      typeof body.expires_at !== 'string' ||
      Number.isNaN(Date.parse(body.expires_at))
    ) {
      return NextResponse.json({ error: 'Invalid expires_at' }, { status: 400 });
    }
    expiresAt = body.expires_at;
  }

  const note =
    typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, 200)
      : null;

  // Verify the plan exists before minting codes against it.
  const { data: plan } = await adminDb()
    .from('billing_plans')
    .select('key')
    .eq('key', planKey)
    .maybeSingle();
  if (!plan) {
    return NextResponse.json(
      { error: `No billing plan with key "${planKey}"` },
      { status: 400 },
    );
  }

  const rows = Array.from({ length: quantity }, () => ({
    code: generateCode(),
    plan_key: planKey,
    duration_days: duration,
    max_uses: maxUses,
    expires_at: expiresAt,
    note,
    created_by: admin.id,
  }));

  const { data, error } = await adminDb()
    .from('activation_codes')
    .insert(rows)
    .select('id, code');

  if (error) {
    // A random-collision 23505 is astronomically unlikely (31^12 space);
    // surface it as a retryable error rather than looping server-side.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Code collision — please try again' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codes: data });
}
