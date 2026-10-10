import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { GoogleSheetsError, createSpreadsheet } from '@/lib/google-sheets/client';
import { TAB_HEADERS, eventMeta, isSheetEventType } from '@/lib/google-sheets/rows';
import { GOOGLE_ACCOUNT_COLUMNS, getAccessToken, type GoogleAccountRow } from '@/lib/google-sheets/sync';

const MAX_TITLE = 100;

/**
 * POST /api/integrations/google-sheets/sheets  (admin+)
 *
 * Body: { googleAccountId, eventType, title? }
 *
 * "Add New Sheet": create a spreadsheet in that Google account's Drive
 * with one tab and the header row for the chosen kind of entry, and
 * start writing those entries to it.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const googleAccountId = typeof body?.googleAccountId === 'string' ? body.googleAccountId : '';
    const eventType = body?.eventType;
    if (!googleAccountId || !isSheetEventType(eventType)) {
      return NextResponse.json(
        { error: 'Choose a Google account and the kind of entries for this sheet.' },
        { status: 400 },
      );
    }
    const meta = eventMeta(eventType);
    const rawTitle = typeof body?.title === 'string' ? body.title.trim() : '';
    const title = (rawTitle || `Instant — ${meta.label}`).slice(0, MAX_TITLE);

    const db = supabaseAdmin();
    const { data: account } = await db
      .from('google_accounts')
      .select(GOOGLE_ACCOUNT_COLUMNS)
      .eq('id', googleAccountId)
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!account) {
      return NextResponse.json({ error: 'That Google account is not connected.' }, { status: 404 });
    }
    if (!account.is_active) {
      return NextResponse.json(
        { error: 'Reconnect that Google account first (Manage Accounts).', code: 'revoked' },
        { status: 400 },
      );
    }

    const token = await getAccessToken(db, account as GoogleAccountRow);
    const sheet = await createSpreadsheet(token, {
      title,
      tab: meta.tab,
      headers: TAB_HEADERS[eventType],
    });

    const { data: row, error } = await db
      .from('google_sheets')
      .insert({
        account_id: ctx.accountId,
        google_account_id: googleAccountId,
        event_type: eventType,
        spreadsheet_id: sheet.id,
        spreadsheet_url: sheet.url,
        title: sheet.title,
        created_by: ctx.userId,
      })
      .select('id')
      .single();
    if (error) throw error;

    return NextResponse.json({ sheet: { id: row.id, url: sheet.url, title: sheet.title } });
  } catch (err) {
    if (err instanceof GoogleSheetsError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === 'revoked' ? 401 : 502 },
      );
    }
    return toErrorResponse(err);
  }
}
