import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';

/**
 * /api/integrations/google-sheets/sheets/[id]  (admin+)
 *
 *   PATCH   { isActive } — pause or resume writing to the sheet
 *   DELETE  stop writing to it and drop it from the list; the
 *           spreadsheet itself stays in the owner's Google Drive
 */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as { isActive?: unknown } | null;
    if (typeof body?.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive is required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin()
      .from('google_sheets')
      .update({ is_active: body.isActive, ...(body.isActive ? { last_error: null, last_error_at: null } : {}) })
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireRole('admin');
    // Its queued rows and export log go with it (ON DELETE CASCADE).
    const { data, error } = await supabaseAdmin()
      .from('google_sheets')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
