import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getAccountEntitlements } from '@/lib/billing/entitlements';
import { verifyMetaPageToken } from '@/lib/meta/connect';
import { loadMetaStatus } from '@/lib/meta/connect-server';
import { loadMessengerAccess } from '@/lib/messenger/server-config';

/**
 * GET /api/meta/status
 *
 * Both channels' connection state for the settings page. Any account
 * member can read — the response carries no Page access token, only ids,
 * display names and the webhook verify tokens (which alone can do
 * nothing but answer Meta's GET challenge).
 *
 * Returns 200 for every non-auth failure so the page can render the
 * right message instead of an error boundary.
 *
 * The Page token is validated against Meta once per load, not twice:
 * Messenger and Instagram share the credential on this integration path,
 * so a single /{page-id} probe settles both.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    const [status, ent] = await Promise.all([
      loadMetaStatus(supabase, accountId),
      getAccountEntitlements(supabase, accountId),
    ]);

    let tokenError: string | null = null;
    if (status.messenger.connected) {
      const access = await loadMessengerAccess(supabase, accountId);
      if (!access.ok) {
        tokenError =
          access.reason === 'token_corrupted'
            ? 'The stored Page access token cannot be decrypted with the current ENCRYPTION_KEY. Disconnect and connect again.'
            : 'The stored connection is incomplete. Connect again to repair it.';
      } else {
        try {
          await verifyMetaPageToken({
            pageId: access.access.pageId,
            pageAccessToken: access.access.accessToken,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown Meta API error';
          tokenError = `Meta rejected the stored Page token: ${message}`;
        }
      }
    }

    return NextResponse.json({
      ...status,
      // A legacy Instagram-Login row (connect_method 'oauth' with no
      // page_id) can never send on the endpoint this app uses — surface
      // that rather than showing a green tick that lies.
      instagram_needs_reconnect:
        status.instagram.connected &&
        status.instagram.connectMethod !== 'meta' &&
        !status.instagram.pageId,
      allow_instagram: ent.allowInstagram,
      token_error: tokenError,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
