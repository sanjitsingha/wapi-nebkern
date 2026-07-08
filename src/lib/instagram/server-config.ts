// ============================================================
// Server-side Instagram config loader.
//
// Structural mirror of src/lib/whatsapp/server-config.ts. Reuses the
// WhatsApp encryption module directly (@/lib/whatsapp/encryption) —
// it's generic AES-256-GCM keyed only by ENCRYPTION_KEY, not
// WhatsApp-specific despite the path — rather than adding a redundant
// re-export file.
//
// Server-only — imports the token decryptor, which reads ENCRYPTION_KEY.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

import { decrypt } from '@/lib/whatsapp/encryption'

export interface InstagramAccess {
  pageId: string
  igBusinessAccountId: string
  accessToken: string
}

export type LoadInstagramAccessResult =
  | { ok: true; access: InstagramAccess }
  | { ok: false; reason: 'no_config' | 'token_corrupted' }

/**
 * Load and decrypt the account's Instagram credentials.
 *
 * Returns a discriminated result rather than throwing so callers can
 * map each failure mode to the right HTTP shape:
 *   - `no_config`        → the account hasn't connected Instagram yet.
 *   - `token_corrupted`  → the stored token can't be decrypted with the
 *                          current ENCRYPTION_KEY.
 */
export async function loadInstagramAccess(
  supabase: SupabaseClient,
  accountId: string,
): Promise<LoadInstagramAccessResult> {
  const { data, error } = await supabase
    .from('instagram_config')
    .select('page_id, instagram_business_account_id, access_token')
    .eq('account_id', accountId)
    .maybeSingle()

  if (error || !data?.page_id || !data?.instagram_business_account_id || !data?.access_token) {
    return { ok: false, reason: 'no_config' }
  }

  try {
    const accessToken = decrypt(data.access_token)
    return {
      ok: true,
      access: {
        pageId: data.page_id,
        igBusinessAccountId: data.instagram_business_account_id,
        accessToken,
      },
    }
  } catch {
    return { ok: false, reason: 'token_corrupted' }
  }
}
