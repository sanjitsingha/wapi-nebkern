import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../_lib/auth';
import { adminDb } from '../../../_lib/admin-db';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /admin/api/activation-codes/[id] — edit a code. Admin-only.
 * Any subset of { is_active, note, expires_at } may be sent.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid code id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid is_active' }, { status: 400 });
    }
    update.is_active = body.is_active;
  }

  if ('note' in body) {
    if (body.note === null) {
      update.note = null;
    } else if (typeof body.note === 'string') {
      update.note = body.note.trim().slice(0, 200) || null;
    } else {
      return NextResponse.json({ error: 'Invalid note' }, { status: 400 });
    }
  }

  if ('expires_at' in body) {
    const v = body.expires_at;
    if (v === null || v === '') {
      update.expires_at = null;
    } else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
      update.expires_at = v;
    } else {
      return NextResponse.json({ error: 'Invalid expires_at' }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from('activation_codes')
    .update(update)
    .eq('id', id)
    .select('id, is_active, note, expires_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ code: data });
}

/**
 * DELETE /admin/api/activation-codes/[id] — remove an UNUSED code.
 * Redeemed codes are audit history: deactivate them instead.
 */
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
    return NextResponse.json({ error: 'Invalid code id' }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from('activation_codes')
    .delete()
    .eq('id', id)
    .eq('use_count', 0)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'Code not found, or already redeemed — deactivate it instead' },
      { status: 409 },
    );
  }
  return NextResponse.json({ deleted: true });
}
