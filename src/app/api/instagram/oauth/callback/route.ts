import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireRole } from '@/lib/auth/account'
import {
  exchangeInstagramLoginCode,
  exchangeForLongLivedInstagramToken,
  getInstagramLoginAccountInfo,
} from '@/lib/instagram/meta-api'
import { encrypt } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { INSTAGRAM_OAUTH_STATE_COOKIE } from '@/lib/instagram/oauth-cookie'
import { oauthTabResponse } from '@/lib/oauth/tab-response'
import { isTabState } from '@/lib/oauth/state'

/**
 * GET /api/instagram/oauth/callback
 *
 * Instagram redirects the browser here after the user logs in and
 * grants (or denies) permissions. This is a top-level navigation back
 * to our own origin, so the caller's normal auth session cookies are
 * present — no separate token needed to know who's connecting.
 *
 * Two endings, decided by the `state` the start route minted: a tab
 * gets a page that postMessages the outcome to its opener and closes; a
 * plain navigation gets a 302 to /settings/instagram with the same
 * values as ?ig_* params. Never JSON — no XHR caller is waiting.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const settingsUrl = new URL('/settings/instagram', url.origin)

  // Attacker-controlled until `state` is checked against the cookie, so
  // it decides nothing beyond the shape of an early "no".
  const tab = isTabState(url.searchParams.get('state') ?? '')

  function finish(params: Record<string, string | null>): NextResponse {
    const res = tab
      ? oauthTabResponse(params)
      : (() => {
          for (const [key, value] of Object.entries(params)) {
            if (value) settingsUrl.searchParams.set(`ig_${key}`, value)
          }
          return NextResponse.redirect(settingsUrl)
        })()
    res.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE)
    return res
  }

  function fail(message: string): NextResponse {
    return finish({ error: message })
  }

  const igError = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (igError) {
    return fail(`Instagram login was not completed: ${igError}`)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return fail('Instagram did not return an authorization code.')
  }

  const cookieState = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${INSTAGRAM_OAUTH_STATE_COOKIE}=`))
    ?.split('=')[1]
  if (!cookieState || cookieState !== state) {
    return fail('Login session expired or was tampered with. Please try connecting again.')
  }

  let accountId: string
  let supabase: SupabaseClient
  try {
    const ctx = await requireRole('admin')
    accountId = ctx.accountId
    supabase = ctx.supabase
  } catch {
    return fail('You must be signed in as an admin to connect Instagram.')
  }

  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appId || !appSecret) {
    return fail('Instagram Login is not configured on this server.')
  }

  try {
    const redirectUri = `${url.origin}/api/instagram/oauth/callback`
    const { accessToken: shortLivedToken } = await exchangeInstagramLoginCode({
      appId,
      appSecret,
      redirectUri,
      code,
    })

    const { accessToken } = await exchangeForLongLivedInstagramToken({
      appSecret,
      shortLivedToken,
    })

    const accountInfo = await getInstagramLoginAccountInfo({ accessToken })
    const igBusinessAccountId = accountInfo.id

    // Reject if another account already claimed this Instagram account
    // — same "one number, one owner" guard as the manual-entry route.
    const { data: claimed, error: claimedError } = await supabaseAdmin()
      .from('instagram_config')
      .select('account_id')
      .eq('instagram_business_account_id', igBusinessAccountId)
      .neq('account_id', accountId)
      .maybeSingle()
    if (claimedError) {
      console.error('[instagram-oauth] ownership check failed:', claimedError)
      return fail('Failed to validate the connection. Please try again.')
    }
    if (claimed) {
      return fail(
        'This Instagram account is already connected to another account on this instance.',
      )
    }

    const encryptedAccessToken = encrypt(accessToken)

    const { data: existing } = await supabase
      .from('instagram_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    const baseRow = {
      page_id: null,
      instagram_business_account_id: igBusinessAccountId,
      access_token: encryptedAccessToken,
      status: 'connected' as const,
      connect_method: 'oauth' as const,
      connected_at: new Date().toISOString(),
      last_verification_error: null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('instagram_config')
        .update(baseRow)
        .eq('account_id', accountId)
      if (updateError) {
        console.error('[instagram-oauth] row update failed:', updateError)
        return fail('Failed to save the connection. Please try again.')
      }
    } else {
      const { error: insertError } = await supabase
        .from('instagram_config')
        .insert({ account_id: accountId, ...baseRow })
      if (insertError) {
        console.error('[instagram-oauth] row insert failed:', insertError)
        return fail('Failed to save the connection. Please try again.')
      }
    }

    return finish({ connected: '1', username: accountInfo.username ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[instagram-oauth] callback failed:', message)
    return fail(message)
  }
}
