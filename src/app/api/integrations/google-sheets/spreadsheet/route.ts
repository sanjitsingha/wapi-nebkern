import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { GoogleSheetsError, createSpreadsheet } from '@/lib/google-sheets/client';
import { getAccessToken, type SheetsConnection } from '@/lib/google-sheets/sync';

/**
 * POST /api/integrations/google-sheets/spreadsheet  (admin+)
 *
 * "Add new sheet": create a spreadsheet in the connected Google account's
 * Drive, with a Contacts, Deals and Campaigns tab, and make it the one
 * Instant writes to. Calling it again replaces the target with a fresh
 * spreadsheet; the old one stays in Drive untouched.
 */
export async function POST() {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();

    const { data: conn } = await db
      .from('google_sheets_connections')
      .select(
        'account_id, access_token, refresh_token, expires_at, spreadsheet_id, sync_contacts, sync_deals, sync_campaigns, is_active, connected_at',
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!conn || !conn.is_active) {
      return NextResponse.json(
        { error: 'Connect your Google account first.', code: 'not_connected' },
        { status: 400 },
      );
    }

    const { data: account } = await db
      .from('accounts')
      .select('name')
      .eq('id', ctx.accountId)
      .maybeSingle();
    const title = `Instant — ${(account?.name as string | undefined)?.trim() || 'WhatsApp data'}`;

    const token = await getAccessToken(db, conn as SheetsConnection);
    const sheet = await createSpreadsheet(token, title);

    const { error } = await db
      .from('google_sheets_connections')
      .update({
        spreadsheet_id: sheet.id,
        spreadsheet_url: sheet.url,
        spreadsheet_title: sheet.title,
        last_error: null,
        last_error_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', ctx.accountId);
    if (error) throw error;

    return NextResponse.json({ spreadsheet: sheet });
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
