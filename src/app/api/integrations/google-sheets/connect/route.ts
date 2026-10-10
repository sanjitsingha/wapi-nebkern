import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import { googleSheetsClient } from '@/lib/google-sheets/client';

/**
 * /api/integrations/google-sheets/connect  (admin+)
 *
 *   GET     the connection's status (never its tokens)
 *   PATCH   { syncContacts?, syncDeals?, syncCampaigns? } — what to write
 *   DELETE  disconnect: revoke at Google, forget the tokens
 *
 * Connecting itself is the OAuth round trip (../oauth/start).
 */

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const { data } = await supabaseAdmin()
      .from('google_sheets_connections')
      .select(
        'google_email, spreadsheet_id, spreadsheet_url, spreadsheet_title, sync_contacts, sync_deals, sync_campaigns, is_active, connected_at, last_written_at, last_error, last_error_at',
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    return NextResponse.json({
      configured: googleSheetsClient() !== null,
      connection: data
        ? {
            googleEmail: data.google_email,
            spreadsheetId: data.spreadsheet_id,
            spreadsheetUrl: data.spreadsheet_url,
            spreadsheetTitle: data.spreadsheet_title,
            syncContacts: data.sync_contacts,
            syncDeals: data.sync_deals,
            syncCampaigns: data.sync_campaigns,
            isActive: data.is_active,
            connectedAt: data.connected_at,
            lastWrittenAt: data.last_written_at,
            lastError: data.last_error,
            lastErrorAt: data.last_error_at,
          }
        : null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const patch: Record<string, boolean | string> = {};
    if (typeof body?.syncContacts === 'boolean') patch.sync_contacts = body.syncContacts;
    if (typeof body?.syncDeals === 'boolean') patch.sync_deals = body.syncDeals;
    if (typeof body?.syncCampaigns === 'boolean') patch.sync_campaigns = body.syncCampaigns;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    patch.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin()
      .from('google_sheets_connections')
      .update(patch)
      .eq('account_id', ctx.accountId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();
    const { data } = await db
      .from('google_sheets_connections')
      .select('refresh_token')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    // Best-effort: tell Google too, so Instant leaves the account's
    // "third-party access" list. The spreadsheet itself stays in Drive.
    if (data?.refresh_token) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: decrypt(data.refresh_token as string) }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Already revoked, or Google unreachable — forgetting it here is
        // what matters.
      }
    }

    const { error } = await db
      .from('google_sheets_connections')
      .delete()
      .eq('account_id', ctx.accountId);
    if (error) throw error;
    // Anything still queued would only fail now.
    await db
      .from('google_sheets_rows')
      .delete()
      .eq('account_id', ctx.accountId)
      .eq('status', 'pending');

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_DISCONNECTED,
      targetType: 'integration',
      targetId: 'google-sheets',
      metadata: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
