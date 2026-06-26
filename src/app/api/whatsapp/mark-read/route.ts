import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { markMessageAsRead } from '@/lib/whatsapp/meta-api'

/**
 * POST /api/whatsapp/mark-read   body: { conversation_id }
 *
 * Sends a WhatsApp read receipt (blue ticks) for a conversation. Called
 * by the inbox when the agent opens / reads a thread. Resolves the
 * latest inbound (customer) message's Meta wamid server-side and tells
 * Meta it's been read — which marks that message and every earlier one
 * in the thread as read on the customer's phone.
 *
 * Best-effort: every failure returns 200 with `{ ok: false }` (or a
 * skip reason) so a read-receipt hiccup never breaks opening a chat.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json({ ok: false, skipped: 'no_account' })
    }

    const { conversation_id } = await request.json().catch(() => ({}))
    if (!conversation_id) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 },
      )
    }

    // Latest inbound message with a Meta wamid in this thread. RLS scopes
    // messages to the caller's account via the conversation join, so a
    // caller can't mark another account's conversation read.
    const { data: msg } = await supabase
      .from('messages')
      .select('message_id')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'customer')
      .not('message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!msg?.message_id) {
      return NextResponse.json({ ok: true, skipped: 'no_inbound_message' })
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', accountId)
      .maybeSingle()
    if (!config) {
      return NextResponse.json({ ok: false, skipped: 'no_config' })
    }

    let accessToken: string
    try {
      accessToken = decrypt(config.access_token)
    } catch {
      return NextResponse.json({ ok: false, skipped: 'token_undecryptable' })
    }

    try {
      await markMessageAsRead({
        phoneNumberId: config.phone_number_id,
        accessToken,
        messageId: msg.message_id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[mark-read] Meta mark-as-read failed:', message)
      return NextResponse.json({ ok: false, error: message })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[mark-read] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
