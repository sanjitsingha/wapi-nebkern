import { NextResponse } from 'next/server'

import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { isUniqueViolation } from '@/lib/contacts/dedupe'
import { supabaseAdmin } from '@/lib/flows/admin-client'

// Structural mirror of src/app/api/instagram/webhook/route.ts, one
// channel over — same Messenger Platform payload shape, same
// resolve → contact → conversation → message pipeline. Kept as a
// separate file (rather than generalizing the Instagram route) so
// neither channel can regress the other, matching how migration 066
// describes the Messenger implementation as deliberately parallel.
//
// Every DB write goes through the service-role admin client: a webhook
// request carries no user session, so an RLS-scoped client would fail
// every insert against is_account_member(...)'s auth.uid() check.

interface MessengerAttachment {
  type: string
  payload?: { url?: string }
}

interface MessengerMessage {
  mid: string
  text?: string
  attachments?: MessengerAttachment[]
  /** Redelivery of the Page's own outbound send, shaped as an inbound
   *  event. MUST be filtered — the send route already inserted this
   *  message itself; processing the echo too would double-insert it. */
  is_echo?: boolean
}

interface MessengerMessagingEvent {
  /** The customer's PSID on inbound events. */
  sender: { id: string }
  /** The Page id on inbound events. */
  recipient: { id: string }
  /** Milliseconds since epoch — the Messenger Platform convention.
   *  Do NOT copy WhatsApp's seconds-based conversion here. */
  timestamp: number
  message?: MessengerMessage
}

interface MessengerWebhookEntry {
  /** Page id. */
  id: string
  time: number
  messaging?: MessengerMessagingEvent[]
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
      .from('messenger_config')
      .select('id, verify_token')

    if (configError || !configs) {
      console.error('[messenger-webhook] Error fetching configs for verification:', configError)
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
          .from('messenger_config')
          .update({ verify_token: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn(
                '[messenger-webhook] verify_token GCM upgrade failed:',
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
    console.error('[messenger-webhook] Error in GET verification:', error)
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
    '[messenger-webhook] POST received',
    JSON.stringify({ hasSignature: Boolean(signature), bytes: rawBody.length }),
  )

  // META_APP_SECRET covers every product's webhook subscriptions on the
  // one Meta App (WhatsApp, Instagram, Page) — helper reused as-is.
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[messenger-webhook] rejected request with invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: { object?: string; entry?: MessengerWebhookEntry[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Await processing before returning 200 — serverless instances can
  // freeze work scheduled after the response is sent.
  try {
    await processWebhook(body)
  } catch (error) {
    console.error('[messenger-webhook] Error processing webhook:', error)
  }

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processWebhook(body: { object?: string; entry?: MessengerWebhookEntry[] }) {
  if (!body.entry) return

  // The Page webhook and the Instagram webhook are subscriptions on the
  // same Meta App and can share a callback URL; `object` is what tells
  // them apart. Ignore anything that isn't a Page event so an Instagram
  // delivery can never be ingested here as a Messenger thread.
  if (body.object && body.object !== 'page') return

  for (const entry of body.entry) {
    for (const event of entry.messaging ?? []) {
      if (!event.message) continue // delivery/read/postback — out of scope
      if (event.message.is_echo) continue // our own send, redelivered

      const senderId = event.sender?.id
      if (!senderId) continue

      // entry.id is the Page id; recipient.id is the Page id on inbound
      // events. Check both rather than trusting one field's position.
      const candidateIds = Array.from(
        new Set([entry.id, event.recipient?.id].filter((v): v is string => Boolean(v))),
      )

      const config = await resolveMessengerConfig(candidateIds)
      if (!config) {
        console.error('[messenger-webhook] No messenger_config matched ids:', candidateIds)
        continue
      }

      if (!config.created_by) {
        // The admin who connected this Page was later removed — there's
        // no NOT-NULL user_id to attribute the row's audit column to.
        // Remediation is reconnecting via Settings → Messenger.
        console.error(
          '[messenger-webhook] messenger_config has no created_by, skipping (account_id:',
          config.account_id,
          ')',
        )
        continue
      }

      // A disconnected Page keeps its row (DELETE removes it entirely,
      // but a half-finished reconnect can sit at status 'disconnected').
      // Don't ingest into a channel the operator has turned off.
      if (config.status !== 'connected') {
        console.warn(
          '[messenger-webhook] ignoring event for non-connected page:',
          config.page_id,
        )
        continue
      }

      const accountId: string = config.account_id
      const configOwnerUserId: string = config.created_by

      const contact = await findOrCreateMessengerContact(accountId, configOwnerUserId, senderId)
      if (!contact) continue

      const conversation = await findOrCreateMessengerConversation(
        accountId,
        configOwnerUserId,
        contact.id,
      )
      if (!conversation) continue

      const { contentType, contentText, mediaUrl } = parseMessageContent(event.message)
      if (!contentText && !mediaUrl) continue // nothing renderable

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
        // Meta retries a webhook it considers failed, so the same mid can
        // arrive twice; a unique violation here is that replay, not a bug.
        if (isUniqueViolation(msgError)) {
          console.info('[messenger-webhook] duplicate mid ignored:', event.message.mid)
        } else {
          console.error('[messenger-webhook] Error inserting message:', msgError)
        }
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
        console.error('[messenger-webhook] Error updating conversation:', convError)
      }
    }
  }
}

/**
 * Resolve the owning messenger_config row by page_id. Uses a
 * parameterized .eq() (not a raw .or() filter string) so a
 * payload-controlled id can't inject PostgREST filter syntax.
 */
async function resolveMessengerConfig(candidateIds: string[]) {
  for (const id of candidateIds) {
    const { data } = await supabaseAdmin()
      .from('messenger_config')
      .select('*')
      .eq('page_id', id)
      .maybeSingle()
    if (data) return data
  }
  return null
}

// content_type CHECK constraint (messages table) allows: text, image,
// document, audio, video, location, template, interactive. Messenger
// attachment types that map cleanly pass through; anything else
// (fallback, template, share, story_mention) degrades to a text row
// rather than failing the insert.
const ATTACHMENT_TYPE_MAP: Record<string, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'document',
  location: 'location',
}

function parseMessageContent(message: MessengerMessage): {
  contentType: string
  contentText?: string
  mediaUrl?: string
} {
  const attachment = message.attachments?.[0]
  if (attachment) {
    const mappedType = ATTACHMENT_TYPE_MAP[attachment.type]
    if (mappedType) {
      return {
        contentType: mappedType,
        contentText: message.text,
        mediaUrl: attachment.payload?.url,
      }
    }
    // Unmapped kind — keep the thread readable instead of dropping it.
    return {
      contentType: 'text',
      contentText: message.text || `[${attachment.type}]`,
    }
  }
  return { contentType: 'text', contentText: message.text }
}

interface ContactOutcome {
  id: string
  [key: string]: unknown
}

async function findOrCreateMessengerContact(
  accountId: string,
  configOwnerUserId: string,
  messengerId: string,
): Promise<ContactOutcome | null> {
  // Exact match — a PSID is opaque, so no fuzzy matching (unlike phone).
  const { data: existing } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('messenger_id', messengerId)
    .maybeSingle()

  if (existing) return existing

  const { data: newContact, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      messenger_id: messengerId,
      // No display name without an extra Graph call (needs the PSID
      // profile endpoint) — fall back to the raw id, same as the
      // Instagram webhook does with an IGSID.
      name: messengerId,
    })
    .select()
    .single()

  if (createError) {
    if (isUniqueViolation(createError)) {
      const { data: raced } = await supabaseAdmin()
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .eq('messenger_id', messengerId)
        .maybeSingle()
      if (raced) return raced
    }
    console.error('[messenger-webhook] Error creating contact:', createError)
    return null
  }

  return newContact
}

async function findOrCreateMessengerConversation(
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
) {
  const { data: existingRows, error: findError } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .eq('channel', 'messenger')
    .order('created_at', { ascending: true })
    .limit(1)

  if (findError) {
    console.error('[messenger-webhook] Error looking up conversation:', findError)
  } else if (existingRows && existingRows.length > 0) {
    return existingRows[0]
  }

  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      contact_id: contactId,
      channel: 'messenger',
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
        .eq('channel', 'messenger')
        .order('created_at', { ascending: true })
        .limit(1)
      if (racedRows && racedRows.length > 0) return racedRows[0]
    }
    console.error('[messenger-webhook] Error creating conversation:', createError)
    return null
  }

  return newConv
}
