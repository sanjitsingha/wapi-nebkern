import { AiError, type ChatMessage } from '../types'

// ============================================================
// Bits shared by the OpenAI + Anthropic adapters.
// ============================================================

export interface ProviderArgs {
  apiKey: string
  model: string
  systemPrompt: string
  messages: ChatMessage[]
  timeoutMs: number
  /** Output cap for this call; MAX_OUTPUT_TOKENS when omitted. */
  maxOutputTokens?: number
}

/**
 * The error for a 200 with no text in it, saying why when the provider
 * told us.
 *
 * `length` is the case worth naming: a reasoning model (DeepSeek R1,
 * gpt-oss, the GPT-5 family…) spends its output allowance thinking
 * before it writes, and when the allowance runs out first the answer is
 * simply blank. "Empty response" alone sent people looking for an
 * outage that wasn't there.
 */
export function emptyResponseError(
  provider: string,
  model: string,
  finishReason: string | null | undefined,
): AiError {
  if (finishReason === 'length' || finishReason === 'max_tokens') {
    return new AiError(
      `${provider} (${model}) used its whole output allowance before writing an answer, usually by reasoning at length. Try again, or pick a model without built-in reasoning in Maya settings.`,
      { code: 'output_limit' },
    )
  }
  return new AiError(
    `${provider} (${model}) returned an empty response${finishReason ? ` (finish reason: ${finishReason})` : ''}. Free models often do this when they are busy; try again in a minute.`,
    { code: 'empty_response' },
  )
}

/** Map a fetch rejection (timeout / DNS / offline) to a typed AiError. */
export function toNetworkError(err: unknown): AiError {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new AiError('The AI provider took too long to respond.', {
      code: 'timeout',
      status: 504,
    })
  }
  const msg = err instanceof Error ? err.message : String(err)
  return new AiError(`Could not reach the AI provider: ${msg}`, {
    code: 'network_error',
    status: 502,
  })
}

/** Build a typed AiError from a non-2xx provider response, pulling the
 *  provider's own error message out of the JSON body when present. */
export async function providerHttpError(
  provider: string,
  res: Response,
): Promise<AiError> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } | string }
    detail =
      typeof body?.error === 'string'
        ? body.error
        : (body?.error?.message ?? '')
  } catch {
    // Non-JSON error body — fall back to the status line.
  }

  const { status } = res
  const code =
    status === 401 || status === 403
      ? 'invalid_key'
      : status === 429
        ? 'rate_limited'
        : 'provider_error'
  const base =
    code === 'invalid_key'
      ? `${provider} rejected the API key`
      : code === 'rate_limited'
        ? `${provider} rate limit reached`
        : `${provider} API error (${status})`

  return new AiError(detail ? `${base}: ${detail}` : base, {
    code,
    // Surface an auth failure as 401 so the setup "Test key" button can
    // show "invalid key"; everything else is an upstream 502.
    status: code === 'invalid_key' ? 401 : 502,
  })
}

/**
 * Collapse consecutive same-role turns into one (joined with blank
 * lines). Anthropic requires strictly alternating roles; merging is
 * also harmless for OpenAI and keeps the transcript compact.
 */
export function mergeConsecutive(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const m of messages) {
    const last = out[out.length - 1]
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${m.content}`
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}
