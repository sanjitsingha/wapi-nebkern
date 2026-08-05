import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { isR2Configured, putR2Object, r2PublicUrl } from '@/lib/storage/r2'

/**
 * GET /api/whatsapp/media/[mediaId]
 *
 * Serves a file a customer sent us. Meta does not give us a durable URL —
 * it gives a media id that must be exchanged, with an access token, for a
 * short-lived download link. So this route existed to do that exchange on
 * every single view.
 *
 * That was expensive per VIEWER, not per file: an auth round trip, two
 * database reads, two Meta API calls, and the whole binary streamed
 * through the app. The 24-hour Cache-Control softened it for one browser,
 * but a shared inbox means many browsers — every teammate, device and
 * cache clear paid it again.
 *
 * Now the first view copies the file into R2 and records that in
 * `whatsapp_media_cache` (migration 082). Every later view is one indexed
 * SELECT and a redirect: no Meta call, no token decryption, no bytes
 * through us, and R2 egress is free.
 *
 * Without R2 configured it falls back to the original streaming
 * behaviour, so a self-hosted deployment without a Cloudflare account
 * keeps working exactly as before.
 */

/** Best-effort extension from a MIME type, for a tidier object key. */
function extensionFor(contentType: string | null | undefined): string {
  if (!contentType) return 'bin'
  const subtype = contentType.split(';')[0]?.split('/')[1] ?? ''
  if (!subtype) return 'bin'
  if (subtype === 'jpeg') return 'jpg'
  if (subtype === 'quicktime') return 'mov'
  if (subtype === 'mpeg') return 'mp3'
  // Strip vendor prefixes like `vnd.openxmlformats-officedocument...`
  const clean = subtype.replace(/[^a-z0-9]/gi, '').slice(0, 8)
  return clean || 'bin'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const { mediaId } = await params
    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400 })
    }

    // One call for auth AND account. Reads account context from
    // app_metadata (migration 079) rather than the getUser + profiles
    // pair this route used to do by hand.
    const { supabase, accountId } = await getCurrentAccount()

    // ---- Fast path: already cached ----------------------------
    // Scoped by account as well as media id, so one tenant cannot
    // resolve another's media by guessing an id.
    const { data: cached } = await supabase
      .from('whatsapp_media_cache')
      .select('public_url')
      .eq('account_id', accountId)
      .eq('meta_media_id', mediaId)
      .maybeSingle()

    if (cached?.public_url) {
      // 307 rather than 301: the mapping is stable in practice, but a
      // permanent redirect would be cached by browsers forever and
      // become impossible to correct if an object is ever re-uploaded.
      return NextResponse.redirect(cached.public_url, 307)
    }

    // ---- Slow path: fetch from Meta, then cache ----------------
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('access_token')
      .eq('account_id', accountId)
      .single()

    if (configError || !config?.access_token) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 400 },
      )
    }

    const accessToken = decrypt(config.access_token)
    const mediaInfo = await getMediaUrl({ mediaId, accessToken })
    const { buffer, contentType } = await downloadMedia({
      downloadUrl: mediaInfo.url,
      accessToken,
    })
    const resolvedType =
      contentType || mediaInfo.mimeType || 'application/octet-stream'

    // No R2 on this deployment — behave exactly as before.
    if (!isR2Configured()) {
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': resolvedType,
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Meta's media id is opaque and long, so it makes a good object name
    // — no filename from the customer ends up in the URL.
    const path = `inbound-media/account-${accountId}/${mediaId}.${extensionFor(resolvedType)}`

    try {
      await putR2Object(path, buffer, resolvedType)
      const publicUrl = r2PublicUrl(path)

      // Upsert, because two viewers opening the same photo at once would
      // otherwise race and one insert would fail on the unique index.
      // Either way the object is identical, so the loser can be ignored.
      await supabase
        .from('whatsapp_media_cache')
        .upsert(
          {
            account_id: accountId,
            meta_media_id: mediaId,
            r2_path: path,
            public_url: publicUrl,
            content_type: resolvedType,
            size_bytes: buffer.byteLength,
          },
          { onConflict: 'account_id,meta_media_id' },
        )

      return NextResponse.redirect(publicUrl, 307)
    } catch (cacheErr) {
      // Caching is an optimisation, never a reason to fail the request.
      // Serve the bytes we already have and try again next time.
      console.error('[whatsapp/media] could not cache to R2:', cacheErr)
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': resolvedType,
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }
  } catch (error) {
    return toErrorResponse(error)
  }
}
