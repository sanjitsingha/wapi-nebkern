// ============================================================
// Turn a WooCommerce order into a CRM contact (server only, service-role
// db). Mirrors the WhatsApp webhook's find-or-create pattern: contacts are
// keyed on (account_id, normalized phone); a NOT NULL user_id FK is
// satisfied with the account owner as sender-of-record.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizePhone, isValidE164 } from '@/lib/whatsapp/phone-utils';
import type { NormalizedOrder } from './client';

export interface IngestResult {
  contactId: string | null;
  contactCreated: boolean;
  /** Present when the order had no usable phone to make a contact from. */
  skippedReason?: 'no_phone';
}

/** Find-or-create a contact from an order's billing details, tag it, and
 *  return the id. Best-effort tagging; never throws. */
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
    .eq('phone', phone)
    .maybeSingle();

  let contactId: string;
  let created = false;

  if (existing) {
    contactId = existing.id as string;
    // Backfill name/email we've since learned, without clobbering edits.
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
      return { contactId: null, contactCreated: false };
    }
    contactId = inserted.id as string;
    created = true;
  }

  await attachTag(db, accountId, ownerUserId, contactId, 'WooCommerce');
  return { contactId, contactCreated: created };
}

/** Ensure a tag exists on the account and attach it to the contact. */
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
        .insert({
          account_id: accountId,
          user_id: ownerUserId,
          name,
          color: '#7f54b3', // WooCommerce purple
        })
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
    /* tagging is a nicety; never block ingest on it */
  }
}
