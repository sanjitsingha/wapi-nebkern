import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendFlowMessage } from '@/lib/whatsapp/forms'
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils'
import { assertActiveSubscription } from '@/lib/billing/guard'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/whatsapp/forms/[id]/send
 *
 * Send a PUBLISHED form to the contact behind a conversation, as an
 * interactive Flow message. Mirrors /api/whatsapp/send's
 * conversation → contact → phone resolution and message-row shape,
 * just for this one message kind.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, accountId } = await requireRole('agent')

    const blocked = await assertActiveSubscription(supabase, accountId)
    if (blocked) return blocked

    const limit = checkRateLimit(`send:${accountId}`, RATE_LIMITS.send)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { conversation_id, header_text, body_text, footer_text, cta_text } = body as Record<
      string,
      unknown
    >
    if (typeof conversation_id !== 'string' || typeof body_text !== 'string' || !body_text.trim()) {
      return NextResponse.json(
        { error: 'conversation_id and body_text are required.' },
        { status: 400 },
      )
    }
    const ctaText = typeof cta_text === 'string' && cta_text.trim() ? cta_text : 'Open'

    const { data: form, error: formError } = await supabase
      .from('whatsapp_forms')
      .select('meta_flow_id, status')
      .eq('id', id)
      .eq('account_id', accountId)
      .single()
    if (formError || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    if (form.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'This form has not been published yet.' }, { status: 400 })
    }

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('account_id', accountId)
      .eq('channel', 'whatsapp')
      .single()
    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    const contact = conversation.contact
    if (!contact?.phone) {
      return NextResponse.json({ error: 'Contact has no phone number on file' }, { status: 400 })
    }
    if (contact.marketing_opt_out) {
      return NextResponse.json(
        { error: 'This contact has opted out of messages and cannot be sent to.' },
        { status: 403 },
      )
    }
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone)
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', accountId)
      .single()
    if (configError || !config) {
      return NextResponse.json({ error: 'WhatsApp is not connected.' }, { status: 400 })
    }
    const accessToken = decrypt(config.access_token)

    let sent
    try {
      sent = await sendFlowMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        recipientPhone: sanitizedPhone,
        flowId: form.meta_flow_id,
        headerText: typeof header_text === 'string' ? header_text : undefined,
        bodyText: body_text,
        footerText: typeof footer_text === 'string' ? footer_text : undefined,
        ctaText,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
    }

    const { data: messageRecord, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content_type: 'interactive',
        content_text: body_text,
        message_id: sent.messageId,
        status: 'sent',
        whatsapp_form_id: id,
        flow_token: sent.flowToken,
      })
      .select()
      .single()
    if (msgError) {
      console.error('[whatsapp-forms] send message-insert error:', msgError)
      return NextResponse.json(
        { error: 'Form sent but failed to save to the conversation.' },
        { status: 500 },
      )
    }

    await supabase
      .from('conversations')
      .update({
        last_message_text: body_text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id)

    return NextResponse.json({ success: true, message: messageRecord })
  } catch (err) {
    return toErrorResponse(err)
  }
}
