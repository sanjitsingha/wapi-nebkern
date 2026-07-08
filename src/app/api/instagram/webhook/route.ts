import { NextResponse } from 'next/server'

import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { isUniqueViolation } from '@/lib/contacts/dedupe'
import { supabaseAdmin } from '@/lib/flows/admin-client'

// Every DB write in this route goes through the service-role admin
// client (supabaseAdmin) — a webhook request has no authenticated user
// session, so the normal RLS-scoped client would fail every insert
// against is_account_member(...)'s auth.uid() check. Mirrors exactly
// how src/app/api/whatsapp/webhook/route.ts does it.

// ============================================================
// Payload shape — Instagram's Messenger-Platform-style webhook.
// VERIFY against Meta's current Instagram Messaging API docs before
// relying on this in production; the exact field names below are the
// conventional Messenger-webhook shape, not independently confirmed
// against a live payload. In particular `entry[].id` and
// `messaging[].recipient.id` are ASSUMED to carry the business's own
// id (page id or IG business account id, ambiguous which) — see
// resolveInstagramConfig() below, which defensively checks both.
// ============================================================

interface InstagramAttachment {
  type: string
  payload?: { url?: string }
}

interface InstagramMessage {
  mid: string
  text?: string
  attachments?: InstagramAttachment[]
  /** Redelivery of the Page's own outbound send, shaped as an inbound
   *  event. MUST be filtered — the send route already inserted this
   *  message itself; processing the echo too would double-insert it. */
  is_echo?: boolean
}

interface InstagramMessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  /** VERIFY: assumed milliseconds since epoch (standard Messenger
   *  Platform convention) — WhatsApp's webhook uses seconds instead,
   *  do not copy that conversion here. */
  timestamp: number
  message?: InstagramMessage
}

interface InstagramWebhookEntry {
  id: string
  time: number
  messaging?: InstagramMessagingEvent[]
}

// ============================================================
// GET — webhook verification handshake
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json({ error: 'Missing verification parameters' }, { status: 400 })
    }

    const { data: configs, error: configError } = await supabaseAdmin()
      .from('instagram_config')
      .select('id, verify_token')

    if (configError || !configs) {
      console.error('[instagram-webhook] Error fetching configs for verification:', configError)
      return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedConfig: any = null
    for (const config of configs) {
      if (!config.verify_token) continue
      try {
        if (decrypt(config.verify_token) === verifyToken) {
          matchedConfig = config
          break
        }
      } catch {
        // Malformed / wrong-key token row — skip and keep checking.
      }
    }

    if (matchedConfig) {
      if (isLegacyFormat(matchedConfig.verify_token)) {
        void supabaseAdmin()
          .from('instagram_config')
          .update({ verify_token: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn(
                '[instagram-webhook] verify_token GCM upgrade failed:',
                (error as { message?: string })?.message ?? error,
              )
            }
          })
      }
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return NextResponse.json({ error: 'Verification token mismatch' }, { status: 403 })
  } catch (error) {
    console.error('[instagram-webhook] Error in GET verification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// POST — receive messages
// ============================================================
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  console.info(
    '[instagram-webhook] POST received',
    JSON.stringify({ hasSignature: Boolean(signature), bytes: rawBody.length }),
  )

  // META_APP_SECRET covers every product's webhook subscriptions on
  // the one Meta App (WhatsApp, Instagram, Page) — this helper is
  // already generic, reused as-is, no new env var needed.
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[instagram-webhook] rejected request with invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: { entry?: InstagramWebhookEntry[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Await processing before returning 200 — same rationale as the
  // WhatsApp webhook (serverless instances can freeze work scheduled
  // after the response is sent).
  try {
    await processWebhook(body)
  } catch (error) {
    console.error('[instagram-webhook] Error processing webhook:', error)
  }

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processWebhook(body: { entry?: InstagramWebhookEntry[] }) {
  if (!body.entry) return

  for (const entry of body.entry) {
    for (const event of entry.messaging ?? []) {
      if (!event.message) continue // not a message event (read/postback/etc.) — out of scope
      if (event.message.is_echo) continue // our own outbound send, redelivered — see file header

      const senderId = event.sender.id
      const candidateIds = Array.from(
        new Set([entry.id, event.recipient?.id].filter((v): v is string => Boolean(v))),
      )

      const config = await resolveInstagramConfig(candidateIds)
      if (!config) {
        console.error(
          '[instagram-webhook] No instagram_config matched ids:',
          candidateIds,
        )
        continue
      }

      if (!config.created_by) {
        // The admin who connected this account was later removed —
        // there's no NOT-NULL user_id to attribute the row's audit
        // column to. Remediation is reconnecting via Settings →
        // Instagram (which sets created_by to the current admin).
        console.error(
          '[instagram-webhook] instagram_config has no created_by, skipping (account_id:',
          config.account_id,
          ')',
        )
        continue
      }

      const accountId: string = config.account_id
      const configOwnerUserId: string = config.created_by

      const contact = await findOrCreateInstagramContact(accountId, configOwnerUserId, senderId)
      if (!contact) continue

      const conversation = await findOrCreateInstagramConversation(
        accountId,
        configOwnerUserId,
        contact.id,
      )
      if (!conversation) continue

      const { contentType, contentText, mediaUrl } = parseMessageContent(event.message)
      if (!contentText && !mediaUrl) continue // nothing renderable — skip

      const { error: msgError } = await supabaseAdmin().from('messages').insert({
        conversation_id: conversation.id,
        sender_type: 'customer',
        content_type: contentType,
        content_text: contentText,
        media_url: mediaUrl,
        message_id: event.message.mid,
        status: 'delivered',
        created_at: new Date(event.timestamp).toISOString(),
      })

      if (msgError) {
        console.error('[instagram-webhook] Error inserting message:', msgError)
        continue
      }

      const now = new Date().toISOString()
      const { error: convError } = await supabaseAdmin()
        .from('conversations')
        .update({
          last_message_text: contentText || `[${contentType}]`,
          last_message_at: now,
          customer_replied_at: now,
          unread_count: (conversation.unread_count || 0) + 1,
          updated_at: now,
        })
        .eq('id', conversation.id)

      if (convError) {
        console.error('[instagram-webhook] Error updating conversation:', convError)
      }
    }
  }
}

/**
 * Resolve the owning instagram_config row by checking each candidate
 * id (entry.id, recipient.id) against both page_id and
 * instagram_business_account_id — deliberately over-inclusive since
 * which field Meta actually populates in the webhook payload isn't
 * independently confirmed (see file header). Uses parameterized
 * .eq() calls (not a raw .or() filter string) so payload-controlled
 * ids can't inject PostgREST filter syntax.
 */
async function resolveInstagramConfig(candidateIds: string[]) {
  for (const column of ['instagram_business_account_id', 'page_id'] as const) {
    for (const id of candidateIds) {
      const { data } = await supabaseAdmin()
        .from('instagram_config')
        .select('*')
        .eq(column, id)
        .maybeSingle()
      if (data) return data
    }
  }
  return null
}

// content_type CHECK constraint (messages table) allows: text, image,
// document, audio, video, location, template, interactive. Instagram
// attachment `type` values that map cleanly pass through; anything
// else (share, story_mention, ig_reel, ...) falls back to 'text' with
// a caption-only rendering rather than failing the insert.
const ALLOWED_ATTACHMENT_TYPES = new Set(['image', 'video', 'audio', 'document'])

function parseMessageContent(message: InstagramMessage): {
  contentType: string
  contentText?: string
  mediaUrl?: string
} {
  const attachment = message.attachments?.[0]
  if (attachment) {
    const mappedType = ALLOWED_ATTACHMENT_TYPES.has(attachment.type)
      ? attachment.type
      : 'image' // Instagram's most common attachment type by far
    return {
      contentType: mappedType,
      contentText: message.text,
      mediaUrl: attachment.payload?.url,
    }
  }
  return { contentType: 'text', contentText: message.text }
}

interface ContactOutcome {
  id: string
  [key: string]: unknown
}

async function findOrCreateInstagramContact(
  accountId: string,
  configOwnerUserId: string,
  instagramId: string,
): Promise<ContactOutcome | null> {
  // Exact match — instagram_id is an opaque IGSID, no fuzzy matching
  // needed (unlike phone). Inlined here rather than extending
  // src/lib/contacts/dedupe.ts, which is phone/fuzzy-match-specific.
  const { data: existing } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('instagram_id', instagramId)
    .maybeSingle()

  if (existing) return existing

  const { data: newContact, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      instagram_id: instagramId,
      // No display name available without an extra Graph API profile
      // call (out of scope for MVP) — fall back to the raw id, same
      // as the WhatsApp webhook falling back to the raw phone.
      name: instagramId,
    })
    .select()
    .single()

  if (createError) {
    if (isUniqueViolation(createError)) {
      const { data: raced } = await supabaseAdmin()
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .eq('instagram_id', instagramId)
        .maybeSingle()
      if (raced) return raced
    }
    console.error('[instagram-webhook] Error creating contact:', createError)
    return null
  }

  return newContact
}

async function findOrCreateInstagramConversation(
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
) {
  const { data: existingRows, error: findError } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .eq('channel', 'instagram')
    .order('created_at', { ascending: true })
    .limit(1)

  if (findError) {
    console.error('[instagram-webhook] Error looking up conversation:', findError)
  } else if (existingRows && existingRows.length > 0) {
    return existingRows[0]
  }

  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      contact_id: contactId,
      channel: 'instagram',
    })
    .select()
    .single()

  if (createError) {
    if (isUniqueViolation(createError)) {
      const { data: racedRows } = await supabaseAdmin()
        .from('conversations')
        .select('*')
        .eq('account_id', accountId)
        .eq('contact_id', contactId)
        .eq('channel', 'instagram')
        .order('created_at', { ascending: true })
        .limit(1)
      if (racedRows && racedRows.length > 0) return racedRows[0]
    }
    console.error('[instagram-webhook] Error creating conversation:', createError)
    return null
  }

  return newConv
}
