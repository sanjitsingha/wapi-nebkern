// ============================================================
// Unified Meta connect — server-side persistence.
//
// Turns one chosen Page into two connected channels: Messenger always,
// Instagram DMs whenever that Page has a linked professional account and
// the plan allows it. Both rows end up holding the SAME Page access
// token, because that is the single credential Meta issues for both
// surfaces on this integration path.
//
// The Messenger half delegates to finalizeMessengerPage() — its
// ownership guard, verify-token minting and webhook subscribe are
// already correct and shared, and duplicating them here would mean two
// copies to keep honest.
//
// Server-only — imports the token encryptor.
// ============================================================

import { randomUUID } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { finalizeMessengerPage } from '@/lib/messenger/server-config';
import type { MetaAsset } from './connect';

/** Why the Instagram half of a connect didn't happen. */
export type InstagramSkipReason =
  /** The Page has no Instagram professional account linked to it. */
  | 'not_linked'
  /** The account's plan doesn't include the Instagram channel. */
  | 'plan'
  /** Another workspace on this instance already owns that IG account. */
  | 'claimed'
  /** Meta or the database refused the write — `error` carries the text. */
  | 'failed';

export interface FinalizeMetaResult {
  ok: true;
  pageId: string;
  pageName: string;
  /** Set when Instagram connected too. */
  instagramUsername?: string | null;
  /** Set when it didn't — the UI turns this into one honest sentence. */
  instagramSkipped?: InstagramSkipReason;
  instagramError?: string;
}

export type FinalizeMetaOutcome = FinalizeMetaResult | { ok: false; error: string };

/**
 * Park the long-lived USER token while the operator picks a Page.
 *
 * Lives on messenger_config because a Page is the anchor of this flow
 * (Instagram is reached through one), so that row always exists for a
 * pending pick — see migration 076. Cleared by finalizeMessengerPage()
 * as soon as a Page is chosen.
 */
export async function parkMetaUserToken(args: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  userAccessToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, accountId, userId, userAccessToken } = args;

  let encrypted: string;
  try {
    encrypted = encrypt(userAccessToken);
  } catch {
    return { ok: false, error: 'Failed to secure the Facebook session. Please try again.' };
  }

  const row = {
    user_access_token: encrypted,
    connect_method: 'oauth' as const,
    last_verification_error: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('messenger_config')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from('messenger_config').update(row).eq('account_id', accountId)
    : await supabase.from('messenger_config').insert({
        account_id: accountId,
        created_by: userId,
        status: 'disconnected' as const,
        ...row,
      });

  if (error) {
    console.error('[meta-connect] parking the user token failed:', error);
    return { ok: false, error: 'Failed to save the connection. Please try again.' };
  }
  return { ok: true };
}

/** Read + decrypt the parked user token. Null once a Page is chosen. */
export async function loadMetaUserToken(
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

/**
 * Persist the Instagram half. Separate from the Messenger half so a
 * Page with no Instagram — or an account whose plan excludes it — still
 * connects cleanly instead of failing the whole handshake.
 */
async function finalizeInstagramFromPage(args: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  asset: MetaAsset;
}): Promise<
  | { ok: true; username: string | null }
  | { ok: false; reason: InstagramSkipReason; error?: string }
> {
  const { supabase, accountId, userId, asset } = args;
  const ig = asset.instagram;
  if (!ig) return { ok: false, reason: 'not_linked' };

  // One Instagram account, one owner — the webhook resolves the owning
  // workspace by this id, so a shared claim would make delivery
  // ambiguous. Same guard the per-channel flows apply.
  const { data: claimed, error: claimedError } = await supabaseAdmin()
    .from('instagram_config')
    .select('account_id')
    .eq('instagram_business_account_id', ig.id)
    .neq('account_id', accountId)
    .maybeSingle();
  if (claimedError) {
    console.error('[meta-connect] instagram ownership check failed:', claimedError);
    return { ok: false, reason: 'failed', error: 'Could not validate the Instagram account.' };
  }
  if (claimed) return { ok: false, reason: 'claimed' };

  let encryptedToken: string;
  try {
    encryptedToken = encrypt(asset.pageAccessToken);
  } catch {
    return { ok: false, reason: 'failed', error: 'Failed to secure the Instagram token.' };
  }

  // Reuse the existing verify token across reconnects — it is pasted
  // into Meta's dashboard by hand, so rotating it silently breaks the
  // webhook handshake.
  const { data: existing } = await supabase
    .from('instagram_config')
    .select('id, verify_token')
    .eq('account_id', accountId)
    .maybeSingle();

  let verifyToken: string;
  try {
    verifyToken = existing?.verify_token ?? encrypt(randomUUID().replace(/-/g, ''));
  } catch {
    return { ok: false, reason: 'failed', error: 'Failed to prepare the webhook token.' };
  }

  const now = new Date().toISOString();
  const row = {
    page_id: asset.pageId,
    page_name: asset.pageName,
    instagram_business_account_id: ig.id,
    username: ig.username,
    access_token: encryptedToken,
    verify_token: verifyToken,
    connect_method: 'meta' as const,
    status: 'connected' as const,
    connected_at: now,
    // The Page subscribe already ran for the Messenger half — same Page,
    // same subscription, so this timestamp reflects a real subscription.
    subscribed_at: now,
    last_verification_error: null,
    updated_at: now,
  };

  const { error } = existing
    ? await supabase.from('instagram_config').update(row).eq('account_id', accountId)
    : await supabase
        .from('instagram_config')
        .insert({ account_id: accountId, created_by: userId, ...row });

  if (error) {
    console.error('[meta-connect] instagram row write failed:', error);
    return { ok: false, reason: 'failed', error: 'Failed to save the Instagram connection.' };
  }

  return { ok: true, username: ig.username };
}

/**
 * Connect a chosen Page as both channels.
 *
 * Messenger is the gate: if that half fails the whole connect fails,
 * because without a valid Page token neither channel can work. Instagram
 * is best-effort on top — its failures are reported, not fatal.
 */
export async function finalizeMetaAsset(args: {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  asset: MetaAsset;
  /** From plan entitlements. False ⇒ connect Messenger only. */
  allowInstagram: boolean;
}): Promise<FinalizeMetaOutcome> {
  const { supabase, accountId, userId, asset, allowInstagram } = args;

  const messenger = await finalizeMessengerPage({
    supabase,
    accountId,
    page: {
      id: asset.pageId,
      name: asset.pageName,
      accessToken: asset.pageAccessToken,
    },
  });
  if (!messenger.ok) return { ok: false, error: messenger.error };

  const base: FinalizeMetaResult = {
    ok: true,
    pageId: asset.pageId,
    pageName: messenger.pageName,
  };

  if (!asset.instagram) return { ...base, instagramSkipped: 'not_linked' };
  if (!allowInstagram) return { ...base, instagramSkipped: 'plan' };

  const instagram = await finalizeInstagramFromPage({
    supabase,
    accountId,
    userId,
    asset,
  });
  if (!instagram.ok) {
    return { ...base, instagramSkipped: instagram.reason, instagramError: instagram.error };
  }

  return { ...base, instagramUsername: instagram.username };
}

// ============================================================
// Status + disconnect
// ============================================================

export interface MetaChannelStatus {
  connected: boolean;
  pageId: string | null;
  pageName: string | null;
  /** Instagram only. */
  username?: string | null;
  instagramBusinessAccountId?: string | null;
  /** For the Meta dashboard webhook handshake. Not a credential for our
   *  API — it only lets the holder answer the GET challenge. */
  verifyToken: string | null;
  /** Which flow minted the row, so support can tell a Page-token row
   *  from a legacy Instagram-Login one. */
  connectMethod: string | null;
}

export interface MetaStatus {
  messenger: MetaChannelStatus;
  instagram: MetaChannelStatus;
  /** True while a Facebook session is parked and no Page is chosen. */
  pickPending: boolean;
}

function decryptOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

/**
 * Both channels' stored state in one read. Deliberately database-only:
 * the settings page calls this on every render, and the Page token is
 * validated against Meta separately (one call, since both channels share
 * the credential) by the status route.
 */
export async function loadMetaStatus(
  supabase: SupabaseClient,
  accountId: string,
): Promise<MetaStatus> {
  const [{ data: fb }, { data: ig }] = await Promise.all([
    supabase
      .from('messenger_config')
      .select('page_id, page_name, access_token, verify_token, user_access_token, status, connect_method')
      .eq('account_id', accountId)
      .maybeSingle(),
    supabase
      .from('instagram_config')
      .select('page_id, page_name, username, instagram_business_account_id, verify_token, status, connect_method')
      .eq('account_id', accountId)
      .maybeSingle(),
  ]);

  return {
    messenger: {
      connected: Boolean(fb?.page_id && fb?.access_token && fb.status === 'connected'),
      pageId: fb?.page_id ?? null,
      pageName: fb?.page_name ?? null,
      verifyToken: decryptOrNull(fb?.verify_token),
      connectMethod: fb?.connect_method ?? null,
    },
    instagram: {
      connected: Boolean(ig?.instagram_business_account_id && ig.status === 'connected'),
      pageId: ig?.page_id ?? null,
      pageName: ig?.page_name ?? null,
      username: ig?.username ?? null,
      instagramBusinessAccountId: ig?.instagram_business_account_id ?? null,
      verifyToken: decryptOrNull(ig?.verify_token),
      connectMethod: ig?.connect_method ?? null,
    },
    pickPending: Boolean(fb?.user_access_token),
  };
}

/**
 * Drop both channels' credentials. Conversations, contacts and message
 * history are untouched — only the ability to send and receive goes.
 */
export async function disconnectMetaChannels(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [fb, ig] = await Promise.all([
    supabase.from('messenger_config').delete().eq('account_id', accountId),
    supabase.from('instagram_config').delete().eq('account_id', accountId),
  ]);

  if (fb.error || ig.error) {
    console.error('[meta-connect] disconnect failed:', fb.error ?? ig.error);
    return { ok: false, error: 'Failed to disconnect. Please try again.' };
  }
  return { ok: true };
}
