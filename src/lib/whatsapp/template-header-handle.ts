import { uploadResumableMedia } from '@/lib/whatsapp/meta-api'
import type { TemplatePayload } from '@/lib/whatsapp/template-validators'

/**
 * Meta requires an `example.header_handle` (from the Resumable Upload
 * API) to create/edit a template with an IMAGE header — a plain public
 * URL is not accepted at creation time. This helper turns the template's
 * `header_media_url` (whether the user uploaded a file or pasted a link)
 * into a handle and writes it onto the payload, so both the upload path
 * and the legacy URL path actually succeed.
 *
 * No-op unless the header is an image that has a URL but no handle yet.
 * Image-only for now (the #230 scope); video/document handles can follow
 * the same shape.
 */

// Meta's image-header sample limits.
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

export async function ensureImageHeaderHandle(
  payload: TemplatePayload,
  accessToken: string,
): Promise<void> {
  if (payload.header_type !== 'image') return
  if (payload.header_handle) return // already have one
  if (!payload.header_media_url) return // validator already requires url-or-handle

  const appId = process.env.META_APP_ID
  if (!appId) {
    throw new Error(
      'Image-header templates need META_APP_ID set (used for Meta’s Resumable Upload). Add it to your environment, or remove the image header.',
    )
  }

  // Fetch the sample image bytes (works for our uploaded chat-media URL
  // and for a manually-pasted public link).
  let res: Response
  try {
    res = await fetch(payload.header_media_url)
  } catch {
    throw new Error('Could not fetch the header image URL. Make sure it is publicly reachable.')
  }
  if (!res.ok) {
    throw new Error(`Header image URL returned ${res.status}. It must be publicly reachable.`)
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (contentType && !ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(`Header image must be JPEG or PNG (got ${contentType}).`)
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('Header image is empty.')
  }
  if (bytes.byteLength > IMAGE_MAX_BYTES) {
    throw new Error(
      `Header image is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB — Meta's limit is 5 MB.`,
    )
  }

  const mimeType = ALLOWED_IMAGE_TYPES.includes(contentType) ? contentType : 'image/jpeg'
  const fileName = mimeType === 'image/png' ? 'header.png' : 'header.jpg'

  const { handle } = await uploadResumableMedia({
    appId,
    accessToken,
    fileName,
    mimeType,
    bytes,
  })
  payload.header_handle = handle
}

// Per-kind Resumable-Upload caps for carousel card media.
const CAROUSEL_MEDIA = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    types: ['image/jpeg', 'image/png'],
    ext: (mime: string) => (mime === 'image/png' ? 'png' : 'jpg'),
    fallbackMime: 'image/jpeg',
  },
  video: {
    maxBytes: 16 * 1024 * 1024,
    types: ['video/mp4', 'video/3gpp'],
    ext: (mime: string) => (mime === 'video/3gpp' ? '3gp' : 'mp4'),
    fallbackMime: 'video/mp4',
  },
} as const

/**
 * Derive a Resumable-Upload handle for every carousel card's media (the
 * same requirement as image headers: Meta needs a handle, not a URL, at
 * creation). No-op for non-carousel payloads or cards that already have
 * a handle. Uploads sequentially so a bad card fails with its index.
 */
export async function ensureCarouselCardHandles(
  payload: TemplatePayload,
  accessToken: string,
): Promise<void> {
  if (payload.template_type !== 'carousel') return
  const cards = payload.carousel_cards ?? []
  if (cards.length === 0) return

  const format = payload.carousel_card_format === 'video' ? 'video' : 'image'
  const spec = CAROUSEL_MEDIA[format]
  const allowedTypes: readonly string[] = spec.types

  const appId = process.env.META_APP_ID
  if (!appId) {
    throw new Error(
      'Carousel templates need META_APP_ID set (used for Meta’s Resumable Upload). Add it to your environment.',
    )
  }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (card.media_handle) continue
    if (!card.media_url) throw new Error(`Card ${i + 1} is missing its ${format}.`)

    let res: Response
    try {
      res = await fetch(card.media_url)
    } catch {
      throw new Error(
        `Card ${i + 1}: could not fetch the media URL. It must be publicly reachable.`,
      )
    }
    if (!res.ok) {
      throw new Error(
        `Card ${i + 1}: media URL returned ${res.status}. It must be publicly reachable.`,
      )
    }

    const contentType = (res.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    if (contentType && !allowedTypes.includes(contentType)) {
      throw new Error(
        `Card ${i + 1}: ${format} must be ${allowedTypes.join(' or ')} (got ${contentType}).`,
      )
    }

    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength === 0) throw new Error(`Card ${i + 1}: media is empty.`)
    if (bytes.byteLength > spec.maxBytes) {
      throw new Error(
        `Card ${i + 1}: ${format} is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB — Meta's limit is ${(spec.maxBytes / 1024 / 1024).toFixed(0)} MB.`,
      )
    }

    const mimeType = allowedTypes.includes(contentType)
      ? contentType
      : spec.fallbackMime
    const { handle } = await uploadResumableMedia({
      appId,
      accessToken,
      fileName: `card-${i + 1}.${spec.ext(mimeType)}`,
      mimeType,
      bytes,
    })
    card.media_handle = handle
  }
}
