// ============================================================
// Turn a HubSpot contact into a Dripo contact — the same
// find-or-create as lib/zoho/ingest.ts: matched on the normalised
// phone, blanks filled but nothing overwritten, created (owned by the
// account owner) when there is no match, since a brand-new HubSpot
// contact is exactly who a welcome message is for.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { isValidE164, toIndianE164 } from '@/lib/whatsapp/phone-utils';

export interface HubSpotPerson {
  /** Digits, E.164 without the plus; null when unusable. */
  phone: string | null;
  name: string | null;
  email: string | null;
}

/** The person a HubSpot contact's properties describe. Mobile before
 *  phone: WhatsApp needs a mobile, and `phone` is often a landline. */
export function personFromProperties(p: Record<string, string | null | undefined>): HubSpotPerson {
  const raw = (p.mobilephone || p.phone || '').trim();
  const phone = raw ? toIndianE164(raw) : '';
  const name = [p.firstname, p.lastname].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
  return {
    phone: phone && isValidE164(phone) ? phone : null,
    name: name || null,
    email: p.email?.trim() || null,
  };
}

export interface HubSpotIngestResult {
  contactId: string | null;
  contactCreated: boolean;
  skippedReason?: 'no_phone';
}

export async function upsertContactFromHubSpot(
  db: SupabaseClient,
  accountId: string,
  ownerUserId: string,
  person: HubSpotPerson,
): Promise<HubSpotIngestResult> {
  const phone = person.phone;
  if (!phone) return { contactId: null, contactCreated: false, skippedReason: 'no_phone' };

  const { data: existing } = await db
    .from('contacts')
    .select('id, name, email')
    .eq('account_id', accountId)
    .eq('phone_normalized', phone)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (!existing.name && person.name) patch.name = person.name;
    if (!existing.email && person.email) patch.email = person.email;
    if (Object.keys(patch).length > 0) {
      await db.from('contacts').update(patch).eq('id', existing.id);
    }
    return { contactId: existing.id as string, contactCreated: false };
  }

  const { data: inserted, error } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: ownerUserId,
      phone,
      name: person.name,
      email: person.email,
      created_via: 'hubspot',
    })
    .select('id')
    .single();

  if (error || !inserted) {
    // Lost a race with a concurrent insert on the same phone.
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
