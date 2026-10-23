import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadPlatformAi } from '@/lib/ai/platform'
import {
  ACTIVATION_PROMPT_MAX_CHARS,
  RESPONSE_DELAY,
  SNOOZE,
  parseOperatingHours,
  parseSeconds,
} from '@/lib/ai/reply-settings'
import { DEFAULT_PERSONALITY, PERSONALITIES } from '@/lib/ai/personalities'

// ============================================================
// /api/ai/config — Maya's behaviour for this workspace.
//
// The model and the API key are Dripo's (Admin → AI model,
// lib/ai/platform.ts); accounts never see or set them. What lives here
// is per-account: the master switch, auto-reply, the business context
// prompt, activation rules, timing and hours.
// ============================================================

/** Longest role-and-instructions prompt accepted. */
const SYSTEM_PROMPT_MAX_CHARS = 8000
/** Longest restrictions text accepted. */
const RESTRICTIONS_MAX_CHARS = 4000

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/ai/config
 *
 * Any member may read it, so every page can reflect whether Maya is on.
 * `configured` now means "Dripo's AI is ready" — the one thing an
 * account used to have to do itself — and `semantic_search` whether the
 * platform has an embeddings key (the knowledge base's search mode).
 * Neither reveals anything about the key. A workspace that has never
 * changed a setting has no row and gets the defaults.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const [{ data, error }, platform] = await Promise.all([
      supabase
        .from('ai_configs')
        // '*' so a database without a newer column (114's
        // activation_prompt) still loads.
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle(),
      // A platform key that won't decrypt reads as "not ready" here;
      // the AI routes log the real error when they try to use it.
      loadPlatformAi().catch(() => null),
    ])

    if (error) {
      // Log the Postgres specifics — the bare error object serializes
      // to `{}`. A 42P01 means migration 038 isn't applied.
      console.error(
        `[ai/config GET] fetch error: code=${error.code} message=${error.message} details=${error.details} hint=${error.hint}`,
      )
      return NextResponse.json(
        { error: 'Failed to load AI configuration' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      configured: platform !== null,
      semantic_search: Boolean(platform?.embeddingsApiKey),
      system_prompt: data?.system_prompt ?? null,
      is_active: data?.is_active ?? false,
      auto_reply_enabled: data?.auto_reply_enabled ?? false,
      auto_reply_max_per_conversation: data?.auto_reply_max_per_conversation ?? 3,
      activation_prompt: data?.activation_prompt ?? null,
      // Defaults stand in until migration 114 adds the columns.
      response_delay_seconds:
        parseSeconds(data?.response_delay_seconds, RESPONSE_DELAY) ?? RESPONSE_DELAY.default,
      snooze_seconds: parseSeconds(data?.snooze_seconds, SNOOZE) ?? SNOOZE.default,
      operating_hours: parseOperatingHours(data?.operating_hours),
      personality: PERSONALITIES.some((p) => p.id === data?.personality)
        ? data?.personality
        : DEFAULT_PERSONALITY,
      restrictions: data?.restrictions ?? null,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * PATCH /api/ai/config  (admin+)
 *
 * Change Maya's behaviour. Creates the workspace's row on first use —
 * there is no setup step any more. Any subset of:
 *
 *   is_active          — the master switch (Overview's toggle). Leaves
 *                        auto-reply alone, so switching her back on
 *                        restores exactly what she did before.
 *   auto_reply_enabled — chat activation mode: true answers every chat,
 *                        false only chats assigned to the AI agent.
 *   system_prompt      — Personalization's "Agent role and
 *                        instructions"; '' or null clears it.
 *   personality        — a lib/ai/personalities.ts id.
 *   restrictions       — what she must not do; '' or null clears it.
 *   auto_reply_max_per_conversation — 1–20.
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
    if ('system_prompt' in body) {
      const raw = body.system_prompt
      if (raw !== null && typeof raw !== 'string') return bad('system_prompt must be text')
      const prompt = typeof raw === 'string' ? raw.trim() : ''
      if (prompt.length > SYSTEM_PROMPT_MAX_CHARS) {
        return bad(`Role and instructions can be at most ${SYSTEM_PROMPT_MAX_CHARS} characters.`)
      }
      patch.system_prompt = prompt || null
    }
    if ('personality' in body) {
      if (!PERSONALITIES.some((p) => p.id === body.personality)) {
        return bad('Pick one of the personality types.')
      }
      patch.personality = body.personality
    }
    if ('restrictions' in body) {
      const raw = body.restrictions
      if (raw !== null && typeof raw !== 'string') return bad('restrictions must be text')
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (text.length > RESTRICTIONS_MAX_CHARS) {
        return bad(`Restrictions can be at most ${RESTRICTIONS_MAX_CHARS} characters.`)
      }
      patch.restrictions = text || null
    }
    if ('auto_reply_max_per_conversation' in body) {
      const n = Number(body.auto_reply_max_per_conversation)
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        return bad('Max auto-replies per conversation must be 1–20.')
      }
      patch.auto_reply_max_per_conversation = n
    }
    if (Object.keys(patch).length === 0) return bad('Nothing to change')

    const update = () =>
      supabase
        .from('ai_configs')
        .update(patch)
        .eq('account_id', accountId)
        .select('id')
        .maybeSingle()

    let { data, error } = await update()
    if (!error && !data) {
      // First change for this workspace: create its row.
      const ins = await supabase
        .from('ai_configs')
        .insert({ account_id: accountId, created_by: userId, ...patch })
      // Another tab got there first (account_id is unique) — update it.
      if (ins.error?.code === '23505') ({ data, error } = await update())
      else error = ins.error
    }
    if (error) {
      console.error('[ai/config PATCH] save error:', error)
      return NextResponse.json(
        { error: 'Failed to update AI configuration' },
        { status: 500 },
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
 * Resets Maya's behaviour for this workspace to the defaults (off, no
 * prompts). The model and key are the platform's and untouched.
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
        { error: 'Failed to reset AI configuration' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
