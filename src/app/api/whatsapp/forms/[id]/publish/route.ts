import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getFlowStatus, publishFlow } from '@/lib/whatsapp/forms'

/**
 * POST /api/whatsapp/forms/[id]/publish
 *
 * Irreversible on Meta's side — a published flow can no longer be
 * edited, only deprecated (see the DELETE handler in ../route.ts).
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, accountId } = await requireRole('admin')

    const { data: form, error: fetchError } = await supabase
      .from('whatsapp_forms')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .single()
    if (fetchError || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    if (form.status !== 'DRAFT') {
      return NextResponse.json({ error: 'This form has already been published.' }, { status: 400 })
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('access_token')
      .eq('account_id', accountId)
      .maybeSingle()
    if (configError || !config) {
      return NextResponse.json({ error: 'WhatsApp is not connected.' }, { status: 400 })
    }
    const accessToken = decrypt(config.access_token)

    try {
      await publishFlow({ flowId: form.meta_flow_id, accessToken })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
    }

    // Re-read status from Meta rather than assume PUBLISHED — a
    // publish call can succeed but leave the flow in a state Meta
    // still wants a beat to settle (its validation is not always
    // synchronous with the publish response).
    let status: string = 'PUBLISHED'
    let validationErrors: unknown[] = []
    try {
      const fresh = await getFlowStatus({ flowId: form.meta_flow_id, accessToken })
      status = fresh.status
      validationErrors = fresh.validationErrors
    } catch {
      // Publish itself succeeded; a follow-up status read failing is
      // not worth failing the whole request over.
    }

    const { data: row, error: updateError } = await supabase
      .from('whatsapp_forms')
      .update({ status, validation_errors: validationErrors })
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      console.error('[whatsapp-forms] publish update error:', updateError)
      return NextResponse.json({ error: 'Published on Meta but failed to update locally' }, { status: 500 })
    }

    return NextResponse.json({ form: row })
  } catch (err) {
    return toErrorResponse(err)
  }
}
