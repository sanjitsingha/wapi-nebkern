import { createHash } from 'crypto'

/**
 * Shared secret for the webhook → /api/ai/reply-engine self-invocation.
 *
 * Derived from ENCRYPTION_KEY (always present in a working deployment —
 * WhatsApp tokens are encrypted with it) so operators don't need to
 * configure yet another env var. Hashed rather than sent raw so the
 * master key itself never travels in a header.
 *
 * Returns null when ENCRYPTION_KEY is unset (the app is unusable then
 * anyway); callers fall back to in-process dispatch.
 */
export function aiEngineInternalSecret(): string | null {
  const key = process.env.ENCRYPTION_KEY
  if (!key) return null
  return createHash('sha256').update(`${key}:ai-reply-engine`).digest('hex')
}
