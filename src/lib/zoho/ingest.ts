// ============================================================
// Turn a Zoho record into a CRM contact.
//
// Same find-or-create as the WooCommerce and Shopify ingests: contacts
// keyed on (account_id, phone_normalized), a NOT NULL user_id satisfied
// by the account owner.
//
// Creates rather than skipping when there is no match — a lead that has
// only just been entered in Zoho is exactly the one a welcome message
// is for, and skipping it would make the integration useless on the
// case it is most wanted for.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ZohoNormalized } from './payload';

export interface ZohoIngestResult {
  contactId: string | null;
  contactCreated: boolean;
  skippedReason?: 'no_phone';
}

export async function upsertContactFromZoho(
  db: SupabaseClient,
  accountId: string,
  ownerUserId: string,
  record: ZohoNormalized,
): Promise<ZohoIngestResult> {
  const phone = record.phone;
  if (!phone) {
    return { contactId: null, contactCreated: false, skippedReason: 'no_phone' };
  }

  const { data: existing } = await db
    .from('contacts')
    .select('id, name, email')
    .eq('account_id', accountId)
    .eq('phone_normalized', phone)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const contactId = existing.id as string;
    // Fill blanks only. Zoho is not the system of record for the
    // conversation, and overwriting a name someone corrected here with
    // whatever the CRM holds is a change nobody asked for.
    const patch: Record<string, unknown> = {};
    if (!existing.name && record.name) patch.name = record.name;
    if (!existing.email && record.email) patch.email = record.email;
    if (Object.keys(patch).length > 0) {
      await db.from('contacts').update(patch).eq('id', contactId);
    }
    return { contactId, contactCreated: false };
  }

  const { data: inserted, error } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: ownerUserId,
      phone,
      name: record.name,
      email: record.email,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    // Lost a race with a concurrent insert on the same phone — the
    // unique index did its job. Re-read rather than failing the event.
    const { data: found } = await db
      .from('contacts')
      .select('id')
      .eq('account_id', accountId)
      .eq('phone_normalized', phone)
      .limit(1)
      .maybeSingle();
    return found
      ? { contactId: found.id as string, contactCreated: false }
      : { contactId: null, contactCreated: false };
  }

  return { contactId: inserted.id as string, contactCreated: true };
}
