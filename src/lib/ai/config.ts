import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import type { AiConfig } from './types'
import {
  RESPONSE_DELAY,
  SNOOZE,
  parseOperatingHours,
  parseSeconds,
} from './reply-settings'

interface AiConfigRow {
  provider: 'openai' | 'anthropic' | 'openrouter'
  model: string
  api_key: string
  system_prompt: string | null
  is_active: boolean
  auto_reply_enabled: boolean
  auto_reply_max_per_conversation: number
  embeddings_api_key: string | null
  /** Migration 114. Optional in the row type: read through select('*')
   *  so a database without the column still loads the config. */
  activation_prompt?: string | null
  response_delay_seconds?: number | null
  snooze_seconds?: number | null
  operating_hours?: unknown
}

/**
 * Load and decrypt the account's AI config for *use* (draft or
 * playground). Returns `null` when there's no row or the master switch
 * (`is_active`) is off and `requireActive` is set — both mean "AI is not
 * available", which callers treat identically. Throws only if the stored
 * key can't be decrypted (mismatched `ENCRYPTION_KEY`), so that distinct
 * failure surfaces rather than looking like "not configured".
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
  const { data, error } = await db
    .from('ai_configs')
    // '*' rather than a column list, so a database that hasn't run a
    // newer migration (114's activation_prompt) still loads — naming a
    // missing column would fail the whole query and silence Maya.
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as AiConfigRow
  // The Playground passes requireActive:false so an admin can test the
  // agent before flipping the master switch on.
  if (requireActive && !row.is_active) return null
  // Defensive: the column is NOT NULL, but a partial write / manual DB
  // edit could leave it empty. Treat a missing key as "not configured"
  // rather than letting decrypt() throw on null.
  if (!row.api_key) return null

  // The embeddings key is optional and independent of the chat key —
  // a corrupt/undecryptable one should downgrade to lexical KB, not
  // take down draft/auto-reply, so decrypt failures are swallowed here.
  let embeddingsApiKey: string | null = null
  if (row.embeddings_api_key) {
    try {
      embeddingsApiKey = decrypt(row.embeddings_api_key)
    } catch {
      console.error(
        `[ai config] embeddings key for account ${accountId} could not be decrypted — check ENCRYPTION_KEY; semantic search is disabled until it is re-entered.`,
      )
      embeddingsApiKey = null
    }
  }

  return {
    provider: row.provider,
    model: row.model,
    apiKey: decrypt(row.api_key),
    systemPrompt: row.system_prompt,
    isActive: row.is_active,
    autoReplyEnabled: row.auto_reply_enabled,
    autoReplyMaxPerConversation: row.auto_reply_max_per_conversation,
    embeddingsApiKey,
    activationPrompt: row.activation_prompt?.trim() || null,
    // Before migration 114 these columns don't exist; the defaults are
    // how she behaved then.
    responseDelaySeconds:
      parseSeconds(row.response_delay_seconds, RESPONSE_DELAY) ?? RESPONSE_DELAY.default,
    snoozeSeconds: parseSeconds(row.snooze_seconds, SNOOZE) ?? SNOOZE.default,
    operatingHours: parseOperatingHours(row.operating_hours),
  }
}

/**
 * Load + decrypt just the embeddings key, independent of `is_active`.
 * Used by the knowledge-base ingest routes so the KB gets embedded (and
 * semantic search works) whenever an embeddings key is present, even if
 * the assistant's master switch is currently off.
 *
 * Returns `{ key, corrupt }`: `key` is null when there's no key OR it
 * can't be decrypted; `corrupt` distinguishes those cases so callers can
 * warn ("a key is set but unusable") rather than silently indexing
 * lexical-only and reporting success.
 */
export async function loadEmbeddingsKey(
  db: SupabaseClient,
  accountId: string,
): Promise<{ key: string | null; corrupt: boolean }> {
  const { data, error } = await db
    .from('ai_configs')
    .select('embeddings_api_key')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error || !data?.embeddings_api_key) return { key: null, corrupt: false }
  try {
    return { key: decrypt(data.embeddings_api_key), corrupt: false }
  } catch {
    console.error(
      `[ai config] embeddings key for account ${accountId} could not be decrypted — check ENCRYPTION_KEY.`,
    )
    return { key: null, corrupt: true }
  }
}
