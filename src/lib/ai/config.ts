import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiConfig } from './types'
import { loadPlatformAi } from './platform'
import { DEFAULT_PERSONALITY, PERSONALITIES, type PersonalityId } from './personalities'
import {
  RESPONSE_DELAY,
  SNOOZE,
  parseOperatingHours,
  parseSeconds,
} from './reply-settings'

/**
 * The account's row: Maya's behaviour only. The credential columns
 * (provider / model / api_key / embeddings_api_key) predate migration 115
 * and are no longer read — the model and key are the platform's.
 */
interface AiConfigRow {
  system_prompt: string | null
  is_active: boolean
  auto_reply_enabled: boolean
  auto_reply_max_per_conversation: number
  /** Migration 114. Optional in the row type: read through select('*')
   *  so a database without the column still loads the config. */
  activation_prompt?: string | null
  response_delay_seconds?: number | null
  snooze_seconds?: number | null
  operating_hours?: unknown
  /** Migration 116. */
  personality?: string | null
  restrictions?: string | null
}

/** A stored personality id, or the default when unset or unknown. */
function toPersonality(raw: string | null | undefined): PersonalityId {
  return PERSONALITIES.some((p) => p.id === raw) ? (raw as PersonalityId) : DEFAULT_PERSONALITY
}

/** What a workspace without a row yet gets: Maya off, the defaults. */
const DEFAULT_MAX_PER_CONVERSATION = 3

/**
 * The AI config to *use* for an account (draft, playground, auto-reply,
 * templates, campaign overview): the platform's provider, model and key
 * (Admin → AI model) with the account's behaviour on top.
 *
 * Null means "AI is not available here": the platform AI isn't set up,
 * or — with `requireActive` (the default) — the account hasn't switched
 * Maya on. A workspace that has never touched Maya has no row; with
 * `requireActive: false` (the Playground) it still gets the defaults, so
 * anyone can try her before turning her on. Throws only when the
 * platform key can't be decrypted or the read fails, so those surface
 * rather than looking like "not set up".
 *
 * Works with any client: pass the RLS-scoped SSR client from a dashboard
 * route, or the service-role admin client from a background job.
 */
export async function loadAiConfig(
  db: SupabaseClient,
  accountId: string,
  opts: { requireActive?: boolean } = {},
): Promise<AiConfig | null> {
  const { requireActive = true } = opts

  const platform = await loadPlatformAi()
  if (!platform) return null

  const { data, error } = await db
    .from('ai_configs')
    // '*' rather than a column list, so a database that hasn't run a
    // newer migration (114's activation_prompt) still loads — naming a
    // missing column would fail the whole query and silence Maya.
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error) throw error

  const row = (data ?? null) as AiConfigRow | null
  if (requireActive && !row?.is_active) return null

  return {
    provider: platform.provider,
    model: platform.model,
    apiKey: platform.apiKey,
    systemPrompt: row?.system_prompt ?? null,
    isActive: row?.is_active ?? false,
    autoReplyEnabled: row?.auto_reply_enabled ?? false,
    autoReplyMaxPerConversation:
      row?.auto_reply_max_per_conversation ?? DEFAULT_MAX_PER_CONVERSATION,
    embeddingsApiKey: platform.embeddingsApiKey,
    activationPrompt: row?.activation_prompt?.trim() || null,
    // Before migration 114 these columns don't exist; the defaults are
    // how she behaved then.
    responseDelaySeconds:
      parseSeconds(row?.response_delay_seconds, RESPONSE_DELAY) ?? RESPONSE_DELAY.default,
    snoozeSeconds: parseSeconds(row?.snooze_seconds, SNOOZE) ?? SNOOZE.default,
    operatingHours: parseOperatingHours(row?.operating_hours),
    personality: toPersonality(row?.personality),
    restrictions: row?.restrictions?.trim() || null,
  }
}

/**
 * The embeddings key for knowledge-base ingest — the platform's, whether
 * or not the account has Maya switched on, so documents are embedded as
 * they're added. `corrupt` flags a stored key that won't decrypt, so the
 * caller can warn rather than quietly index lexical-only.
 */
export async function loadEmbeddingsKey(): Promise<{ key: string | null; corrupt: boolean }> {
  try {
    const platform = await loadPlatformAi()
    return {
      key: platform?.embeddingsApiKey ?? null,
      corrupt: platform?.embeddingsKeyCorrupt ?? false,
    }
  } catch (err) {
    console.error('[ai config] platform AI could not be loaded:', err)
    return { key: null, corrupt: true }
  }
}
