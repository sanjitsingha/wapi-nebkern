import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { loadWhatsAppAccess } from '@/lib/whatsapp/server-config'
import {
  uploadResumableMedia,
  updateBusinessProfile,
  getBusinessProfile,
} from '@/lib/whatsapp/meta-api'

// Meta accepts JPEG/PNG for the business profile photo. Keep the cap
// modest — profile photos are small and this bounds the resumable
// upload payload.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png'])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * POST /api/whatsapp/business-profile/photo  (multipart/form-data)
 *
 * Admin+ only. Uploads a new profile photo:
 *   1. resumable-upload the bytes (app-scoped) → media handle
 *   2. set it via whatsapp_business_profile.profile_picture_handle
 *   3. re-read the profile so the client gets the fresh CDN url
 *
 * Field name: `file`.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const appId = process.env.META_APP_ID
    if (!appId) {
      return NextResponse.json(
        {
          error:
            'Photo upload is not configured on this server. Set META_APP_ID (Meta for Developers → App Settings → Basic) and restart.',
        },
        { status: 500 },
      )
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file uploaded (expected a `file` field).' },
        { status: 400 },
      )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Profile photo must be a JPEG or PNG image.' },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Profile photo must be 5 MB or smaller.' },
        { status: 400 },
      )
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

    const bytes = new Uint8Array(await file.arrayBuffer())

    try {
      const { handle } = await uploadResumableMedia({
        appId,
        accessToken: access.access.accessToken,
        fileName: file.name || 'profile-photo',
        mimeType: file.type,
        bytes,
      })

      await updateBusinessProfile({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
        profile: { profilePictureHandle: handle },
      })

      // Re-read so the client can swap the preview to Meta's stored copy
      // (a fresh short-lived CDN url), confirming the change landed.
      const profile = await getBusinessProfile({
        phoneNumberId: access.access.phoneNumberId,
        accessToken: access.access.accessToken,
      })

      return NextResponse.json({
        success: true,
        profile_picture_url: profile.profile_picture_url ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
