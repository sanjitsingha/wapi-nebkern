import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { GoogleSheetsError, appendRows } from '@/lib/google-sheets/client';
import { sampleRow, type SheetEventType } from '@/lib/google-sheets/rows';
import {
  GOOGLE_ACCOUNT_COLUMNS,
  getAccessToken,
  noteSheetFailure,
  noteSheetSuccess,
  type GoogleAccountRow,
} from '@/lib/google-sheets/sync';

/**
 * POST /api/integrations/google-sheets/sheets/[id]/test  (admin+)
 *
 * The answer to "not receiving data?": write one clearly-marked test row
 * straight to the sheet, now, through the same token and append call the
 * cron uses. Success proves the connection end to end; a failure comes
 * back with Google's reason and is recorded on the sheet.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireRole('admin');
    const limit = checkRateLimit(`gsheets-test:${ctx.accountId}`, RATE_LIMITS.aiDraft);
    if (!limit.success) return rateLimitResponse(limit);

    const db = supabaseAdmin();
    const { data } = await db
      .from('google_sheets')
      .select(`id, event_type, spreadsheet_id, google_account:google_accounts(${GOOGLE_ACCOUNT_COLUMNS})`)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    const sheet = data as unknown as {
      id: string;
      event_type: SheetEventType;
      spreadsheet_id: string;
      google_account: GoogleAccountRow | null;
    } | null;
    if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    if (!sheet.google_account?.is_active) {
      return NextResponse.json(
        { error: 'This sheet’s Google account needs reconnecting (Manage Accounts).' },
        { status: 400 },
      );
    }

    try {
      const token = await getAccessToken(db, sheet.google_account);
      await appendRows(token, sheet.spreadsheet_id, [sampleRow(sheet.event_type)]);
      await noteSheetSuccess(db, sheet.id);
      return NextResponse.json({ ok: true });
    } catch (err) {
      await noteSheetFailure(db, sheet, err);
      throw err;
    }
  } catch (err) {
    if (err instanceof GoogleSheetsError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return toErrorResponse(err);
  }
}
