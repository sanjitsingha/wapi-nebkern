import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TemplatePayload } from '@/lib/whatsapp/template-validators'

/**
 * Save a template as a local DRAFT — no Meta submission.
 *
 * Drafts are intentionally lenient: only a name is required so a
 * half-finished template can be parked and resumed later. The row is
 * upserted by (user_id, name, language) so re-saving the same draft
 * updates it in place rather than piling up duplicates.
 *
 * Submitting for approval (DRAFT → PENDING) goes through the sibling
 * /submit endpoint, which runs full validation and the Meta call.
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
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    let payload: TemplatePayload
    try {
      payload = (await request.json()) as TemplatePayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const name = (payload.name || '').trim()
    if (!name) {
      return NextResponse.json(
        { error: 'A template name is required to save a draft.' },
        { status: 400 },
      )
    }

    const row = {
      account_id: accountId,
      user_id: user.id,
      name,
      category: payload.category,
      language: payload.language || 'en_US',
      header_type: payload.header_type ?? null,
      header_content: payload.header_content ?? null,
      header_media_url: payload.header_media_url ?? null,
      header_handle: null,
      body_text: payload.body_text ?? '',
      footer_text: payload.footer_text ?? null,
      buttons: payload.buttons ?? null,
      sample_values: payload.sample_values ?? null,
      status: 'DRAFT',
      meta_template_id: null,
      submission_error: null,
      rejection_reason: null,
    }

    const { data, error } = await supabase
      .from('message_templates')
      .upsert(row, { onConflict: 'user_id,name,language' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error) {
    console.error('Error saving template draft:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to save draft.',
      },
      { status: 500 },
    )
  }
}
