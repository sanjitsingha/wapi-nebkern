import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { googleSheetsClient } from '@/lib/google-sheets/client';

/**
 * GET /api/integrations/google-sheets  (admin+)
 *
 * The page's whole state: the Google accounts this workspace has
 * authorised, and the sheets Instant writes to. Never the tokens.
 */
export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();
    const [{ data: accounts }, { data: sheets }] = await Promise.all([
      db
        .from('google_accounts')
        .select('id, google_email, is_active, connected_at, last_error')
        .eq('account_id', ctx.accountId)
        .order('connected_at', { ascending: true }),
      db
        .from('google_sheets')
        .select(
          'id, google_account_id, event_type, spreadsheet_url, title, is_active, created_at, last_written_at, last_error',
        )
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false }),
    ]);

    const emailOf = new Map((accounts ?? []).map((a) => [a.id as string, a.google_email as string]));
    const activeOf = new Map((accounts ?? []).map((a) => [a.id as string, a.is_active as boolean]));

    return NextResponse.json({
      configured: googleSheetsClient() !== null,
      accounts: (accounts ?? []).map((a) => ({
        id: a.id,
        email: a.google_email,
        isActive: a.is_active,
        connectedAt: a.connected_at,
        lastError: a.last_error,
        sheetCount: (sheets ?? []).filter((s) => s.google_account_id === a.id).length,
      })),
      sheets: (sheets ?? []).map((s) => ({
        id: s.id,
        googleAccountId: s.google_account_id,
        email: emailOf.get(s.google_account_id as string) ?? null,
        accountActive: activeOf.get(s.google_account_id as string) ?? false,
        eventType: s.event_type,
        url: s.spreadsheet_url,
        title: s.title,
        isActive: s.is_active,
        createdAt: s.created_at,
        lastWrittenAt: s.last_written_at,
        lastError: s.last_error,
      })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
