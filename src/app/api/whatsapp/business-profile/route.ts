import { NextResponse } from 'next/server'

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import {
  getBusinessProfile,
  updateBusinessProfile,
  BUSINESS_VERTICALS,
} from '@/lib/whatsapp/meta-api'

// Meta's documented field limits for the WhatsApp business profile.
// Enforced here so an over-long value fails as a legible 400 rather
// than a cryptic Meta rejection mid-save.
const LIMITS = {
  about: 139,
  address: 256,
  description: 512,
  email: 128,
  website: 256,
} as const

const VERTICALS = new Set<string>(BUSINESS_VERTICALS)

/**
 * GET /api/whatsapp/business-profile
 *
 * Any account member can read the profile. Returns 200 in every non-auth
 * case so the settings page can render the right message instead of a 500:
 *   { configured: true,  profile: {...} }
 *   { configured: false, reason: 'no_config' | 'token_corrupted' | 'meta_api_error', message }
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
      const profile = await getBusinessProfile({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
      })
      return NextResponse.json({ configured: true, profile })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({
        configured: false,
        reason: 'meta_api_error',
        message: `Meta rejected the request: ${message}`,
      })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/whatsapp/business-profile
 *
 * Admin+ only. Updates the text fields (about, description, address,
 * email, websites, vertical). The photo is handled by the sibling
 * /photo route since it needs a multipart upload.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { about, address, description, email, vertical, websites } =
      body as Record<string, unknown>

    // Validate the text fields. Each is optional, but when present must
    // be the right type and within Meta's length limit.
    const strFields: [string, unknown, number][] = [
      ['about', about, LIMITS.about],
      ['address', address, LIMITS.address],
      ['description', description, LIMITS.description],
      ['email', email, LIMITS.email],
    ]
    for (const [name, value, max] of strFields) {
      if (value === undefined || value === null) continue
      if (typeof value !== 'string') {
        return NextResponse.json({ error: `${name} must be a string` }, { status: 400 })
      }
      if (value.length > max) {
        return NextResponse.json(
          { error: `${name} exceeds Meta's ${max}-character limit` },
          { status: 400 },
        )
      }
    }

    if (vertical !== undefined && vertical !== null) {
      if (typeof vertical !== 'string' || !VERTICALS.has(vertical)) {
        return NextResponse.json({ error: 'Invalid business vertical' }, { status: 400 })
      }
    }

    let cleanWebsites: string[] | undefined
    if (websites !== undefined && websites !== null) {
      if (!Array.isArray(websites)) {
        return NextResponse.json({ error: 'websites must be an array' }, { status: 400 })
      }
      cleanWebsites = websites
        .filter((w): w is string => typeof w === 'string' && w.trim() !== '')
        .map((w) => w.trim())
      if (cleanWebsites.length > 2) {
        return NextResponse.json(
          { error: 'Meta allows at most 2 websites' },
          { status: 400 },
        )
      }
      for (const w of cleanWebsites) {
        if (!/^https?:\/\//i.test(w)) {
          return NextResponse.json(
            { error: `Website "${w}" must start with http:// or https://` },
            { status: 400 },
          )
        }
        if (w.length > LIMITS.website) {
          return NextResponse.json(
            { error: `A website URL exceeds Meta's ${LIMITS.website}-character limit` },
            { status: 400 },
          )
        }
      }
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
      await updateBusinessProfile({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
        profile: {
          about: typeof about === 'string' ? about : undefined,
          address: typeof address === 'string' ? address : undefined,
          description: typeof description === 'string' ? description : undefined,
          email: typeof email === 'string' ? email : undefined,
          vertical: typeof vertical === 'string' ? vertical : undefined,
          websites: cleanWebsites,
        },
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
