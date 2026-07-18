import { NextResponse } from 'next/server'

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import { getCallingSettings, setCallingEnabled } from '@/lib/whatsapp/calling'
import {
  featureBlockedResponse,
  getAccountEntitlements,
} from '@/lib/billing/entitlements'

/**
 * GET /api/whatsapp/calling
 *
 * Any account member can read the calling status. Returns 200 in every
 * non-auth case so the settings panel can render the right state:
 *   { configured: true, enabled, status, callIconVisibility }
 *   { configured: false, reason: 'no_config' | 'token_corrupted' | 'meta_api_error', message }
 *
 * The `meta_api_error` branch is meaningful here: a number that does NOT
 * have Calling API access from Meta fails this read, which is exactly how
 * the panel tells the user "your number isn't approved for calling yet".
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json({
        configured: false,
        reason: access.reason,
        message:
          access.reason === 'no_config'
            ? 'WhatsApp is not connected yet. Connect it under Settings → WhatsApp first.'
            : 'The stored WhatsApp access token could not be decrypted. Reset and re-save your connection under Settings → WhatsApp.',
      })
    }

    try {
      const settings = await getCallingSettings({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
      })
      return NextResponse.json({
        configured: true,
        enabled: settings.enabled,
        status: settings.status,
        callIconVisibility: settings.callIconVisibility,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({
        configured: false,
        reason: 'meta_api_error',
        message: `Meta could not return calling settings for this number: ${message}. Your number may not have Calling API access enabled yet.`,
      })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/whatsapp/calling  { enabled: boolean }
 *
 * Admin+ only. Enables or disables calling on the number. Enabling turns
 * on the in-chat call button (call_icon_visibility=DEFAULT) so customers
 * can call — this is what activates inbound calling.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Request body must be { enabled: boolean }' },
        { status: 400 },
      )
    }

    // Plan gate — only ENABLING is gated; turning calling off must
    // always work (e.g. right after a downgrade).
    if (body.enabled) {
      const ent = await getAccountEntitlements(supabase, accountId)
      if (!ent.allowCalling) return featureBlockedResponse('WhatsApp Calling')
    }

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.reason === 'no_config'
              ? 'WhatsApp is not connected yet.'
              : 'The stored WhatsApp access token could not be decrypted.',
        },
        { status: 400 },
      )
    }

    try {
      await setCallingEnabled({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
        enabled: body.enabled,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json(
        {
          error: `Meta rejected the change: ${message}. If this says calling isn't available, your number likely needs Calling API access approved by Meta first.`,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, enabled: body.enabled })
  } catch (err) {
    return toErrorResponse(err)
  }
}
