// ============================================================
// Server-side WhatsApp config loader.
//
// Both business-profile routes (and future Meta-calling routes) need
// the same three things for an account: the phone number id, the WABA
// id, and a DECRYPTED access token. This centralises that lookup +
// decrypt so each route doesn't re-inline the select/decrypt dance the
// way the older send/config routes did.
//
// Server-only — imports the token decryptor, which reads ENCRYPTION_KEY.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

import { decrypt } from './encryption'

export interface WhatsAppAccess {
  phoneNumberId: string
  wabaId: string | null
  accessToken: string
}

export type LoadWhatsAppAccessResult =
  | { ok: true; access: WhatsAppAccess }
  | { ok: false; reason: 'no_config' | 'token_corrupted' }

/**
 * Load and decrypt the account's WhatsApp credentials.
 *
 * Returns a discriminated result rather than throwing so callers can
 * map each failure mode to the right HTTP shape:
 *   - `no_config`        → the account hasn't connected WhatsApp yet.
 *   - `token_corrupted`  → the stored token can't be decrypted with the
 *                          current ENCRYPTION_KEY (key changed / differs
 *                          across environments) — same signal the config
 *                          route surfaces with `needs_reset`.
 */
export async function loadWhatsAppAccess(
  supabase: SupabaseClient,
  accountId: string,
): Promise<LoadWhatsAppAccessResult> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, waba_id, access_token')
    .eq('account_id', accountId)
    .maybeSingle()

  if (error || !data?.phone_number_id || !data?.access_token) {
    return { ok: false, reason: 'no_config' }
  }

  try {
    const accessToken = decrypt(data.access_token)
    return {
      ok: true,
      access: {
        phoneNumberId: data.phone_number_id,
        wabaId: data.waba_id ?? null,
        accessToken,
      },
    }
  } catch {
    return { ok: false, reason: 'token_corrupted' }
  }
}
