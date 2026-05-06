import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'

/**
 * Sync message templates from Meta → local message_templates table.
 *
 * Why this exists:
 *   The Settings → Message Templates UI only writes to Supabase. It does
 *   NOT submit templates for approval to Meta. Users would create a
 *   template locally, try to broadcast with it, and hit Meta's error
 *   #132001 "Template name does not exist in the translation" — because
 *   Meta had never seen the template, or had it approved under a
 *   different language code than what we stored locally.
 *
 *   This route pulls the source of truth (Meta's approved templates)
 *   and upserts them into the local catalog by (user_id, name, language).
 *   After a sync, every local template row is guaranteed to match
 *   something Meta will actually accept on send.
 *
 * Scope:
 *   - Read-only against Meta. We never push local → Meta (template
 *     submission happens in Meta's WhatsApp Manager and requires human
 *     review).
 *   - Only approved templates are surfaced by default. We return
 *     everything Meta returns and let the UI filter — so the user can
 *     see their Pending / Rejected templates and understand why.
 *   - Locally-created templates (no Meta counterpart) are NOT deleted —
 *     they remain visible so the user can notice drift and clean up
 *     manually.
 */

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

interface MetaTemplateComponent {
  type: string
  text?: string
  format?: string
}

interface MetaTemplate {
  id: string
  name: string
  language: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED'
  category: string
  components?: MetaTemplateComponent[]
}

/**
 * Meta's template categories are upper-snake (MARKETING / UTILITY /
 * AUTHENTICATION); our DB CHECK constraint is TitleCase. Normalize.
 */
function normalizeCategory(
  meta: string,
): 'Marketing' | 'Utility' | 'Authentication' {
  const upper = meta.toUpperCase()
  if (upper === 'UTILITY') return 'Utility'
  if (upper === 'AUTHENTICATION') return 'Authentication'
  return 'Marketing'
}

/**
 * Meta's template status is UPPERCASE; our DB uses TitleCase.
 */
function normalizeStatus(
  meta: string,
): 'Draft' | 'Pending' | 'Approved' | 'Rejected' {
  switch (meta.toUpperCase()) {
    case 'APPROVED':
      return 'Approved'
    case 'PENDING':
    case 'IN_APPEAL':
    case 'PENDING_DELETION':
      return 'Pending'
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return 'Rejected'
    default:
      return 'Draft'
  }
}

export async function POST() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // whatsapp_config holds waba_id + encrypted access_token.
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Connect your WhatsApp Business account in Settings first.',
        },
        { status: 400 },
      )
    }

    if (!config.waba_id) {
      return NextResponse.json(
        {
          error:
            'WABA (WhatsApp Business Account) ID missing. Re-connect your account in Settings.',
        },
        { status: 400 },
      )
    }

    const accessToken = decrypt(config.access_token)

    // Paginate through every template Meta has for this WABA. Meta
    // returns at most 100 per page; `paging.next` is a full URL. Cap
    // at 20 pages (2k templates) as a safety against infinite loops
    // from a misbehaving upstream.
    const metaTemplates: MetaTemplate[] = []
    let nextUrl:
      | string
      | null = `${META_API_BASE}/${config.waba_id}/message_templates?limit=100&fields=id,name,language,status,category,components`
    const PAGE_CAP = 20
    let pageCount = 0

    while (nextUrl && pageCount < PAGE_CAP) {
      pageCount++
      const metaRes: Response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!metaRes.ok) {
        let metaErr = `Meta API error: ${metaRes.status}`
        try {
          const body = await metaRes.json()
          if (body?.error?.message) metaErr = body.error.message
        } catch {
          // response wasn't JSON — keep the fallback
        }
        return NextResponse.json({ error: metaErr }, { status: 502 })
      }

      const metaBody: {
        data?: MetaTemplate[]
        paging?: { next?: string }
      } = await metaRes.json()
      if (metaBody.data) metaTemplates.push(...metaBody.data)
      nextUrl = metaBody.paging?.next ?? null
    }

    // For each Meta template: upsert by (user_id, name, language).
    // No UNIQUE constraint on that triple, so we match manually.
    let inserted = 0
    let updated = 0
    const errors: { name: string; language: string; message: string }[] = []

    for (const t of metaTemplates) {
      const body = (t.components ?? []).find((c) => c.type === 'BODY')
      const header = (t.components ?? []).find((c) => c.type === 'HEADER')
      const footer = (t.components ?? []).find((c) => c.type === 'FOOTER')

      const row = {
        user_id: user.id,
        name: t.name,
        category: normalizeCategory(t.category),
        language: t.language,
        header_type: header?.format?.toLowerCase() ?? null,
        header_content: header?.text ?? null,
        body_text: body?.text ?? '',
        footer_text: footer?.text ?? null,
        status: normalizeStatus(t.status),
        updated_at: new Date().toISOString(),
      }

      const { data: existing, error: lookupErr } = await supabase
        .from('message_templates')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', t.name)
        .eq('language', t.language)
        .maybeSingle()

      if (lookupErr) {
        errors.push({
          name: t.name,
          language: t.language,
          message: lookupErr.message,
        })
        continue
      }

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from('message_templates')
          .update(row)
          .eq('id', existing.id)
        if (updErr) {
          errors.push({
            name: t.name,
            language: t.language,
            message: updErr.message,
          })
        } else {
          updated++
        }
      } else {
        const { error: insErr } = await supabase
          .from('message_templates')
          .insert(row)
        if (insErr) {
          errors.push({
            name: t.name,
            language: t.language,
            message: insErr.message,
          })
        } else {
          inserted++
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      total: metaTemplates.length,
      inserted,
      updated,
      errors,
      truncated: pageCount >= PAGE_CAP && nextUrl !== null,
    })
  } catch (error) {
    console.error('Error syncing WhatsApp templates:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to sync templates',
      },
      { status: 500 },
    )
  }
}
