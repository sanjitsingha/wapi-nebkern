import { NextResponse } from 'next/server';

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account';
import { getManagedPages, verifyPageToken } from '@/lib/messenger/meta-api';
import {
  finalizeMessengerPage,
  loadMessengerAccess,
  loadMessengerUserToken,
  loadMessengerVerifyToken,
} from '@/lib/messenger/server-config';

/**
 * GET /api/messenger/config
 *
 * Any account member can read. Returns 200 for every non-auth failure so
 * the settings page can render the right message rather than a 500:
 *   { connected: true, page: { id, name } }
 *   { connected: false, reason: 'no_config' | 'token_corrupted' | 'meta_api_error', message, needs_reset? }
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();

    const access = await loadMessengerAccess(supabase, accountId);
    if (!access.ok) {
      return NextResponse.json({
        connected: false,
        reason: access.reason,
        message:
          access.reason === 'no_config'
            ? 'No Facebook Page connected yet. Click “Connect with Facebook” to link one.'
            : 'The stored Page access token cannot be decrypted with the current ENCRYPTION_KEY. Disconnect and reconnect the Page.',
        needs_reset: access.reason === 'token_corrupted' || undefined,
      });
    }

    try {
      const info = await verifyPageToken({
        pageId: access.access.pageId,
        pageAccessToken: access.access.accessToken,
      });
      return NextResponse.json({
        connected: true,
        page: { id: info.id, name: info.name ?? access.access.pageName },
        // Needed to complete the Webhooks handshake in Meta's dashboard.
        // Not a credential for our API — it only lets the holder answer
        // the GET verification challenge.
        verify_token: await loadMessengerVerifyToken(supabase, accountId),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error';
      return NextResponse.json({
        connected: false,
        reason: 'meta_api_error',
        message: `Meta API rejected the Page token: ${message}`,
      });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/messenger/config
 *
 * Admin+ only. Finalizes the connection for a chosen Page — used when
 * the operator manages several Pages and picked one in the settings UI.
 * Body: { page_id }. The Page's access token is resolved server-side
 * from the parked user token; the client never handles tokens.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin');

    const body = await request.json().catch(() => null);
    const pageId = typeof body?.page_id === 'string' ? body.page_id.trim() : '';
    if (!pageId) {
      return NextResponse.json({ error: 'page_id is required' }, { status: 400 });
    }

    const userAccessToken = await loadMessengerUserToken(supabase, accountId);
    if (!userAccessToken) {
      return NextResponse.json(
        {
          error:
            'Your Facebook login session has expired. Click “Connect with Facebook” to start again.',
        },
        { status: 409 },
      );
    }

    let pages;
    try {
      pages = await getManagedPages(userAccessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error';
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 });
    }

    const page = pages.find((p) => p.id === pageId);
    if (!page) {
      return NextResponse.json(
        { error: 'That Page is no longer available on this Facebook account.' },
        { status: 404 },
      );
    }

    const result = await finalizeMessengerPage({ supabase, accountId, page });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      page: { id: page.id, name: result.pageName },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/messenger/config
 *
 * Admin+ only. Disconnects Messenger for the account. Existing
 * conversations/messages are left untouched — only the credentials go.
 */
export async function DELETE() {
  try {
    const { supabase, accountId } = await requireRole('admin');

    const { error } = await supabase
      .from('messenger_config')
      .delete()
      .eq('account_id', accountId);

    if (error) {
      console.error('Error deleting messenger_config:', error);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
