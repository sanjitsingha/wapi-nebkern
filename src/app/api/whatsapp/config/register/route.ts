import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { registerNumber } from '@/lib/whatsapp/connect-flow'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'
import { subscribeWabaToApp } from '@/lib/whatsapp/meta-api'

/**
 * POST /api/whatsapp/config/register
 *
 * "Finish setup" for a connected number Meta isn't delivering messages
 * for yet: re-run subscribe + register with the stored token, so fixing
 * it never means pasting the token again.
 *
 * Body: { pin?: string } — needed only when the number has a two-step
 * PIN of its own (a previous attempt answered `needs_pin`).
 * 200:  { registered, skipped, needs_pin, error }
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = (await request.json().catch(() => ({}))) as { pin?: unknown }
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (pin && !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'The PIN is six digits.' }, { status: 400 })
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, waba_id, access_token, registration_pin, connected_at')
      .eq('account_id', accountId)
      .maybeSingle()
    if (!config) {
      return NextResponse.json({ error: 'Connect a WhatsApp number first.' }, { status: 404 })
    }

    let accessToken: string
    try {
      accessToken = decrypt(config.access_token)
    } catch {
      return NextResponse.json(
        { error: "The saved access token can't be read. Disconnect the number and connect it again." },
        { status: 409 },
      )
    }
    let storedPin: string | null = null
    if (config.registration_pin) {
      try {
        storedPin = decrypt(config.registration_pin)
      } catch {
        storedPin = null
      }
    }

    // Idempotent on Meta's side; a failure here shows up in the
    // diagnostic checks rather than blocking the register attempt.
    let subscribedAppsAt: string | null = null
    if (config.waba_id) {
      try {
        await subscribeWabaToApp({ wabaId: config.waba_id, accessToken })
        subscribedAppsAt = new Date().toISOString()
      } catch (err) {
        console.warn('[whatsapp/register] subscribed_apps failed (non-fatal):', err instanceof Error ? err.message : err)
      }
    }

    const outcome = await registerNumber({
      phoneNumberId: config.phone_number_id,
      wabaId: config.waba_id ?? null,
      accessToken,
      userPin: pin || null,
      storedPin,
    })

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update({
        ...(subscribedAppsAt ? { subscribed_apps_at: subscribedAppsAt } : {}),
        ...(outcome.pin ? { registration_pin: encrypt(outcome.pin) } : {}),
        registered_at: outcome.registeredAt,
        last_registration_error: outcome.error,
        status: outcome.error ? 'disconnected' : 'connected',
        connected_at: outcome.error ? null : (config.connected_at ?? now),
        updated_at: now,
      })
      .eq('account_id', accountId)
    if (updateError) {
      console.error('[whatsapp/register] row update failed:', updateError)
      return NextResponse.json({ error: 'Failed to save the result.' }, { status: 500 })
    }

    return NextResponse.json({
      registered: outcome.registeredAt != null,
      skipped: outcome.skipped,
      needs_pin: outcome.needsPin,
      error: outcome.error,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
