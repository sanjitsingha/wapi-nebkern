/**
 * WhatsApp Forms — wacrm's authoring layer over Meta's native
 * WhatsApp Flows product.
 *
 * Named "Forms" everywhere in this codebase (types, routes, UI) to
 * avoid colliding with the unrelated Flows bot-builder feature
 * (src/lib/flows/*) that already owns that name in this product. Each
 * wacrm Form maps 1:1 to one Meta Flow object.
 *
 * Deliberately STATIC-only: every generated Flow is a single screen —
 * a set of input fields plus a submit button — with no `endpoint_uri`
 * and no data-exchange round trip. Dynamic (multi-screen, live-data)
 * flows need a public endpoint implementing Meta's Flow encryption
 * protocol (RSA key exchange + per-request AES-GCM); genuinely more
 * infrastructure than this first pass takes on. Revisit if a form
 * ever needs to show live data mid-flow (e.g. real appointment slots)
 * rather than just collecting answers.
 *
 * Kept self-contained (own fetch/error-handling, not imported from
 * meta-api.ts) — this mirrors how src/lib/messenger/meta-api.ts and
 * src/lib/instagram/meta-api.ts each keep their own copy rather than
 * sharing one; verified against Meta's docs at build time, so pin the
 * API version here explicitly rather than inherit silently.
 */

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

/** Every screen a Form generates uses this fixed id — a Form is
 *  always exactly one screen, so there is never a second id to
 *  collide with. Referenced again by `sendFlowMessage`'s
 *  `flow_action_payload.screen`. */
const SCREEN_ID = 'FORM'

export const FLOW_CATEGORIES = [
  'SIGN_UP',
  'SIGN_IN',
  'APPOINTMENT_BOOKING',
  'LEAD_GENERATION',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER',
] as const
export type FlowCategory = (typeof FLOW_CATEGORIES)[number]

export const FORM_FIELD_TYPES = [
  'short_text',
  'email',
  'phone',
  'number',
  'long_text',
  'dropdown',
  'radio',
  'checkbox',
  'date',
  'opt_in',
] as const
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export interface FormFieldOption {
  id: string
  title: string
}

export interface FormField {
  /** Stable id — becomes the Flow JSON component `name` and the key
   *  in the customer's submitted answers, so renaming a field's
   *  label later never disturbs previously-collected data. */
  id: string
  type: FormFieldType
  label: string
  required: boolean
  /** Only meaningful for dropdown / radio / checkbox. */
  options?: FormFieldOption[]
}

/** Meta's own Flow status values, verbatim — written straight from
 *  Meta's response rather than mapped through a local enum. */
export type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED' | 'THROTTLED'

interface MetaErrorResponse {
  error?: {
    message?: string
    error_user_title?: string
    error_user_msg?: string
    error_subcode?: number
  }
}

async function throwMetaError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as MetaErrorResponse
    const err = data.error
    if (err) {
      const parts = [err.error_user_title, err.error_user_msg, err.message].filter(
        (s): s is string => Boolean(s && s.trim()),
      )
      if (parts.length > 0) message = parts.join(' — ')
      if (err.error_subcode) message += ` [subcode ${err.error_subcode}]`
    }
  } catch {
    // body wasn't JSON — keep the fallback
  }
  throw new Error(message)
}

function redactSecret(value: string): string {
  if (!value) return value
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}…${value.slice(-2)}`
}

function redactUrl(url: string): string {
  return url.replace(/(access_token)=([^&]+)/gi, (_m, key, val) =>
    `${key}=${redactSecret(decodeURIComponent(val))}`,
  )
}

async function metaFetch(url: string, init: RequestInit | undefined, op: string): Promise<Response> {
  const started = Date.now()
  const method = init?.method ?? 'GET'
  console.info(`[whatsapp-forms:${op}] → ${method} ${redactUrl(url)}`)
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    console.error(
      `[whatsapp-forms:${op}] ✗ network error after ${Date.now() - started}ms:`,
      err instanceof Error ? err.message : err,
    )
    throw err
  }
  console.info(`[whatsapp-forms:${op}] ← ${response.status} in ${Date.now() - started}ms`)
  return response
}

// ============================================================
// Flow JSON generation
// ============================================================

function fieldToComponent(field: FormField): Record<string, unknown> {
  const base = { name: field.id, label: field.label, required: field.required }
  switch (field.type) {
    case 'short_text':
      return { type: 'TextInput', 'input-type': 'text', ...base }
    case 'email':
      return { type: 'TextInput', 'input-type': 'email', ...base }
    case 'phone':
      return { type: 'TextInput', 'input-type': 'phone', ...base }
    case 'number':
      return { type: 'TextInput', 'input-type': 'number', ...base }
    case 'long_text':
      return { type: 'TextArea', ...base }
    case 'dropdown':
      return { type: 'Dropdown', 'data-source': field.options ?? [], ...base }
    case 'radio':
      return { type: 'RadioButtonsGroup', 'data-source': field.options ?? [], ...base }
    case 'checkbox':
      return { type: 'CheckboxGroup', 'data-source': field.options ?? [], ...base }
    case 'date':
      return { type: 'DatePicker', ...base }
    case 'opt_in':
      return { type: 'OptIn', ...base }
  }
}

/**
 * Build the Meta Flow JSON for a static, single-screen form.
 *
 * Structure verified against developers.facebook.com/docs/whatsapp/flows
 * at implementation time: each screen carries a `layout` of type
 * `SingleColumnLayout`; the `Form` and the `Footer` are SIBLINGS
 * inside `layout.children` (the Footer is not nested inside the
 * Form) — Meta associates the Footer's `complete` action with the
 * nearest preceding Form via the `${form.<field>}` references in its
 * payload.
 */
export function buildFlowJson(formName: string, fields: FormField[]): Record<string, unknown> {
  const payload: Record<string, string> = {}
  for (const f of fields) payload[f.id] = `\${form.${f.id}}`

  return {
    version: '3.1',
    screens: [
      {
        id: SCREEN_ID,
        title: formName,
        terminal: true,
        success: true,
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'form',
              children: fields.map(fieldToComponent),
            },
            {
              type: 'Footer',
              label: 'Submit',
              'on-click-action': {
                name: 'complete',
                payload,
              },
            },
          ],
        },
      },
    ],
  }
}

// ============================================================
// Meta Flow lifecycle — create / upload / publish / deprecate / read
// ============================================================

export interface CreateFlowResult {
  flowId: string
  validationErrors: unknown[]
}

/** Step 1 — register a new (empty) Flow against the WABA. */
export async function createFlow(args: {
  wabaId: string
  accessToken: string
  name: string
  categories: FlowCategory[]
}): Promise<CreateFlowResult> {
  const { wabaId, accessToken, name, categories } = args
  const response = await metaFetch(
    `${META_API_BASE}/${wabaId}/flows`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, categories }),
    },
    'createFlow',
  )
  if (!response.ok) {
    await throwMetaError(response, `Failed to create flow: ${response.status}`)
  }
  const data = await response.json()
  return { flowId: String(data.id), validationErrors: data.validation_errors ?? [] }
}

/** Step 2 — upload (or re-upload) the generated Flow JSON as the
 *  flow's asset. Multipart per Meta's spec: a `file` part named
 *  literally "flow.json", `asset_type=FLOW_JSON`. */
export async function uploadFlowJson(args: {
  flowId: string
  accessToken: string
  flowJson: Record<string, unknown>
}): Promise<{ validationErrors: unknown[] }> {
  const { flowId, accessToken, flowJson } = args
  const form = new FormData()
  form.append('asset_type', 'FLOW_JSON')
  form.append('name', 'flow.json')
  form.append('file', new Blob([JSON.stringify(flowJson)], { type: 'application/json' }), 'flow.json')

  const response = await metaFetch(
    `${META_API_BASE}/${flowId}/assets`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
    'uploadFlowJson',
  )
  if (!response.ok) {
    await throwMetaError(response, `Failed to upload flow JSON: ${response.status}`)
  }
  const data = await response.json()
  return { validationErrors: data.validation_errors ?? [] }
}

/** Step 3 — publish. Irreversible: a published Flow's structure
 *  (screens/fields) can no longer be changed, only deprecated. */
export async function publishFlow(args: { flowId: string; accessToken: string }): Promise<void> {
  const { flowId, accessToken } = args
  const response = await metaFetch(
    `${META_API_BASE}/${flowId}/publish`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    'publishFlow',
  )
  if (!response.ok) {
    await throwMetaError(response, `Failed to publish flow: ${response.status}`)
  }
}

/** Remove a flow outright — only Meta-side DRAFT flows support this;
 *  a published flow rejects it and must go through `deprecateFlow`
 *  instead. */
export async function deleteFlow(args: { flowId: string; accessToken: string }): Promise<void> {
  const { flowId, accessToken } = args
  const response = await metaFetch(
    `${META_API_BASE}/${flowId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    'deleteFlow',
  )
  if (!response.ok) {
    await throwMetaError(response, `Failed to delete flow: ${response.status}`)
  }
}

/** Retire a flow — it can no longer be sent, but past responses and
 *  the flow record itself remain intact on Meta's side. */
export async function deprecateFlow(args: { flowId: string; accessToken: string }): Promise<void> {
  const { flowId, accessToken } = args
  const response = await metaFetch(
    `${META_API_BASE}/${flowId}/deprecate`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    'deprecateFlow',
  )
  if (!response.ok) {
    await throwMetaError(response, `Failed to deprecate flow: ${response.status}`)
  }
}

/** Poll current status + validation errors — Meta's own validation
 *  can lag slightly behind the upload call returning, so callers
 *  refreshing a form's state should re-fetch this rather than trust
 *  only the upload response. */
export async function getFlowStatus(args: {
  flowId: string
  accessToken: string
}): Promise<{ status: FlowStatus; validationErrors: unknown[] }> {
  const { flowId, accessToken } = args
  const response = await metaFetch(
    `${META_API_BASE}/${flowId}?fields=status,validation_errors`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    'getFlowStatus',
  )
  if (!response.ok) {
    await throwMetaError(response, `Failed to read flow status: ${response.status}`)
  }
  const data = await response.json()
  return { status: data.status as FlowStatus, validationErrors: data.validation_errors ?? [] }
}

// ============================================================
// Sending a published Form to a customer
// ============================================================

export interface SendFlowResult {
  messageId: string
  flowToken: string
}

/** Send a published Form as an interactive Flow message. `flowToken`
 *  is generated fresh per send (not reused across recipients) — it's
 *  an opaque correlation id Meta echoes back unchanged in the
 *  `nfm_reply` completion webhook. */
export async function sendFlowMessage(args: {
  phoneNumberId: string
  accessToken: string
  recipientPhone: string
  flowId: string
  headerText?: string
  bodyText: string
  footerText?: string
  ctaText: string
}): Promise<SendFlowResult> {
  const { phoneNumberId, accessToken, recipientPhone, flowId, headerText, bodyText, footerText, ctaText } =
    args
  const flowToken = crypto.randomUUID()

  const interactive: Record<string, unknown> = {
    type: 'flow',
    body: { text: bodyText },
    action: {
      name: 'flow',
      parameters: {
        flow_message_version: '3',
        flow_token: flowToken,
        flow_id: flowId,
        flow_cta: ctaText,
        flow_action: 'navigate',
        flow_action_payload: { screen: SCREEN_ID },
      },
    },
  }
  if (headerText) interactive.header = { type: 'text', text: headerText }
  if (footerText) interactive.footer = { text: footerText }

  const response = await metaFetch(
    `${META_API_BASE}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'interactive',
        interactive,
      }),
    },
    'sendFlowMessage',
  )
  if (!response.ok) {
    await throwMetaError(response, `Failed to send form: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: String(data.messages?.[0]?.id), flowToken }
}

// ============================================================
// Parsing the completion webhook
// ============================================================

export interface FlowCompletion {
  flowToken: string
  /** Every other key the customer submitted, field id → value. */
  answers: Record<string, unknown>
}

/**
 * Meta's `nfm_reply.response_json` is documented as a JSON-encoded
 * STRING (not a nested object) in the raw webhook payload — parse
 * defensively since some intermediaries/test payloads deliver it
 * already parsed.
 */
export function parseFlowCompletion(nfmReply: { response_json: unknown }): FlowCompletion | null {
  const raw = nfmReply.response_json
  const parsed: Record<string, unknown> =
    typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>) ?? {}

  const { flow_token, ...answers } = parsed
  if (typeof flow_token !== 'string') return null
  return { flowToken: flow_token, answers }
}
