import { AiError } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

// OpenRouter is a drop-in OpenAI Chat Completions gateway that proxies
// dozens of providers, including free (`:free`) models — so this adapter
// is the OpenAI one pointed at a different base URL, with the optional
// ranking headers OpenRouter recommends.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[]
  // OpenRouter surfaces upstream failures in a top-level `error` even on
  // some 200s (e.g. a free model's provider is momentarily down).
  error?: { message?: string } | string
}

/**
 * Call OpenRouter's Chat Completions endpoint with the caller's own key.
 * Returns the raw assistant text (handoff parsing happens in
 * `generateReply`).
 */
export async function generateOpenRouter(args: ProviderArgs): Promise<string> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  let res: Response
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Optional attribution headers used for OpenRouter's leaderboards;
        // harmless when omitted, nice to identify the app.
        'HTTP-Referer': 'https://wacrm.app',
        'X-Title': 'wacrm',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...mergeConsecutive(messages),
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('OpenRouter', res)
  }

  const data = (await res.json().catch(() => null)) as OpenRouterResponse | null

  // A 200 can still carry an error body when the underlying free model
  // is unavailable — surface it instead of throwing "empty response".
  if (data?.error) {
    const detail =
      typeof data.error === 'string' ? data.error : (data.error.message ?? '')
    throw new AiError(
      detail ? `OpenRouter: ${detail}` : 'OpenRouter returned an error.',
      { code: 'provider_error' },
    )
  }

  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError('OpenRouter returned an empty response.', {
      code: 'empty_response',
    })
  }
  return text
}
