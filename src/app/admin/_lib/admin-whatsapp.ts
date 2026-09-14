import { cache } from 'react';

import { decrypt } from '@/lib/whatsapp/encryption';
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api';
import { adminDb } from './admin-db';
import { ADMIN_TAGS, cachedRead } from './admin-cache';

// ============================================================
// WhatsApp connection state, as the admin panel sees it.
//
// "Connected" here means exactly what it means to the tenant: the rule
// in loadWhatsAppAccess (src/lib/whatsapp/server-config.ts) — a stored
// phone_number_id AND an access token that still decrypts. If the two
// definitions drifted, the panel would call an account connected while
// the tenant was staring at the "connect your number" banner.
//
// The access token is read, decrypted to test it, and dropped inside
// the loader. Only the verdict is returned, so the token never lands in
// Next's data cache or in a props payload.
// ============================================================

export type WhatsAppState = 'connected' | 'not_connected' | 'token_broken';

export interface WhatsAppStatus {
  accountId: string;
  state: WhatsAppState;
  phoneNumberId: string | null;
  wabaId: string | null;
  connectedAt: string | null;
  registeredAt: string | null;
  /** Set when registering the number with Meta failed. The number can
   *  still be "connected" (credentials saved) with this present. */
  lastRegistrationError: string | null;
}

interface WhatsAppConfigRow {
  account_id: string;
  phone_number_id: string | null;
  waba_id: string | null;
  access_token: string | null;
  connected_at: string | null;
  registered_at: string | null;
  last_registration_error: string | null;
}

const CONFIG_COLUMNS =
  'account_id, phone_number_id, waba_id, access_token, connected_at, registered_at, last_registration_error';

function classify(row: WhatsAppConfigRow): WhatsAppStatus {
  let state: WhatsAppState = 'connected';
  if (!row.phone_number_id || !row.access_token) {
    state = 'not_connected';
  } else {
    try {
      decrypt(row.access_token);
    } catch {
      state = 'token_broken';
    }
  }
  return {
    accountId: row.account_id,
    state,
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
    connectedAt: row.connected_at,
    registeredAt: row.registered_at,
    lastRegistrationError: row.last_registration_error,
  };
}

/**
 * Connection state for every account that has a whatsapp_config row.
 * An account with no row is not connected — callers default to that.
 *
 * Cached like the other list reads. A tenant connecting a number does
 * not pass through an admin route, so nothing invalidates this tag on
 * connect: a brand-new connection can take up to a minute to show.
 */
export const getWhatsAppStatuses = cache(
  async (): Promise<WhatsAppStatus[]> =>
    cachedRead(ADMIN_TAGS.whatsapp, ['all'], async () => {
      const { data } = await adminDb()
        .from('whatsapp_config')
        .select(CONFIG_COLUMNS)
        .not('account_id', 'is', null);

      return ((data ?? []) as WhatsAppConfigRow[]).map(classify);
    })
);

export interface WhatsAppLiveInfo {
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
}

export interface WhatsAppDetail {
  status: WhatsAppStatus;
  /** What Meta says about the number right now. Null when there is
   *  nothing to ask about, or when asking failed — see `liveError`. */
  live: WhatsAppLiveInfo | null;
  liveError: string | null;
}

const META_TIMEOUT_MS = 5000;

// metaFetch has no timeout of its own. Without this cap, one slow
// minute at Meta would hang the whole account page on a lookup that is
// only decoration next to billing and members.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Meta did not answer within ${ms / 1000}s`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * One account's connection, plus the readable number and business name.
 *
 * The number itself (+91 …) is not stored anywhere in our database —
 * only Meta's internal phone_number_id is — so it has to be looked up
 * live. Deliberately uncached: this is the page an operator opens to
 * find out what is true now.
 */
export async function getWhatsAppDetail(
  accountId: string
): Promise<WhatsAppDetail> {
  const { data } = await adminDb()
    .from('whatsapp_config')
    .select(CONFIG_COLUMNS)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!data) {
    return {
      status: {
        accountId,
        state: 'not_connected',
        phoneNumberId: null,
        wabaId: null,
        connectedAt: null,
        registeredAt: null,
        lastRegistrationError: null,
      },
      live: null,
      liveError: null,
    };
  }

  const row = data as WhatsAppConfigRow;
  const status = classify(row);
  if (status.state !== 'connected' || !row.phone_number_id || !row.access_token) {
    return { status, live: null, liveError: null };
  }

  try {
    const info = await withTimeout(
      verifyPhoneNumber({
        phoneNumberId: row.phone_number_id,
        accessToken: decrypt(row.access_token),
      }),
      META_TIMEOUT_MS
    );
    return {
      status,
      live: {
        displayPhoneNumber: info.display_phone_number ?? null,
        verifiedName: info.verified_name ?? null,
        qualityRating: info.quality_rating ?? null,
      },
      liveError: null,
    };
  } catch (err) {
    return {
      status,
      live: null,
      liveError: err instanceof Error ? err.message : 'Meta lookup failed',
    };
  }
}
