import { supabaseAdmin } from '@/lib/billing/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import type { AiProvider } from './types'

// ============================================================
// The platform's AI — the provider, model and paid key Dripo runs
// every account's Maya on, set in the admin panel (Admin → AI model).
// Accounts no longer bring their own key (migration 115).
//
// platform_ai_config has RLS on and no policies, so it is read with the
// service-role client whatever client the caller holds — a dashboard
// route's RLS-scoped client would see nothing.
// ============================================================

export interface PlatformAi {
  provider: AiProvider
  model: string
  apiKey: string
  /** OpenAI-compatible key for knowledge-base embeddings; null leaves
   *  retrieval lexical. */
  embeddingsApiKey: string | null
  /** True when an embeddings key is stored but won't decrypt. */
  embeddingsKeyCorrupt: boolean
}

// Every AI call reads this — the webhook's auto-reply on each inbound
// message among them — so it is held briefly in memory. A change in the
// admin panel reaches running servers within CACHE_MS; the admin route
// also clears it for the process that saved.
const CACHE_MS = 30_000
let cached: { value: PlatformAi | null; at: number } | null = null

export function clearPlatformAiCache(): void {
  cached = null
}

/**
 * The platform AI, decrypted, or null when the admin hasn't set it up.
 * Throws when the stored chat key can't be decrypted (a mismatched
 * ENCRYPTION_KEY) — a distinct failure from "not set up", which callers
 * already catch and log. A bad embeddings key only downgrades search.
 */
export async function loadPlatformAi(): Promise<PlatformAi | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value

  const { data, error } = await supabaseAdmin()
    .from('platform_ai_config')
    .select('provider, model, api_key, embeddings_api_key')
    .eq('id', true)
    .maybeSingle()
  if (error) throw error

  let value: PlatformAi | null = null
  if (data?.api_key && data.model) {
    let embeddingsApiKey: string | null = null
    let embeddingsKeyCorrupt = false
    if (data.embeddings_api_key) {
      try {
        embeddingsApiKey = decrypt(data.embeddings_api_key)
      } catch {
        embeddingsKeyCorrupt = true
        console.error(
          '[ai platform] embeddings key could not be decrypted — check ENCRYPTION_KEY; semantic search is off until it is re-entered in the admin panel.',
        )
      }
    }
    value = {
      provider: data.provider as AiProvider,
      model: data.model,
      apiKey: decrypt(data.api_key),
      embeddingsApiKey,
      embeddingsKeyCorrupt,
    }
  }

  cached = { value, at: Date.now() }
  return value
}

/** Whether Dripo's AI is set up — never throws. */
export async function isPlatformAiReady(): Promise<boolean> {
  try {
    return (await loadPlatformAi()) !== null
  } catch {
    return false
  }
}

/**
 * What to tell someone whose AI action got no config back: either Maya
 * is switched off for their workspace, or Dripo hasn't set AI up yet.
 * `action` finishes the sentence, e.g. "draft replies".
 */
export async function aiUnavailableMessage(action: string): Promise<string> {
  return (await isPlatformAiReady())
    ? `Turn Maya on in Maya → Overview to ${action}.`
    : `Maya isn't available yet — AI is still being set up for Dripo. Please try again later.`
}
