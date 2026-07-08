import { NextResponse } from 'next/server'

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { loadInstagramAccess } from '@/lib/instagram/server-config'
import {
  verifyInstagramAccount,
  subscribePageToApp,
} from '@/lib/instagram/meta-api'
import { encrypt } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from '@/lib/flows/admin-client'

/**
 * GET /api/instagram/config
 *
 * Any account member can read. Returns 200 for every non-auth failure
 * so the settings page can render the right message rather than a 500:
 *   { connected: true, account_info: {...} }
 *   { connected: false, reason: 'no_config' | 'token_corrupted' | 'meta_api_error', message, needs_reset? }
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const access = await loadInstagramAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json({
        connected: false,
        reason: access.reason,
        message:
          access.reason === 'no_config'
            ? 'No Instagram configuration saved yet. Fill in the form and click Save.'
            : 'The stored Instagram access token cannot be decrypted with the current ENCRYPTION_KEY. Reset and re-save your connection below.',
        needs_reset: access.reason === 'token_corrupted' || undefined,
      })
    }

    try {
      const accountInfo = await verifyInstagramAccount({
        igBusinessAccountId: access.access.igBusinessAccountId,
        accessToken: access.access.accessToken,
      })
      return NextResponse.json({ connected: true, account_info: accountInfo })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({
        connected: false,
        reason: 'meta_api_error',
        message: `Meta API rejected the credentials: ${message}`,
      })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/instagram/config
 *
 * Admin+ only. Verifies the pasted credentials against Meta before
 * saving, then best-effort subscribes the Page to this app's webhook.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { page_id, instagram_business_account_id, access_token, verify_token } =
      body as Record<string, unknown>

    if (
      typeof page_id !== 'string' || !page_id.trim() ||
      typeof instagram_business_account_id !== 'string' || !instagram_business_account_id.trim() ||
      typeof access_token !== 'string' || !access_token.trim()
    ) {
      return NextResponse.json(
        { error: 'page_id, instagram_business_account_id, and access_token are required' },
        { status: 400 },
      )
    }

    // Reject if another account has already claimed this IG business
    // account id — same "one number, one owner" guard as whatsapp_config's
    // phone_number_id check (issue #136); without it the webhook's
    // account-resolution lookup could match more than one row.
    const { data: claimed, error: claimedError } = await supabaseAdmin()
      .from('instagram_config')
      .select('account_id')
      .eq('instagram_business_account_id', instagram_business_account_id)
      .neq('account_id', accountId)
      .maybeSingle()

    if (claimedError) {
      console.error('Error checking instagram_business_account_id ownership:', claimedError)
      return NextResponse.json({ error: 'Failed to validate configuration' }, { status: 500 })
    }
    if (claimed) {
      return NextResponse.json(
        {
          error:
            'This Instagram account is already connected to another account on this instance.',
        },
        { status: 409 },
      )
    }

    // Verify credentials with Meta BEFORE saving.
    let accountInfo
    try {
      accountInfo = await verifyInstagramAccount({
        igBusinessAccountId: instagram_business_account_id,
        accessToken: access_token,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
    }

    let encryptedAccessToken: string
    let encryptedVerifyToken: string | null
    try {
      encryptedAccessToken = encrypt(access_token)
      encryptedVerifyToken =
        typeof verify_token === 'string' && verify_token.trim() ? encrypt(verify_token) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown encryption error'
      return NextResponse.json(
        { error: `Failed to encrypt token: ${message}` },
        { status: 500 },
      )
    }

    // Best-effort — subscribing the Page to the app's webhook is
    // separate from registering the callback URL itself (an
    // unavoidably manual step in Meta's App Dashboard). Never block
    // save on this failing.
    let subscribedAt: string | null = null
    try {
      await subscribePageToApp({ pageId: page_id, accessToken: access_token })
      subscribedAt = new Date().toISOString()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('Instagram Page subscribed_apps failed (non-fatal):', message)
    }

    const { data: existing } = await supabase
      .from('instagram_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    const baseRow = {
      page_id,
      instagram_business_account_id,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      status: 'connected' as const,
      connected_at: new Date().toISOString(),
      subscribed_at: subscribedAt,
      last_verification_error: null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('instagram_config')
        .update(baseRow)
        .eq('account_id', accountId)
      if (updateError) {
        console.error('Error updating instagram_config:', updateError)
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase
        .from('instagram_config')
        .insert({ account_id: accountId, created_by: userId, ...baseRow })
      if (insertError) {
        console.error('Error inserting instagram_config:', insertError)
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, connected: true, account_info: accountInfo })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/instagram/config
 *
 * Admin+ only. Removes the account's Instagram configuration.
 */
export async function DELETE() {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const { error } = await supabase
      .from('instagram_config')
      .delete()
      .eq('account_id', accountId)

    if (error) {
      console.error('Error deleting instagram_config:', error)
      return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
