// ============================================================
// GET /api/integrations/zoho/link?contact_id=…
//
// Which Zoho record a contact is synced with, for the inbox contact
// panel's "Open in Zoho". The links table is service-role only, so the
// panel asks here; any member can, since it reveals nothing beyond a
// record they could open in Zoho themselves.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { zohoRecordUrl } from '@/lib/zoho/push';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('viewer');
    const contactId = new URL(request.url).searchParams.get('contact_id');
    if (!contactId) return NextResponse.json({ link: null });

    const db = supabaseAdmin();
    const [{ data: link }, { data: conn }] = await Promise.all([
      db
        .from('zoho_record_links')
        .select('zoho_module, zoho_id, updated_at')
        .eq('account_id', ctx.accountId)
        .eq('entity', 'contact')
        .eq('local_id', contactId)
        .maybeSingle(),
      db
        .from('zoho_connections')
        .select('api_domain, org_id, is_active')
        .eq('account_id', ctx.accountId)
        .maybeSingle(),
    ]);

    if (!conn?.is_active) return NextResponse.json({ connected: false, link: null });
    if (!link) return NextResponse.json({ connected: true, link: null });

    return NextResponse.json({
      connected: true,
      link: {
        module: link.zoho_module,
        url: zohoRecordUrl(
          conn.api_domain as string | null,
          conn.org_id as string | null,
          link.zoho_module as 'Leads' | 'Contacts',
          link.zoho_id as string,
        ),
        syncedAt: link.updated_at,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
