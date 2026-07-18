import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../_lib/auth';
import { adminDb } from '../../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = new Set(['due', 'paid', 'void']);

function isoOrNull(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return v;
  return undefined; // signals "invalid"
}

/**
 * Create an invoice for an account. Admin-only.
 *
 * Required: description, amount (minor units). Everything else is
 * optional and defaults sanely (currency INR, status 'due', issued now).
 * When status is 'paid' and no paid_at is given, we stamp it now. The
 * invoice number is assigned by the DB trigger.
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

  const description =
    typeof body.description === 'string' ? body.description.trim() : '';
  if (!description || description.length > 300) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
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

  const status = STATUSES.has(body.status) ? body.status : 'due';

  const row: Record<string, unknown> = {
    account_id: id,
    created_by: admin.id,
    description,
    amount: body.amount,
    currency,
    status,
  };

  if (typeof body.plan_key === 'string' && body.plan_key.trim()) {
    row.plan_key = body.plan_key.trim();
  }
  if (typeof body.payment_method === 'string' && body.payment_method.trim()) {
    row.payment_method = body.payment_method.trim();
  }
  if (typeof body.payment_reference === 'string' && body.payment_reference.trim()) {
    row.payment_reference = body.payment_reference.trim();
  }
  if (typeof body.notes === 'string' && body.notes.trim()) {
    row.notes = body.notes.trim();
  }

  for (const field of ['period_start', 'period_end', 'due_date', 'paid_at'] as const) {
    if (field in body) {
      const v = isoOrNull(body[field]);
      if (v === undefined) {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      row[field] = v;
    }
  }

  // A paid invoice with no explicit paid_at is paid "now".
  if (status === 'paid' && row.paid_at == null) {
    row.paid_at = new Date().toISOString();
  }

  const { data, error } = await adminDb()
    .from('invoices')
    .insert(row)
    .select('id, invoice_number')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ invoice: data });
}
