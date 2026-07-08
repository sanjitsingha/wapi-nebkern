import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { loadInstagramAccess } from '@/lib/instagram/server-config'
import {
  sendInstagramText,
  sendInstagramMedia,
  type InstagramMediaKind,
} from '@/lib/instagram/meta-api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

const MEDIA_KINDS = ['image', 'video'] as const
const VALID_MESSAGE_TYPES = ['text', ...MEDIA_KINDS] as const

/**
 * POST /api/instagram/send
 *
 * Trimmed mirror of /api/whatsapp/send/route.ts: text + image/video
 * only (no templates, no reply-context, no documents/audio — out of
 * MVP scope). Uses the regular per-request (RLS-scoped) Supabase
 * client, not the service-role admin client — unlike the webhook,
 * this route has a real authenticated user session, so the existing
 * agent+ `conversations_insert`/`messages_modify` RLS policies are
 * the enforcement layer (no new policy needed, already
 * channel-agnostic).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await getCurrentAccount()

    // Distinct bucket from WhatsApp's `send:${userId}` so a burst on
    // one channel can't starve the other.
    const limit = checkRateLimit(`ig-send:${userId}`, RATE_LIMITS.send)
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

    // Defensive `.eq('channel', 'instagram')` — this route can never
    // act on a WhatsApp conversation row, even given a stale/wrong id.
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('account_id', accountId)
      .eq('channel', 'instagram')
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const contact = conversation.contact
    if (!contact?.instagram_id) {
      return NextResponse.json(
        { error: 'Contact has no Instagram id on file' },
        { status: 400 },
      )
    }

    const access = await loadInstagramAccess(supabase, accountId)
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.reason === 'no_config'
              ? 'Instagram is not connected. Set it up under Settings → Instagram first.'
              : 'The stored Instagram access token could not be decrypted.',
        },
        { status: 400 },
      )
    }

    let waMessageId: string
    try {
      if (message_type === 'text') {
        const result = await sendInstagramText({
          igBusinessAccountId: access.access.igBusinessAccountId,
          accessToken: access.access.accessToken,
          recipientId: contact.instagram_id,
          text: content_text as string,
        })
        waMessageId = result.messageId
      } else {
        const result = await sendInstagramMedia({
          igBusinessAccountId: access.access.igBusinessAccountId,
          accessToken: access.access.accessToken,
          recipientId: contact.instagram_id,
          kind: message_type as InstagramMediaKind,
          link: media_url as string,
        })
        waMessageId = result.messageId
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
    }

    // Self-insert, same pattern as the WhatsApp send route — Instagram
    // never echoes agent-sent messages back through anything else in
    // this MVP (the webhook's is_echo filter exists precisely to
    // prevent this row being double-inserted).
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content_type: message_type,
        content_text: typeof content_text === 'string' ? content_text : null,
        media_url: typeof media_url === 'string' ? media_url : null,
        message_id: waMessageId,
        status: 'sent',
      })
      .select()
      .single()

    if (msgError) {
      console.error('[instagram-send] Error inserting message:', msgError)
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
      console.error('[instagram-send] Error updating conversation:', updateError)
    }

    return NextResponse.json({ success: true, message: newMessage })
  } catch (err) {
    return toErrorResponse(err)
  }
}
