import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import { getAccountEntitlements } from '@/lib/billing/entitlements';
import { getMetaAssets } from '@/lib/meta/connect';
import {
  disconnectMetaChannels,
  finalizeMetaAsset,
  loadMetaUserToken,
} from '@/lib/meta/connect-server';

/**
 * POST /api/meta/connect
 *
 * Admin+ only. Finalizes a chosen Page as both channels — used when the
 * operator manages several Pages and picked one in the settings UI.
 * Body: { page_id }.
 *
 * The Page's access token and its linked Instagram account are resolved
 * server-side from the parked user token; the client only ever names a
 * Page id, and never handles a credential.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin');

    const body = await request.json().catch(() => null);
    const pageId = typeof body?.page_id === 'string' ? body.page_id.trim() : '';
    if (!pageId) {
      return NextResponse.json({ error: 'page_id is required' }, { status: 400 });
    }

    const userAccessToken = await loadMetaUserToken(supabase, accountId);
    if (!userAccessToken) {
      return NextResponse.json(
        {
          error:
            'Your Facebook login session has expired. Click “Connect Facebook & Instagram” to start again.',
        },
        { status: 409 },
      );
    }

    let assets;
    try {
      assets = await getMetaAssets(userAccessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error';
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 });
    }

    const asset = assets.find((a) => a.pageId === pageId);
    if (!asset) {
      return NextResponse.json(
        { error: 'That Page is no longer available on this Facebook account.' },
        { status: 404 },
      );
    }

    const ent = await getAccountEntitlements(supabase, accountId);
    const result = await finalizeMetaAsset({
      supabase,
      accountId,
      userId,
      asset,
      allowInstagram: ent.allowInstagram,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    await logAudit({
      accountId,
      actorUserId: userId,
      action: AUDIT.CHANNEL_CONNECTED,
      targetType: 'channel',
      targetId: 'meta',
      targetLabel: result.instagramUsername
        ? `${result.pageName} + Instagram`
        : result.pageName,
      metadata: {
        channel: 'Instagram & Messenger',
        page: result.pageName,
        instagram: result.instagramUsername ?? null,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      page: { id: result.pageId, name: result.pageName },
      instagram_username: result.instagramUsername ?? null,
      instagram_skipped: result.instagramSkipped ?? null,
      instagram_error: result.instagramError ?? null,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/meta/connect
 *
 * Admin+ only. Disconnects Messenger and Instagram together — they share
 * one credential, so keeping one without the other would leave a row
 * that looks connected and cannot send. Conversations, contacts and
 * message history are untouched.
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin');

    const result = await disconnectMetaChannels(supabase, accountId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await logAudit({
      accountId,
      actorUserId: userId,
      action: AUDIT.CHANNEL_DISCONNECTED,
      targetType: 'channel',
      targetId: 'meta',
      targetLabel: 'Instagram & Messenger',
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
