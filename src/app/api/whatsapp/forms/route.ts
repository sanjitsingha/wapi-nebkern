import { NextResponse } from 'next/server'

import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  buildFlowJson,
  createFlow,
  uploadFlowJson,
  FLOW_CATEGORIES,
  FORM_FIELD_TYPES,
  type FlowCategory,
  type FormField,
} from '@/lib/whatsapp/forms'

/**
 * GET/POST /api/whatsapp/forms
 *
 * "Forms" in the product = native WhatsApp Flows under the hood — see
 * src/lib/whatsapp/forms.ts for why the name differs from Meta's own.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase
      .from('whatsapp_forms')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[whatsapp-forms] list error:', error)
      return NextResponse.json({ error: 'Failed to load forms' }, { status: 500 })
    }
    return NextResponse.json({ forms: data ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

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

/**
 * Create a Form as a Meta DRAFT flow: register it, generate + upload
 * the Flow JSON, then store the local row. Publishing is a separate,
 * explicit step (POST .../publish) — a draft can still be edited and
 * re-uploaded; a published one cannot.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { name, categories } = body as Record<string, unknown>
    if (!isNonEmptyString(name)) {
      return NextResponse.json({ error: 'Form name is required.' }, { status: 400 })
    }
    const categoryList = Array.isArray(categories) && categories.length > 0 ? categories : ['OTHER']
    for (const c of categoryList) {
      if (!(FLOW_CATEGORIES as readonly string[]).includes(c as string)) {
        return NextResponse.json({ error: `Unknown category "${c}".` }, { status: 400 })
      }
    }

    let fields: FormField[]
    try {
      fields = validateFields((body as Record<string, unknown>).fields)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid fields.' },
        { status: 400 },
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('waba_id, access_token')
      .eq('account_id', accountId)
      .maybeSingle()
    if (configError || !config?.waba_id) {
      return NextResponse.json(
        { error: 'Connect WhatsApp in Settings before creating a form.' },
        { status: 400 },
      )
    }

    const accessToken = decrypt(config.access_token)
    const flowJson = buildFlowJson(name, fields)

    let metaFlowId: string
    let validationErrors: unknown[]
    try {
      const created = await createFlow({
        wabaId: config.waba_id,
        accessToken,
        name,
        categories: categoryList as FlowCategory[],
      })
      metaFlowId = created.flowId
      const uploaded = await uploadFlowJson({ flowId: metaFlowId, accessToken, flowJson })
      validationErrors = uploaded.validationErrors
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
    }

    const { data: row, error: insertError } = await supabase
      .from('whatsapp_forms')
      .insert({
        account_id: accountId,
        created_by: userId,
        name,
        categories: categoryList,
        fields,
        flow_json: flowJson,
        meta_flow_id: metaFlowId,
        status: 'DRAFT',
        validation_errors: validationErrors,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[whatsapp-forms] insert error:', insertError)
      return NextResponse.json(
        { error: 'Form was created on Meta but failed to save locally. Contact support with this id: ' + metaFlowId },
        { status: 500 },
      )
    }

    return NextResponse.json({ form: row })
  } catch (err) {
    return toErrorResponse(err)
  }
}
