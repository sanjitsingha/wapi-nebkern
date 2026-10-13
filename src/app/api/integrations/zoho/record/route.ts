// ============================================================
// GET /api/integrations/zoho/record?contact_id=…
//
// The Zoho Lead or Contact a person is synced with, read live from
// Zoho, for the inbox panel's Integrations tab: who owns them there,
// how to reach them, where they stand, and — for a Contact — their
// deals. Live rather than cached because it is the CRM's current word
// an agent wants mid-conversation, and it is one or two calls per open.
//
// Any member can read it: it is what they could open in Zoho, and the
// panel is where they work.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { zohoApiFetch } from '@/lib/zoho/api';
import { zohoRecordUrl } from '@/lib/zoho/push';
import { pickZohoRecord, pickZohoDeals, type ZohoRecordRow } from '@/lib/zoho/record';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('viewer');
    const contactId = new URL(request.url).searchParams.get('contact_id');
    if (!contactId) return NextResponse.json({ connected: false, record: null });

    const db = supabaseAdmin();
    const [{ data: conn }, { data: link }] = await Promise.all([
      db
        .from('zoho_connections')
        .select('api_domain, org_id, is_active')
        .eq('account_id', ctx.accountId)
        .maybeSingle(),
      db
        .from('zoho_record_links')
        .select('zoho_module, zoho_id')
        .eq('account_id', ctx.accountId)
        .eq('entity', 'contact')
        .eq('local_id', contactId)
        .maybeSingle(),
    ]);

    if (!conn?.is_active) return NextResponse.json({ connected: false, record: null });
    if (!link || (link.zoho_module !== 'Leads' && link.zoho_module !== 'Contacts')) {
      return NextResponse.json({ connected: true, record: null });
    }

    const zohoModule = link.zoho_module as 'Leads' | 'Contacts';
    const zohoId = link.zoho_id as string;
    const apiDomain = conn.api_domain as string | null;
    const orgId = conn.org_id as string | null;

    const res = await zohoApiFetch<{ data?: ZohoRecordRow[] }>(
      db,
      ctx.accountId,
      `/crm/v5/${zohoModule}/${encodeURIComponent(zohoId)}`,
    );
    const row = res.data?.data?.[0];
    if (!row) {
      // Zoho answers an id it no longer has with no content, or with
      // INVALID_DATA. Either way the record is gone there, which is
      // worth saying plainly rather than as a failure.
      const gone = !res.error || /invalid|not.*exist/i.test(res.error);
      return NextResponse.json(
        gone
          ? { connected: true, record: null, missing: true }
          : { connected: true, record: null, error: res.error },
        { status: gone ? 200 : 502 },
      );
    }

    // A Contact's deals. Leads have none until converted.
    let deals: ReturnType<typeof pickZohoDeals> = [];
    if (zohoModule === 'Contacts') {
      const related = await zohoApiFetch<{ data?: ZohoRecordRow[] }>(
        db,
        ctx.accountId,
        `/crm/v5/Contacts/${encodeURIComponent(zohoId)}/Deals?fields=Deal_Name,Stage,Amount,Closing_Date&per_page=5`,
      );
      deals = pickZohoDeals(related.data?.data ?? []).map((d) => ({
        ...d,
        url: zohoRecordUrl(apiDomain, orgId, 'Deals', d.id),
      }));
    }

    return NextResponse.json({
      connected: true,
      record: {
        ...pickZohoRecord(row, zohoModule),
        module: zohoModule,
        id: zohoId,
        url: zohoRecordUrl(apiDomain, orgId, zohoModule, zohoId),
        deals,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
