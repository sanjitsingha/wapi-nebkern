import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { validateAiCredentials } from '@/lib/ai/validate'
import { embedTexts } from '@/lib/ai/embeddings'
import { AiError, type AiProvider } from '@/lib/ai/types'
import {
  ACTIVATION_PROMPT_MAX_CHARS,
  RESPONSE_DELAY,
  SNOOZE,
  parseOperatingHours,
  parseSeconds,
} from '@/lib/ai/reply-settings'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/ai/config
 *
 * Any member may read the config so the inbox/agents page can reflect
 * whether AI is set up. The encrypted key is NEVER returned — only a
 * `has_key` flag; the setup form shows a masked placeholder.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data, error } = await supabase
      .from('ai_configs')
      // '*' so a database without a newer column (114's
      // activation_prompt) still loads. Only the fields below are
      // returned; the keys only derive the has_* flags.
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (error) {
      // Log the Postgres specifics (code/message/hint) — the bare error
      // object serializes to `{}`. A 42P01 (undefined_table) means
      // migration 038 isn't applied; a 42703 (undefined_column) on
      // embeddings_api_key means 040 isn't applied.
      console.error(
        `[ai/config GET] fetch error: code=${error.code} message=${error.message} details=${error.details} hint=${error.hint}`,
      )
      return NextResponse.json(
        { error: 'Failed to load AI configuration' },
        { status: 500 },
      )
    }

    if (!data) return NextResponse.json({ configured: false })
    return NextResponse.json({
      configured: true,
      has_key: !!data.api_key,
      has_embeddings_key: !!data.embeddings_api_key,
      provider: data.provider,
      model: data.model,
      system_prompt: data.system_prompt,
      is_active: data.is_active,
      auto_reply_enabled: data.auto_reply_enabled,
      auto_reply_max_per_conversation: data.auto_reply_max_per_conversation,
      activation_prompt: data.activation_prompt ?? null,
      // Defaults stand in until migration 114 adds the columns.
      response_delay_seconds:
        parseSeconds(data.response_delay_seconds, RESPONSE_DELAY) ?? RESPONSE_DELAY.default,
      snooze_seconds: parseSeconds(data.snooze_seconds, SNOOZE) ?? SNOOZE.default,
      operating_hours: parseOperatingHours(data.operating_hours),
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/config  (admin+)
 *
 * Upsert the account's AI config. Validates the key with the provider
 * before persisting (mirrors the WhatsApp config verifying with Meta
 * first), then stores the key AES-256-GCM-encrypted. When `api_key` is
 * omitted the existing stored key is reused (the form sends it only
 * when the user re-enters it).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`ai-config:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const provider = body.provider as AiProvider
    if (
      provider !== 'openai' &&
      provider !== 'anthropic' &&
      provider !== 'openrouter'
    ) {
      return bad('provider must be "openai", "anthropic", or "openrouter"')
    }
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    if (!model) return bad('model is required')

    const systemPrompt =
      typeof body.system_prompt === 'string' && body.system_prompt.trim()
        ? body.system_prompt.trim()
        : null
    const isActive = body.is_active === true
    const autoReplyEnabled = body.auto_reply_enabled === true

    let maxPer = Number(body.auto_reply_max_per_conversation)
    if (!Number.isFinite(maxPer)) maxPer = 3
    maxPer = Math.min(20, Math.max(1, Math.floor(maxPer)))

    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''

    // Embeddings key (optional, for semantic KB search): a non-empty
    // string sets/replaces it; an explicit null clears it; absent leaves
    // it unchanged. The form only sends it when the admin edits it.
    const rawEmbeddingsKey =
      typeof body.embeddings_api_key === 'string'
        ? body.embeddings_api_key.trim()
        : ''
    const clearEmbeddingsKey = body.embeddings_api_key === null

    // Reuse the stored key when the form didn't send a fresh one.
    const { data: existing } = await supabase
      .from('ai_configs')
      .select('id, provider, model, api_key')
      .eq('account_id', accountId)
      .maybeSingle()

    let apiKeyPlain: string
    if (rawKey) {
      apiKeyPlain = rawKey
    } else if (existing?.api_key) {
      try {
        apiKeyPlain = decrypt(existing.api_key)
      } catch {
        return bad('Stored API key could not be decrypted — re-enter your key.')
      }
    } else {
      return bad('api_key is required')
    }

    // Only spend a provider round-trip when the credentials that affect
    // reachability actually changed. A save that just flips a toggle or
    // edits the system prompt on an existing, already-validated config
    // skips the call — no wasted token/latency on the account's key.
    const credentialsChanged =
      !existing ||
      rawKey !== '' ||
      provider !== existing.provider ||
      model !== existing.model

    if (credentialsChanged) {
      try {
        await validateAiCredentials({
          provider,
          model,
          apiKey: apiKeyPlain,
          systemPrompt,
          isActive,
          autoReplyEnabled,
          autoReplyMaxPerConversation: maxPer,
          embeddingsApiKey: null,
        })
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] validation error:', err)
        return bad('Could not validate the API key with the provider.')
      }
    }

    // Validate a new embeddings key before storing (a cheap 1-input
    // embed), same "verify before save" discipline as the chat key.
    if (rawEmbeddingsKey) {
      try {
        await embedTexts(rawEmbeddingsKey, ['ping'])
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: `Embeddings key: ${err.message}`, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] embeddings validation error:', err)
        return bad('Could not validate the embeddings key.')
      }
    }

    const encryptedKey = rawKey ? encrypt(rawKey) : null
    const shared: Record<string, unknown> = {
      provider,
      model,
      system_prompt: systemPrompt,
      is_active: isActive,
      auto_reply_enabled: autoReplyEnabled,
      auto_reply_max_per_conversation: maxPer,
    }
    if (rawEmbeddingsKey) {
      shared.embeddings_api_key = encrypt(rawEmbeddingsKey)
    } else if (clearEmbeddingsKey) {
      shared.embeddings_api_key = null
    }

    if (existing) {
      const { error: upErr } = await supabase
        .from('ai_configs')
        .update(encryptedKey ? { ...shared, api_key: encryptedKey } : shared)
        .eq('account_id', accountId)
      if (upErr) {
        console.error('[ai/config POST] update error:', upErr)
        return NextResponse.json(
          { error: 'Failed to save AI configuration' },
          { status: 500 },
        )
      }
    } else {
      const { error: insErr } = await supabase.from('ai_configs').insert({
        account_id: accountId,
        created_by: userId,
        api_key: encryptedKey, // guaranteed non-null: rawKey required when no existing row
        ...shared,
      })
      if (insErr) {
        console.error('[ai/config POST] insert error:', insErr)
        return NextResponse.json(
          { error: 'Failed to save AI configuration' },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * PATCH /api/ai/config  (admin+)
 *
 * Change Maya's behaviour without re-sending her credentials — the
 * full POST would re-send provider, model and key. Any subset of:
 *
 *   is_active          — the master switch (Overview's toggle). Leaves
 *                        auto-reply alone, so switching her back on
 *                        restores exactly what she did before.
 *   auto_reply_enabled — chat activation mode: true answers every chat,
 *                        false only chats assigned to the AI agent.
 *   activation_prompt  — the activation rules; '' or null clears them.
 *   response_delay_seconds, snooze_seconds — operational timing, whole
 *                        seconds within RESPONSE_DELAY / SNOOZE.
 *   operating_hours    — {enabled, timezone, days}; null clears it.
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`ai-config:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const patch: Record<string, unknown> = {}
    if ('is_active' in body) {
      if (typeof body.is_active !== 'boolean') return bad('is_active must be true or false')
      patch.is_active = body.is_active
    }
    if ('auto_reply_enabled' in body) {
      if (typeof body.auto_reply_enabled !== 'boolean') {
        return bad('auto_reply_enabled must be true or false')
      }
      patch.auto_reply_enabled = body.auto_reply_enabled
    }
    if ('activation_prompt' in body) {
      const raw = body.activation_prompt
      if (raw !== null && typeof raw !== 'string') return bad('activation_prompt must be text')
      const rules = typeof raw === 'string' ? raw.trim() : ''
      if (rules.length > ACTIVATION_PROMPT_MAX_CHARS) {
        return bad(`Activation rules can be at most ${ACTIVATION_PROMPT_MAX_CHARS} characters.`)
      }
      patch.activation_prompt = rules || null
    }
    if ('response_delay_seconds' in body) {
      const seconds = parseSeconds(body.response_delay_seconds, RESPONSE_DELAY)
      if (seconds === null) {
        return bad(`Response delay must be ${RESPONSE_DELAY.min}–${RESPONSE_DELAY.max} seconds.`)
      }
      patch.response_delay_seconds = seconds
    }
    if ('snooze_seconds' in body) {
      const seconds = parseSeconds(body.snooze_seconds, SNOOZE)
      if (seconds === null) {
        return bad(`Snooze duration must be ${SNOOZE.min}–${SNOOZE.max} seconds.`)
      }
      patch.snooze_seconds = seconds
    }
    if ('operating_hours' in body) {
      if (body.operating_hours === null) {
        patch.operating_hours = null
      } else {
        const hours = parseOperatingHours(body.operating_hours)
        if (!hours) {
          return bad('Operating hours need a valid timezone, and each open day an end time after its start.')
        }
        patch.operating_hours = hours
      }
    }
    if (Object.keys(patch).length === 0) return bad('Nothing to change')

    const { data, error } = await supabase
      .from('ai_configs')
      .update(patch)
      .eq('account_id', accountId)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[ai/config PATCH] update error:', error)
      return NextResponse.json(
        { error: 'Failed to update AI configuration' },
        { status: 500 },
      )
    }
    if (!data) {
      return NextResponse.json(
        { error: 'Set up Maya first — connect a model provider.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/config  (admin+)
 *
 * Removes the account's AI config (turns everything off and forgets the
 * key). Also used to recover from a corrupted encrypted key.
 */
export async function DELETE() {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const { error } = await supabase
      .from('ai_configs')
      .delete()
      .eq('account_id', accountId)
    if (error) {
      console.error('[ai/config DELETE] error:', error)
      return NextResponse.json(
        { error: 'Failed to delete AI configuration' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
