// ============================================================
// Server-side Messenger config loader + connect finalizer.
//
// Reuses the generic AES-256-GCM encryption module
// (@/lib/whatsapp/encryption — keyed only by ENCRYPTION_KEY, not
// WhatsApp-specific) like the Instagram loader does.
//
// Server-only — imports the token decryptor.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { subscribePageToApp, type FacebookPage } from './meta-api';

export interface MessengerAccess {
  pageId: string;
  pageName: string | null;
  accessToken: string;
}

export type LoadMessengerAccessResult =
  | { ok: true; access: MessengerAccess }
  | { ok: false; reason: 'no_config' | 'token_corrupted' };

/**
 * Load and decrypt the account's connected Page credentials. Returns a
 * discriminated result rather than throwing so callers map each failure
 * mode to the right HTTP shape.
 */
export async function loadMessengerAccess(
  supabase: SupabaseClient,
  accountId: string,
): Promise<LoadMessengerAccessResult> {
  const { data, error } = await supabase
    .from('messenger_config')
    .select('page_id, page_name, access_token, status')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data?.page_id || !data?.access_token || data.status !== 'connected') {
    return { ok: false, reason: 'no_config' };
  }

  try {
    return {
      ok: true,
      access: {
        pageId: data.page_id,
        pageName: data.page_name ?? null,
        accessToken: decrypt(data.access_token),
      },
    };
  } catch {
    return { ok: false, reason: 'token_corrupted' };
  }
}

/** Read + decrypt the transient long-lived USER token stored while the
 *  operator is choosing which Page to connect. */
export async function loadMessengerUserToken(
  supabase: SupabaseClient,
  accountId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('messenger_config')
    .select('user_access_token')
    .eq('account_id', accountId)
    .maybeSingle();
  if (!data?.user_access_token) return null;
  try {
    return decrypt(data.user_access_token);
  } catch {
    return null;
  }
}

export type FinalizeResult =
  | { ok: true; pageName: string }
  | { ok: false; error: string };

/**
 * Persist a chosen Page as the account's connected Messenger channel:
 * ownership guard → encrypt the Page token → best-effort webhook
 * subscribe → upsert the row as connected and clear the transient user
 * token. Shared by the OAuth callback (single-Page case) and the
 * page-picker endpoint (multi-Page case).
 *
 * `supabase` is the caller's RLS-scoped client (admin+), used for the
 * write; the service-role client is used only for the cross-account
 * ownership check.
 */
export async function finalizeMessengerPage(args: {
  supabase: SupabaseClient;
  accountId: string;
  page: FacebookPage;
}): Promise<FinalizeResult> {
  const { supabase, accountId, page } = args;

  // One Page, one owner — mirrors instagram_config's business-account
  // guard so the webhook's account resolution stays unambiguous.
  const { data: claimed, error: claimedError } = await supabaseAdmin()
    .from('messenger_config')
    .select('account_id')
    .eq('page_id', page.id)
    .neq('account_id', accountId)
    .maybeSingle();
  if (claimedError) {
    console.error('[messenger] ownership check failed:', claimedError);
    return { ok: false, error: 'Failed to validate the connection. Please try again.' };
  }
  if (claimed) {
    return {
      ok: false,
      error: 'This Facebook Page is already connected to another account on this instance.',
    };
  }

  let encryptedToken: string;
  try {
    encryptedToken = encrypt(page.accessToken);
  } catch {
    return { ok: false, error: 'Failed to secure the Page token. Please try again.' };
  }

  // Best-effort — never block connecting on the subscribe failing.
  let subscribedAt: string | null = null;
  try {
    await subscribePageToApp({ pageId: page.id, pageAccessToken: page.accessToken });
    subscribedAt = new Date().toISOString();
  } catch (err) {
    console.warn(
      '[messenger] subscribed_apps failed (non-fatal):',
      err instanceof Error ? err.message : err,
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('messenger_config')
    .update({
      page_id: page.id,
      page_name: page.name,
      access_token: encryptedToken,
      user_access_token: null,
      connect_method: 'oauth',
      status: 'connected',
      connected_at: now,
      subscribed_at: subscribedAt,
      last_verification_error: null,
      updated_at: now,
    })
    .eq('account_id', accountId);
  if (updateError) {
    console.error('[messenger] finalize update failed:', updateError);
    return { ok: false, error: 'Failed to save the connection. Please try again.' };
  }

  return { ok: true, pageName: page.name };
}
