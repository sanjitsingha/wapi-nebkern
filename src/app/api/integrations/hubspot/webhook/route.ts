// ============================================================
// /api/integrations/hubspot/webhook
//
// Where HubSpot delivers the app's webhook events — one URL for every
// connected portal; each event names its portal. Signed with the app's
// client secret, and refused unless the signature checks out.
//
// HubSpot gives a delivery five seconds and retries on anything but a
// 2xx, so this only stores the events and answers. They are worked
// through right after the response (after()), and the minute cron picks
// up whatever that run did not finish.
// ============================================================

import { NextResponse, after } from 'next/server';

import { supabaseAdmin } from '@/lib/billing/admin-client';
import { platformHubSpotCredentials, verifyHubSpotSignature } from '@/lib/hubspot/client';
import { processHubSpotEvents, storeHubSpotEvents } from '@/lib/hubspot/process';
import { parseHubSpotEvents } from '@/lib/hubspot/webhook';
import { publicOrigin } from '@/lib/public-origin';

/** A delivery is at most 100 small events. */
const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: Request) {
  const platform = platformHubSpotCredentials();
  if (!platform) return new NextResponse('Not configured', { status: 503 });

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new NextResponse('Too large', { status: 413 });

  // The address HubSpot called, which the signature covers. Next sees
  // its own listen address behind nginx, so rebuild the public one —
  // and try the canonical site URL too, in case the two differ.
  const url = new URL(request.url);
  const path = `${url.pathname}${url.search}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  const uris = [`${publicOrigin(request)}${path}`, ...(site ? [`${site}${path}`] : [])];

  if (
    !verifyHubSpotSignature({
      method: 'POST',
      uris,
      body,
      headers: request.headers,
      clientSecret: platform.clientSecret,
    })
  ) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Nothing a retry could fix.
    return NextResponse.json({ ok: true, skipped: 'not_json' });
  }

  const db = supabaseAdmin();
  const ids = await storeHubSpotEvents(db, parseHubSpotEvents(parsed));
  if (ids.length > 0) {
    after(async () => {
      try {
        await processHubSpotEvents(db, { ids, budgetMs: 50_000, limit: ids.length });
      } catch (err) {
        console.error('[hubspot/webhook] processing failed:', err);
      }
    });
  }
  return NextResponse.json({ ok: true, stored: ids.length });
}
