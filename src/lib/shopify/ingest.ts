// ============================================================
// Turn a Shopify order into a CRM contact. Same find-or-create logic as
// the WooCommerce ingest: contacts keyed on (account_id, phone_normalized),
// a NOT NULL user_id satisfied by the account owner. Tags "Shopify".
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizePhone, isValidE164 } from '@/lib/whatsapp/phone-utils';
import type { NormalizedOrder } from './client';

export interface IngestResult {
  contactId: string | null;
  contactCreated: boolean;
  skippedReason?: 'no_phone';
}

export async function upsertContactFromOrder(
  db: SupabaseClient,
  accountId: string,
  ownerUserId: string,
  order: NormalizedOrder,
): Promise<IngestResult> {
  if (!order.phone) return { contactId: null, contactCreated: false, skippedReason: 'no_phone' };
  const phone = normalizePhone(order.phone);
  if (!phone || !isValidE164(phone)) {
    return { contactId: null, contactCreated: false, skippedReason: 'no_phone' };
  }

  const { data: existing } = await db
    .from('contacts')
    .select('id, name, email')
    .eq('account_id', accountId)
    .eq('phone_normalized', phone)
    .limit(1)
    .maybeSingle();

  let contactId: string;
  let created = false;

  if (existing) {
    contactId = existing.id as string;
    const patch: Record<string, unknown> = {};
    if (!existing.name && order.name) patch.name = order.name;
    if (!existing.email && order.email) patch.email = order.email;
    if (Object.keys(patch).length > 0) {
      await db.from('contacts').update(patch).eq('id', contactId);
    }
  } else {
    const { data: inserted, error } = await db
      .from('contacts')
      .insert({
        account_id: accountId,
        user_id: ownerUserId,
        phone,
        name: order.name,
        email: order.email,
      })
      .select('id')
      .single();
    if (error || !inserted) {
      const { data: found } = await db
        .from('contacts')
        .select('id')
        .eq('account_id', accountId)
        .eq('phone_normalized', phone)
        .limit(1)
        .maybeSingle();
      if (found?.id) return { contactId: found.id as string, contactCreated: false };
      return { contactId: null, contactCreated: false };
    }
    contactId = inserted.id as string;
    created = true;
  }

  await attachTag(db, accountId, ownerUserId, contactId, 'Shopify');
  return { contactId, contactCreated: created };
}

async function attachTag(
  db: SupabaseClient,
  accountId: string,
  ownerUserId: string,
  contactId: string,
  name: string,
): Promise<void> {
  try {
    const { data: tag } = await db
      .from('tags')
      .select('id')
      .eq('account_id', accountId)
      .ilike('name', name)
      .maybeSingle();

    let tagId = tag?.id as string | undefined;
    if (!tagId) {
      const { data: createdTag } = await db
        .from('tags')
        .insert({ account_id: accountId, user_id: ownerUserId, name, color: '#95bf47' })
        .select('id')
        .single();
      tagId = createdTag?.id as string | undefined;
    }
    if (!tagId) return;

    await db
      .from('contact_tags')
      .upsert(
        { contact_id: contactId, tag_id: tagId },
        { onConflict: 'contact_id,tag_id' },
      );
  } catch {
    /* best effort */
  }
}
