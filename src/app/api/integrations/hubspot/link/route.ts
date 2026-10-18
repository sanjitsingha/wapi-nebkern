// ============================================================
// GET /api/integrations/hubspot/link?contact_id=…
//
// Which HubSpot contact a person is synced with, for the inbox contact
// panel's "HubSpot" row. The links table is service-role only, so the
// panel asks here; any member can.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { hubspotRecordUrl } from '@/lib/hubspot/push';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('viewer');
    const contactId = new URL(request.url).searchParams.get('contact_id');
    if (!contactId) return NextResponse.json({ link: null });

    const db = supabaseAdmin();
    const [{ data: link }, { data: conn }] = await Promise.all([
      db
        .from('hubspot_record_links')
        .select('hubspot_id, updated_at')
        .eq('account_id', ctx.accountId)
        .eq('entity', 'contact')
        .eq('local_id', contactId)
        .maybeSingle(),
      db
        .from('hubspot_connections')
        .select('portal_id, ui_domain, is_active')
        .eq('account_id', ctx.accountId)
        .maybeSingle(),
    ]);

    if (!conn?.is_active) return NextResponse.json({ connected: false, link: null });
    if (!link) return NextResponse.json({ connected: true, link: null });

    return NextResponse.json({
      connected: true,
      link: {
        url: hubspotRecordUrl(
          conn.ui_domain as string | null,
          conn.portal_id as string | null,
          'contacts',
          link.hubspot_id as string,
        ),
        syncedAt: link.updated_at,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
