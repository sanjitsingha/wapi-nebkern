import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { mapPopupRow, type AppPopupRow } from '@/lib/app-popup'

/**
 * GET /api/account/popup
 *
 * The one live splash popup to show this account (newest wins). RLS
 * filters to active, in-window, and addressed-to-this-account rows, so
 * this just takes the most recent. Returns { popup: null } when there's
 * nothing to show.
 */
export async function GET() {
  try {
    const { supabase } = await getCurrentAccount()

    const { data } = await supabase
      .from('app_popups')
      .select('id, title, body, image_url, youtube_url, link_url, link_label')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      popup: data ? mapPopupRow(data as AppPopupRow) : null,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
