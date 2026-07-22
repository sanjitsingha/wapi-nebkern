import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAccountEntitlements } from '@/lib/billing/entitlements';

/**
 * GET /api/account/entitlements
 *
 * The caller's plan entitlements plus live usage — what the client UI
 * uses to pre-check limits before direct-to-Supabase actions (contact
 * form / CSV import, media uploads) and to show "upgrade" states.
 * Server routes do their own authoritative checks; this endpoint is for
 * UX, not security.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    const entitlements = await getAccountEntitlements(supabase, accountId);

    // Live usage counts. All run under the caller's RLS (members can
    // read their account's rows; account_storage_bytes checks membership
    // internally). `head: true` fetches counts without rows, so the
    // extra three cost a count query each and no payload.
    const [
      contactsRes,
      usersRes,
      storageRes,
      campaignsRes,
      automationsRes,
      flowsRes,
    ] = await Promise.all([
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
      supabase.rpc('account_storage_bytes', { p_account_id: accountId }),
      supabase
        .from('broadcasts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
      supabase
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
      supabase
        .from('flows')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId),
    ]);

    return NextResponse.json({
      entitlements,
      usage: {
        contacts: contactsRes.count ?? 0,
        users: usersRes.count ?? 0,
        storageBytes:
          typeof storageRes.data === 'number' ? storageRes.data : 0,
        campaigns: campaignsRes.count ?? 0,
        automations: automationsRes.count ?? 0,
        flows: flowsRes.count ?? 0,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
