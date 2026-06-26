import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  exchangeEmbeddedSignupCode,
  getWabaInfo,
  getWabaPhoneNumbers,
  verifyPhoneNumber,
  registerPhoneNumber,
  subscribeWabaToApp,
} from '@/lib/whatsapp/meta-api'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

/**
 * POST /api/whatsapp/embedded-signup
 *
 * Completes Meta Embedded Signup onboarding for the caller's account.
 * The browser (see EmbeddedSignupButton) runs FB.login against our
 * Embedded Signup configuration and posts the resulting authorization
 * `code` here, together with the `waba_id` / `phone_number_id` Meta's
 * sessionInfo event reported. This route runs the full server-side
 * sequence:
 *
 *   Receive authorization code
 *     ↓
 *   Exchange code → business system-user access token
 *     ↓
 *   Retrieve WhatsApp Business Account (business) info  (verifies token)
 *     ↓
 *   Resolve / confirm the Phone Number ID
 *     ↓
 *   Subscribe the WABA to this app   (POST /{waba_id}/subscribed_apps)
 *     ↓
 *   Register the phone number          (POST /{phone_number_id}/register)
 *     — this is the step that moves the number from "Pending" to
 *       "Connected" in Cloud API; it also SETS the 2-step PIN
 *     ↓
 *   Verify the number reports as live
 *     ↓
 *   Persist all IDs + encrypted credentials, mark registered
 *
 * Every Meta call is logged (with secrets redacted) by the `metaFetch`
 * wrapper in lib/whatsapp/meta-api.ts.
 */

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

// Service-role client: needed to detect a phone_number_id already
// claimed by a *different* account (RLS hides other accounts' rows).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

/** Meta 2-step PINs are 6 digits. Generate one for fresh registrations. */
function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

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

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret) {
      return NextResponse.json(
        {
          error:
            'Embedded Signup is not configured on this server. Set META_APP_ID and META_APP_SECRET (Meta for Developers → App Settings → Basic) and restart.',
        },
        { status: 503 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const {
      code,
      waba_id,
      phone_number_id: phoneNumberIdFromClient,
      verify_token,
    } = body as {
      code?: string
      waba_id?: string
      phone_number_id?: string
      verify_token?: string
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code from Embedded Signup.' },
        { status: 400 },
      )
    }
    if (!waba_id) {
      return NextResponse.json(
        {
          error:
            'Missing WhatsApp Business Account id from Embedded Signup. Re-run the connect flow and grant all requested permissions.',
        },
        { status: 400 },
      )
    }

    // ----- Step 1: exchange the code for a business access token -----
    let accessToken: string
    try {
      const exchanged = await exchangeEmbeddedSignupCode({ code, appId, appSecret })
      accessToken = exchanged.accessToken
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('[embedded-signup] code exchange failed:', message)
      return NextResponse.json(
        { error: `Could not exchange the authorization code: ${message}` },
        { status: 400 },
      )
    }

    // ----- Step 2: confirm the token can see the reported WABA -----
    try {
      await getWabaInfo({ wabaId: waba_id, accessToken })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('[embedded-signup] WABA lookup failed:', message)
      return NextResponse.json(
        { error: `Could not read the WhatsApp Business Account: ${message}` },
        { status: 400 },
      )
    }

    // ----- Step 3: resolve / confirm the Phone Number ID -----
    let phoneNumberId = phoneNumberIdFromClient?.trim() || ''
    try {
      const numbers = await getWabaPhoneNumbers({ wabaId: waba_id, accessToken })
      if (phoneNumberId) {
        // Trust-but-verify: make sure the reported id is actually under
        // this WABA. If not, fall back to the first number.
        if (!numbers.some((n) => n.id === phoneNumberId)) {
          console.warn(
            `[embedded-signup] reported phone_number_id ${phoneNumberId} not found under WABA ${waba_id}; falling back to first listed number`,
          )
          phoneNumberId = numbers[0]?.id ?? ''
        }
      } else {
        phoneNumberId = numbers[0]?.id ?? ''
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('[embedded-signup] phone number lookup failed:', message)
      return NextResponse.json(
        { error: `Could not list phone numbers for the WABA: ${message}` },
        { status: 400 },
      )
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        {
          error:
            'No phone number found under the WhatsApp Business Account. Add a phone number in the Embedded Signup dialog and try again.',
        },
        { status: 400 },
      )
    }

    // ----- Claim check: number not already bound to another account -----
    const { data: claimed, error: claimedError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('account_id')
      .eq('phone_number_id', phoneNumberId)
      .neq('account_id', accountId)
      .maybeSingle()
    if (claimedError) {
      console.error('[embedded-signup] ownership check failed:', claimedError)
      return NextResponse.json(
        { error: 'Failed to validate configuration.' },
        { status: 500 },
      )
    }
    if (claimed) {
      return NextResponse.json(
        {
          error:
            'This WhatsApp phone number is already linked to another account on this instance. Each phone number can only be connected once.',
        },
        { status: 409 },
      )
    }

    // ----- Step 4: subscribe the WABA to this app (idempotent) -----
    let subscribedAppsAt: string | null = null
    try {
      await subscribeWabaToApp({ wabaId: waba_id, accessToken })
      subscribedAppsAt = new Date().toISOString()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[embedded-signup] subscribed_apps failed:', message)
      return NextResponse.json(
        { error: `Could not subscribe the WABA to this app: ${message}` },
        { status: 400 },
      )
    }

    // ----- Step 5: register the phone number (Pending → Connected) ----
    // This is the step that was missing end-to-end before: it activates
    // the number in Cloud API and sets its 2-step PIN. We reuse any PIN
    // already stored for this account (Meta rejects changing it), else
    // generate a fresh one.
    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id, registration_pin')
      .eq('account_id', accountId)
      .maybeSingle()

    let pin: string
    if (existing?.registration_pin) {
      try {
        pin = decrypt(existing.registration_pin)
      } catch {
        pin = generatePin()
      }
    } else {
      pin = generatePin()
    }

    let registeredAt: string | null = null
    let registrationError: string | null = null
    try {
      await registerPhoneNumber({ phoneNumberId, accessToken, pin })
      registeredAt = new Date().toISOString()
    } catch (err) {
      registrationError = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('[embedded-signup] /register failed:', registrationError)
    }

    // ----- Step 6: verify the number reports back -----
    let phoneInfo
    try {
      phoneInfo = await verifyPhoneNumber({ phoneNumberId, accessToken })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[embedded-signup] post-register verify failed (non-fatal):', message)
    }

    // ----- Step 7: persist everything -----
    let encryptedAccessToken: string
    let encryptedVerifyToken: string | null
    let encryptedPin: string
    try {
      encryptedAccessToken = encrypt(accessToken)
      encryptedVerifyToken = verify_token ? encrypt(verify_token) : null
      encryptedPin = encrypt(pin)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown encryption error'
      console.error('[embedded-signup] encryption failed:', message)
      return NextResponse.json(
        {
          error:
            'Failed to encrypt credentials. Check ENCRYPTION_KEY is a valid 64-character hex string.',
        },
        { status: 500 },
      )
    }

    const baseRow = {
      phone_number_id: phoneNumberId,
      waba_id,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      registration_pin: encryptedPin,
      status: registrationError ? 'disconnected' : 'connected',
      connected_at: registrationError ? null : new Date().toISOString(),
      registered_at: registeredAt,
      subscribed_apps_at: subscribedAppsAt,
      last_registration_error: registrationError,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('whatsapp_config')
        .update(baseRow)
        .eq('account_id', accountId)
      if (updateError) {
        console.error('[embedded-signup] row update failed:', updateError)
        return NextResponse.json(
          { error: 'Failed to save configuration.' },
          { status: 500 },
        )
      }
    } else {
      const { error: insertError } = await supabase
        .from('whatsapp_config')
        .insert({ account_id: accountId, user_id: user.id, ...baseRow })
      if (insertError) {
        console.error('[embedded-signup] row insert failed:', insertError)
        return NextResponse.json(
          { error: 'Failed to save configuration.' },
          { status: 500 },
        )
      }
    }

    if (registrationError) {
      return NextResponse.json({
        success: false,
        saved: true,
        registered: false,
        registration_error: registrationError,
        phone_number_id: phoneNumberId,
        waba_id,
        phone_info: phoneInfo,
      })
    }

    return NextResponse.json({
      success: true,
      saved: true,
      registered: true,
      phone_number_id: phoneNumberId,
      waba_id,
      phone_info: phoneInfo,
    })
  } catch (error) {
    console.error('[embedded-signup] unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
