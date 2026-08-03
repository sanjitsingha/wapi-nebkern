import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/channels
 *
 * Which optional messaging channels this account has actually connected.
 * Any member can read — it returns booleans and nothing else, no ids and
 * no credentials.
 *
 * The inbox calls this on every load to decide which channel tabs are
 * selectable, so it is deliberately database-only: no Meta round trip,
 * no token decryption. /api/meta/status is the one that talks to Meta,
 * and it exists for the settings page, where one extra call is fine and
 * a stale "connected" would be misleading.
 *
 * WhatsApp is absent on purpose — it is the product's core channel and
 * its tab shows whether or not a number is attached, so a flag for it
 * would be read but never acted on.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    const [{ data: messenger }, { data: instagram }] = await Promise.all([
      supabase
        .from('messenger_config')
        .select('page_id, access_token, status')
        .eq('account_id', accountId)
        .maybeSingle(),
      supabase
        .from('instagram_config')
        .select('instagram_business_account_id, status')
        .eq('account_id', accountId)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      // Same shape of "connected" loadMetaStatus() uses, so the inbox and
      // the settings panel can never disagree about what counts.
      messenger: Boolean(
        messenger?.page_id && messenger?.access_token && messenger.status === 'connected',
      ),
      instagram: Boolean(
        instagram?.instagram_business_account_id && instagram.status === 'connected',
      ),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
