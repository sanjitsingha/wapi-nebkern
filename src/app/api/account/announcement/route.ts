import { NextResponse } from 'next/server'

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import {
  mapAnnouncementRow,
  type AppAnnouncementRow,
} from '@/lib/app-announcement'

/**
 * GET /api/account/announcement
 *
 * The one live announcement bar to show this account (newest wins). RLS
 * filters to active, in-window, and addressed-to-this-account rows, so
 * this just takes the most recent. Returns { announcement: null } when
 * there's nothing to show.
 */
export async function GET() {
  try {
    const { supabase } = await getCurrentAccount()

    const { data } = await supabase
      .from('app_announcements')
      .select('id, message, link_url, link_label, variant, dismissible')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      announcement: data ? mapAnnouncementRow(data as AppAnnouncementRow) : null,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
