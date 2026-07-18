import { NextResponse } from 'next/server';
import { authenticateApiKey, requireApiKey } from '@/lib/api-keys/auth';
import { supabaseAdmin } from '@/lib/webhooks/admin-client';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe';
import { emitWebhookEvent } from '@/lib/webhooks/emit';
import {
  atLimit,
  getAccountEntitlements,
  limitReachedResponse,
} from '@/lib/billing/entitlements';

/**
 * POST /api/v1/contacts
 *
 * Create (or upsert) a contact. This is the "action" side for automation
 * platforms — Zapier/Make/n8n call it to push a person into the CRM.
 *
 * Auth: x-api-key (per-account key from Settings → API Access).
 * Body: { "phone": "+15551234567", "name": "Jane" }  (name optional)
 *
 * Idempotent by phone: an existing contact is returned (and its name
 * updated if changed) rather than duplicated.
 */
export async function POST(request: Request) {
  const apiAuth = await authenticateApiKey(request);
  const auth = requireApiKey(apiAuth);
  if (auth instanceof NextResponse) return auth;
  const { accountId, userId } = auth;

  const body = await request.json().catch(() => null);
  const phoneRaw = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!phoneRaw) {
    return NextResponse.json({ error: '`phone` is required' }, { status: 400 });
  }
  const phone = normalizePhone(phoneRaw);

  const db = supabaseAdmin();

  const existing = await findExistingContact(db, accountId, phone);
  if (existing) {
    if (name && name !== existing.name) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return NextResponse.json({
      created: false,
      contact: { ...existing, name: name || existing.name },
    });
  }

  // Plan contact limit — only creation is gated (the upsert path above
  // returns an existing contact regardless, which never adds a row).
  const ent = await getAccountEntitlements(db, accountId);
  if (ent.maxContacts !== null) {
    const { count } = await db
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);
    if (atLimit(ent.maxContacts, count ?? 0)) {
      return limitReachedResponse('contacts', ent.maxContacts);
    }
  }

  const { data, error } = await db
    .from('contacts')
    .insert({ account_id: accountId, user_id: userId, phone, name: name || phone })
    .select('id, name, phone, created_at')
    .single();

  if (error) {
    // Concurrent create — resolve the winner instead of erroring.
    if (isUniqueViolation(error)) {
      const raced = await findExistingContact(db, accountId, phone);
      if (raced) return NextResponse.json({ created: false, contact: raced });
    }
    console.error('[v1/contacts] insert error:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }

  // Fire the same event the inbound path does, so a created contact is
  // observable to other webhooks. Dedup above prevents a create→create loop.
  await emitWebhookEvent(accountId, 'contact.created', {
    contact_id: data.id,
    name: data.name,
    phone: data.phone,
  });

  return NextResponse.json({ created: true, contact: data });
}
