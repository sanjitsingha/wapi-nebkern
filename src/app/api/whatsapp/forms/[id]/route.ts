import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  buildFlowJson,
  deleteFlow,
  deprecateFlow,
  uploadFlowJson,
  FORM_FIELD_TYPES,
  type FormField,
} from '@/lib/whatsapp/forms'

/**
 * Per-form lifecycle endpoint.
 *
 * PATCH  — only while status is DRAFT. Meta locks a Flow's structure
 *          once published (confirmed against Meta's docs — a
 *          published flow can only be deprecated, never edited or
 *          deleted), so this re-generates and re-uploads the Flow
 *          JSON rather than attempting a partial update.
 *
 * DELETE — DRAFT: removed outright, both on Meta and locally. Any
 *          other status: deprecated on Meta (Meta rejects an outright
 *          delete for a published flow) and the local row is kept,
 *          marked DEPRECATED, so past responses stay attributable.
 */

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function validateFields(fields: unknown): FormField[] {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('At least one field is required.')
  }
  const seen = new Set<string>()
  return fields.map((f, i) => {
    if (typeof f !== 'object' || f === null) throw new Error(`Field ${i + 1} is invalid.`)
    const { id, type, label, required, options } = f as Record<string, unknown>
    if (!isNonEmptyString(id) || !/^[a-zA-Z0-9_]+$/.test(id)) {
      throw new Error(`Field ${i + 1} needs a valid id (letters, numbers, underscore only).`)
    }
    if (seen.has(id)) throw new Error(`Field id "${id}" is used more than once.`)
    seen.add(id)
    if (!(FORM_FIELD_TYPES as readonly string[]).includes(type as string)) {
      throw new Error(`Field "${id}" has an unsupported type.`)
    }
    if (!isNonEmptyString(label)) throw new Error(`Field "${id}" needs a label.`)
    const needsOptions = type === 'dropdown' || type === 'radio' || type === 'checkbox'
    let parsedOptions: FormField['options']
    if (needsOptions) {
      if (!Array.isArray(options) || options.length === 0) {
        throw new Error(`Field "${id}" needs at least one option.`)
      }
      parsedOptions = options.map((o, j) => {
        const opt = o as Record<string, unknown>
        if (!isNonEmptyString(opt.id) || !isNonEmptyString(opt.title)) {
          throw new Error(`Option ${j + 1} on field "${id}" needs an id and a title.`)
        }
        return { id: opt.id, title: opt.title }
      })
    }
    return {
      id,
      type: type as FormField['type'],
      label,
      required: Boolean(required),
      options: parsedOptions,
    }
  })
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, accountId } = await requireRole('viewer')
    const { data, error } = await supabase
      .from('whatsapp_forms')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    return NextResponse.json({ form: data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, accountId } = await requireRole('admin')

    const { data: existing, error: fetchError } = await supabase
      .from('whatsapp_forms')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .single()
    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Published forms can’t be edited — create a new form instead.' },
        { status: 400 },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const name = isNonEmptyString((body as Record<string, unknown>).name)
      ? ((body as Record<string, unknown>).name as string)
      : existing.name

    let fields: FormField[]
    try {
      fields = validateFields((body as Record<string, unknown>).fields ?? existing.fields)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid fields.' },
        { status: 400 },
      )
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
    const flowJson = buildFlowJson(name, fields)

    let validationErrors: unknown[]
    try {
      const uploaded = await uploadFlowJson({
        flowId: existing.meta_flow_id,
        accessToken,
        flowJson,
      })
      validationErrors = uploaded.validationErrors
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
    }

    const { data: row, error: updateError } = await supabase
      .from('whatsapp_forms')
      .update({ name, fields, flow_json: flowJson, validation_errors: validationErrors })
      .eq('id', id)
      .select()
      .single()
    if (updateError) {
      console.error('[whatsapp-forms] update error:', updateError)
      return NextResponse.json({ error: 'Failed to save form' }, { status: 500 })
    }

    return NextResponse.json({ form: row })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, accountId } = await requireRole('admin')

    const { data: existing, error: fetchError } = await supabase
      .from('whatsapp_forms')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .single()
    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('access_token')
      .eq('account_id', accountId)
      .maybeSingle()

    if (existing.meta_flow_id && config?.access_token) {
      const accessToken = decrypt(config.access_token)
      try {
        if (existing.status === 'DRAFT') {
          await deleteFlow({ flowId: existing.meta_flow_id, accessToken })
        } else {
          await deprecateFlow({ flowId: existing.meta_flow_id, accessToken })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Meta API error'
        return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
      }
    }

    if (existing.status === 'DRAFT') {
      const { error: deleteError } = await supabase.from('whatsapp_forms').delete().eq('id', id)
      if (deleteError) {
        console.error('[whatsapp-forms] delete error:', deleteError)
        return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 })
      }
    } else {
      const { error: updateError } = await supabase
        .from('whatsapp_forms')
        .update({ status: 'DEPRECATED' })
        .eq('id', id)
      if (updateError) {
        console.error('[whatsapp-forms] deprecate-local error:', updateError)
        return NextResponse.json({ error: 'Failed to update form' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
