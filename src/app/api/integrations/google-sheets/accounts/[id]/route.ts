import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';

/**
 * DELETE /api/integrations/google-sheets/accounts/[id]  (admin+)
 *
 * Remove a Google account: revoke Instant's access at Google and forget
 * the tokens. Its sheets go with it (ON DELETE CASCADE) — they would
 * have nothing to write through. The spreadsheets stay in its Drive.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireRole('admin');
    const db = supabaseAdmin();
    const { data } = await db
      .from('google_accounts')
      .select('google_email, refresh_token')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // Best-effort: tell Google too, so Instant leaves that account's
    // "third-party access" list.
    if (data.refresh_token) {
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
      .from('google_accounts')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);
    if (error) throw error;

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_DISCONNECTED,
      targetType: 'integration',
      targetId: 'google-sheets',
      metadata: { google_email: data.google_email },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
