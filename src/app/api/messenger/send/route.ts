import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { loadMessengerAccess } from '@/lib/messenger/server-config'
import {
  sendMessengerText,
  sendMessengerMedia,
  type MessengerMediaKind,
} from '@/lib/messenger/meta-api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

// Accepts the composer's vocabulary, which is also the messages table's
// content_type vocabulary. Messenger supports all four attachment kinds
// (unlike Instagram, which is image/video only).
const MEDIA_KINDS = ['image', 'video', 'audio', 'document'] as const
const VALID_MESSAGE_TYPES = ['text', ...MEDIA_KINDS] as const

// The Send API calls a document a 'file'. Translate at the boundary and
// keep 'document' on the stored row.
const SEND_API_KIND: Record<string, MessengerMediaKind> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'file',
}

/**
 * POST /api/messenger/send
 *
 * Mirror of /api/instagram/send/route.ts for Facebook Pages. Uses the
 * regular per-request (RLS-scoped) Supabase client, not the service-role
 * admin client — this route has a real authenticated user session, so
 * the existing agent+ `messages_modify` RLS policies are the enforcement
 * layer (already channel-agnostic, no new policy needed).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await getCurrentAccount()

    // Distinct bucket from WhatsApp's `send:${userId}` and Instagram's
    // `ig-send:${userId}` so a burst on one channel can't starve another.
    const limit = checkRateLimit(`fb-send:${userId}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { conversation_id, message_type, content_text, media_url } =
      body as Record<string, unknown>

    if (!conversation_id || !message_type) {
      return NextResponse.json(
        { error: 'conversation_id and message_type are required' },
        { status: 400 },
      )
    }
    if (
      typeof message_type !== 'string' ||
      !(VALID_MESSAGE_TYPES as readonly string[]).includes(message_type)
    ) {
      return NextResponse.json(
        { error: `Unsupported message_type "${String(message_type)}"` },
        { status: 400 },
      )
    }
    const isMediaKind = (MEDIA_KINDS as readonly string[]).includes(message_type)
    if (message_type === 'text' && (typeof content_text !== 'string' || !content_text)) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 },
      )
    }
    if (isMediaKind && (typeof media_url !== 'string' || !media_url)) {
      return NextResponse.json(
        { error: `media_url is required for ${message_type} messages` },
        { status: 400 },
      )
    }

    // Defensive `.eq('channel', 'messenger')` — this route can never act
    // on a WhatsApp or Instagram row, even given a stale/wrong id.
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('account_id', accountId)
      .eq('channel', 'messenger')
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const contact = conversation.contact
    if (!contact?.messenger_id) {
      return NextResponse.json(
        { error: 'Contact has no Messenger id on file' },
        { status: 400 },
      )
    }

    const access = await loadMessengerAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.reason === 'no_config'
              ? 'Messenger is not connected. Set it up under Settings → Messenger first.'
              : 'The stored Page access token could not be decrypted.',
        },
        { status: 400 },
      )
    }

    let sentMessageId: string
    try {
      if (message_type === 'text') {
        const result = await sendMessengerText({
          pageAccessToken: access.access.accessToken,
          recipientId: contact.messenger_id,
          text: content_text as string,
        })
        sentMessageId = result.messageId
      } else {
        const result = await sendMessengerMedia({
          pageAccessToken: access.access.accessToken,
          recipientId: contact.messenger_id,
          kind: SEND_API_KIND[message_type],
          link: media_url as string,
        })
        sentMessageId = result.messageId
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
    }

    // Self-insert, same pattern as the WhatsApp/Instagram send routes.
    // The webhook's is_echo filter exists precisely so this row isn't
    // double-inserted when Meta redelivers our own send.
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content_type: message_type,
        content_text: typeof content_text === 'string' ? content_text : null,
        media_url: typeof media_url === 'string' ? media_url : null,
        message_id: sentMessageId,
        status: 'sent',
      })
      .select()
      .single()

    if (msgError) {
      console.error('[messenger-send] Error inserting message:', msgError)
      return NextResponse.json({ error: 'Message sent but failed to save' }, { status: 500 })
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_message_text: typeof content_text === 'string' ? content_text : `[${message_type}]`,
        last_message_at: now,
        updated_at: now,
      })
      .eq('id', conversation_id)

    if (updateError) {
      console.error('[messenger-send] Error updating conversation:', updateError)
    }

    return NextResponse.json({ success: true, message: newMessage })
  } catch (err) {
    return toErrorResponse(err)
  }
}
