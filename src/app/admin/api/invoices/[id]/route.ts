import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = new Set(['due', 'paid', 'void']);

/**
 * Update an invoice (admin-only) — mainly to mark it paid / void or fix a
 * field. Accepts any subset of { status, paid_at, payment_method,
 * payment_reference, notes, description, due_date }.
 *
 * Marking 'paid' with no paid_at stamps it now; moving away from 'paid'
 * clears paid_at unless one is explicitly provided.
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
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ('status' in body) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    update.status = body.status;
    // Keep paid_at consistent with status unless the caller sets it below.
    if (body.status === 'paid' && !('paid_at' in body)) {
      update.paid_at = new Date().toISOString();
    } else if (body.status !== 'paid' && !('paid_at' in body)) {
      update.paid_at = null;
    }
  }

  if ('paid_at' in body) {
    const v = body.paid_at;
    if (v === null) update.paid_at = null;
    else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) update.paid_at = v;
    else return NextResponse.json({ error: 'Invalid paid_at' }, { status: 400 });
  }

  if ('due_date' in body) {
    const v = body.due_date;
    if (v === null) update.due_date = null;
    else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) update.due_date = v;
    else return NextResponse.json({ error: 'Invalid due_date' }, { status: 400 });
  }

  for (const field of ['payment_method', 'payment_reference', 'notes'] as const) {
    if (field in body) {
      const v = body[field];
      if (v === null) update[field] = null;
      else if (typeof v === 'string') update[field] = v.trim() || null;
      else return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
  }

  if ('description' in body) {
    if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 300) {
      return NextResponse.json({ error: 'Invalid description' }, { status: 400 });
    }
    update.description = body.description.trim();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from('invoices')
    .update(update)
    .eq('id', id)
    .select('id, status, paid_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ invoice: data });
}

/** Delete an invoice (admin-only). Use for a mistaken entry; prefer
 *  marking 'void' to keep the ledger intact. */
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
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
  }

  const { error } = await adminDb().from('invoices').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
