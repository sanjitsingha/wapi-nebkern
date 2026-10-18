// ============================================================
// GET /api/integrations/hubspot/record?contact_id=…
//
// The HubSpot contact a person is synced with, read live, for the inbox
// panel's Integrations tab: their owner, how to reach them, where they
// stand, and their deals. Any member can read it — it is what they
// could open in HubSpot, and the panel is where they work.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { hubspotApiFetch } from '@/lib/hubspot/api';
import { hubspotRecordUrl } from '@/lib/hubspot/push';
import { RECORD_PROPERTIES, pickHubSpotContact, pickHubSpotDeals } from '@/lib/hubspot/record';

interface HsRecord {
  id: string;
  properties?: Record<string, string | null>;
  associations?: { deals?: { results?: { id: string }[] } };
}

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('viewer');
    const contactId = new URL(request.url).searchParams.get('contact_id');
    if (!contactId) return NextResponse.json({ connected: false, record: null });

    const db = supabaseAdmin();
    const [{ data: conn }, { data: link }] = await Promise.all([
      db
        .from('hubspot_connections')
        .select('portal_id, ui_domain, is_active')
        .eq('account_id', ctx.accountId)
        .maybeSingle(),
      db
        .from('hubspot_record_links')
        .select('hubspot_id')
        .eq('account_id', ctx.accountId)
        .eq('entity', 'contact')
        .eq('local_id', contactId)
        .maybeSingle(),
    ]);

    if (!conn?.is_active) return NextResponse.json({ connected: false, record: null });
    if (!link) return NextResponse.json({ connected: true, record: null });

    const hubspotId = link.hubspot_id as string;
    const portalId = conn.portal_id as string | null;
    const uiDomain = conn.ui_domain as string | null;

    const res = await hubspotApiFetch<HsRecord>(
      db,
      ctx.accountId,
      `/crm/v3/objects/contacts/${encodeURIComponent(hubspotId)}?properties=${RECORD_PROPERTIES.join(',')}&associations=deals`,
    );
    if (!res.data) {
      // Deleted in HubSpot: say so plainly rather than as a failure.
      return res.status === 404
        ? NextResponse.json({ connected: true, record: null, missing: true })
        : NextResponse.json({ connected: true, record: null, error: res.error }, { status: 502 });
    }
    const props = res.data.properties ?? {};

    // The owner's name and the person's deals, side by side.
    const ownerId = props.hubspot_owner_id;
    const dealIds = (res.data.associations?.deals?.results ?? []).map((d) => d.id).slice(0, 20);
    const [owner, deals, pipelines] = await Promise.all([
      ownerId
        ? hubspotApiFetch<{ firstName?: string; lastName?: string; email?: string }>(
            db,
            ctx.accountId,
            `/crm/v3/owners/${encodeURIComponent(ownerId)}`,
          )
        : Promise.resolve(null),
      dealIds.length
        ? hubspotApiFetch<{ results?: { id: string; properties?: Record<string, string | null> }[] }>(
            db,
            ctx.accountId,
            '/crm/v3/objects/deals/batch/read',
            {
              method: 'POST',
              body: JSON.stringify({
                inputs: dealIds.map((id) => ({ id })),
                properties: ['dealname', 'amount', 'dealstage', 'closedate', 'deal_currency_code'],
              }),
            },
          )
        : Promise.resolve(null),
      dealIds.length
        ? hubspotApiFetch<{ results?: { stages?: { id: string; label?: string }[] }[] }>(
            db,
            ctx.accountId,
            '/crm/v3/pipelines/deals',
          )
        : Promise.resolve(null),
    ]);

    const stageLabels = new Map<string, string>();
    for (const p of pipelines?.data?.results ?? []) {
      for (const s of p.stages ?? []) stageLabels.set(s.id, s.label ?? s.id);
    }
    const ownerName = owner?.data
      ? [owner.data.firstName, owner.data.lastName].filter(Boolean).join(' ') || owner.data.email || null
      : null;

    return NextResponse.json({
      connected: true,
      record: {
        ...pickHubSpotContact(props),
        id: hubspotId,
        owner: ownerName,
        url: hubspotRecordUrl(uiDomain, portalId, 'contacts', hubspotId),
        deals: pickHubSpotDeals(deals?.data?.results ?? [], stageLabels).map((d) => ({
          ...d,
          url: hubspotRecordUrl(uiDomain, portalId, 'deals', d.id),
        })),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
