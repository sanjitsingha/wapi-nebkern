import { NextResponse } from 'next/server'

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import {
  getConnectedCatalogs,
  getCommerceSettings,
  updateCommerceSettings,
} from '@/lib/whatsapp/meta-api'

/**
 * GET /api/whatsapp/catalog
 *
 * Overview for the Catalogue settings page. Any member can read.
 * Always 200 for non-auth failures so the page can render the right
 * guidance rather than a 500:
 *   { configured: false, reason: 'no_config' | 'token_corrupted', message }
 *   { configured: true, catalog: null, reason: 'no_waba' | 'permission' | 'no_catalog', message, commerceSettings }
 *   { configured: true, catalog: {...}, commerceSettings: {...} | null }
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

    const { phoneNumberId, wabaId, accessToken } = access.access

    if (!wabaId) {
      return NextResponse.json({
        configured: true,
        catalog: null,
        reason: 'no_waba',
        message:
          'No WhatsApp Business Account (WABA) id is saved. Re-save your WhatsApp connection to enable the catalogue.',
        commerceSettings: null,
      })
    }

    // Commerce settings are best-effort — read them, but a failure
    // (permission/none set) must not sink the whole overview.
    let commerceSettings = null
    try {
      commerceSettings = await getCommerceSettings({ phoneNumberId, accessToken })
    } catch {
      commerceSettings = null
    }

    try {
      const catalogs = await getConnectedCatalogs({ wabaId, accessToken })
      const catalog = catalogs[0] ?? null
      return NextResponse.json({
        configured: true,
        catalog,
        reason: catalog ? undefined : 'no_catalog',
        message: catalog
          ? undefined
          : 'No catalogue is connected to your WhatsApp Business Account yet. Create one in Meta Commerce Manager, then connect it to this WABA.',
        commerceSettings,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({
        configured: true,
        catalog: null,
        reason: 'permission',
        message: `Could not read the connected catalogue: ${message}`,
        commerceSettings,
      })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/whatsapp/catalog
 *
 * Admin+ only. Updates commerce settings (cart enabled / catalog
 * visible). Body: { is_cart_enabled?: boolean, is_catalog_visible?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { is_cart_enabled, is_catalog_visible } = body as Record<string, unknown>

    if (is_cart_enabled === undefined && is_catalog_visible === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    for (const [name, value] of [
      ['is_cart_enabled', is_cart_enabled],
      ['is_catalog_visible', is_catalog_visible],
    ] as const) {
      if (value !== undefined && typeof value !== 'boolean') {
        return NextResponse.json({ error: `${name} must be a boolean` }, { status: 400 })
      }
    }

    const access = await loadWhatsAppAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json(
        { error: 'WhatsApp is not connected, or its token could not be read.' },
        { status: 400 },
      )
    }

    try {
      await updateCommerceSettings({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
        isCartEnabled:
          typeof is_cart_enabled === 'boolean' ? is_cart_enabled : undefined,
        isCatalogVisible:
          typeof is_catalog_visible === 'boolean' ? is_catalog_visible : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
