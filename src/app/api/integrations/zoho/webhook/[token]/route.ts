// ============================================================
// /api/integrations/zoho/webhook/[token]
//
// Where a Zoho Workflow Rule delivers an event. The [token] identifies
// the connection and IS the authentication — unlike Shopify and
// WooCommerce, a Zoho Workflow Rule cannot sign its payload, so there
// is no HMAC to verify. The token is 24 random bytes and only ever
// appears in the URL the admin pastes into Zoho.
//
// Every event is recorded whether or not it matched a contact. A rule
// that fires but sends no phone is otherwise invisible: the automation
// simply never runs and there is nothing to look at.
//
// Always answers 200 on a handled event. Zoho retries on a non-2xx, and
// a payload we cannot use will fail identically on every retry.
// ============================================================

import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/billing/admin-client';
import { runAutomationsForTrigger } from '@/lib/automations/engine';
import { normalizeZohoPayload } from '@/lib/zoho/payload';
import { upsertContactFromZoho } from '@/lib/zoho/ingest';

/** Refuse a payload bigger than this. A Zoho record is a few KB; a
 *  megabyte of JSON is a misconfiguration or an attack, and parsing it
 *  helps nobody. */
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return new NextResponse('Not found', { status: 404 });

  const db = supabaseAdmin();
  const { data: conn } = await db
    .from('zoho_connections')
    .select('id, account_id, is_active')
    .eq('webhook_token', token)
    .maybeSingle();

  // Same 404 for an unknown token and a disabled connection — telling
  // the caller which is which would confirm that a token exists.
  if (!conn || !conn.is_active) {
    return new NextResponse('Not found', { status: 404 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: true, skipped: 'too_large' });
  }

  // A Zoho Workflow Rule webhook puts its Module/Custom Parameters in
  // the URL query string when "Body" is set to None (the default most
  // admins leave it on) — the params are appended to the Notify URL, not
  // sent as a body. Read those too so that common setup just works.
  let queryParams: Record<string, string> = {};
  try {
    queryParams = Object.fromEntries(new URL(request.url).searchParams);
  } catch {
    /* malformed URL — fall through with body only */
  }

  // Parse the body when there is one: JSON first, then form-encoded
  // (Zoho can POST either). Whatever it holds is merged over the query
  // params so a real body wins on a key both carried.
  let bodyPayload: Record<string, unknown> = {};
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === 'object') {
        bodyPayload = parsed as Record<string, unknown>;
      }
    } catch {
      bodyPayload = Object.fromEntries(new URLSearchParams(rawBody));
    }
  }

  const payload: Record<string, unknown> = { ...queryParams, ...bodyPayload };

  const record = normalizeZohoPayload(payload);
  const accountId = conn.account_id as string;

  const { data: account } = await db
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle();
  const ownerUserId = account?.owner_user_id as string | undefined;
  if (!ownerUserId) return NextResponse.json({ ok: true });

  const ingest = await upsertContactFromZoho(
    db,
    accountId,
    ownerUserId,
    record,
  );

  // Record the event either way. This is the debugging surface: without
  // it, "the automation didn't run" has no answer.
  await db.from('zoho_events').insert({
    account_id: accountId,
    connection_id: conn.id,
    event_type: record.eventType,
    module: record.module,
    record_id: record.recordId,
    contact_id: ingest.contactId,
    matched: !!ingest.contactId,
    skip_reason: ingest.skippedReason ?? null,
    payload: payload as Record<string, unknown>,
  });

  await db
    .from('zoho_connections')
    .update({ last_event_at: new Date().toISOString() })
    .eq('id', conn.id);

  // No contact means nothing to message. The event is stored, so the
  // admin can see the payload and fix the Workflow Rule's field list.
  if (!ingest.contactId) {
    return NextResponse.json({ ok: true, skipped: ingest.skippedReason });
  }

  await runAutomationsForTrigger({
    accountId,
    triggerType: 'zoho_event',
    contactId: ingest.contactId,
    context: {
      vars: {
        ...record.vars,
        // Guaranteed present whatever the Workflow Rule sent, so an
        // automation can branch on them without the builder having to
        // know one org's field names.
        zoho_module: record.module ?? '',
        zoho_record_id: record.recordId ?? '',
        zoho_event: record.eventType ?? '',
      },
    },
  });

  return NextResponse.json({ ok: true });
}
