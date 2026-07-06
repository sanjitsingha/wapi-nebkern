import { dispatchInboundToAiReply, type DispatchArgs } from './auto-reply'
import { aiEngineInternalSecret } from './internal-auth'

/**
 * Hand an inbound message to the AI reply engine WITHOUT tying its
 * (slow) LLM work to the webhook invocation's lifetime.
 *
 * Self-invokes POST /api/ai/reply-engine — a separate serverless
 * invocation that runs to completion on its own budget — and waits at
 * most ~2s: long enough for the request to be accepted (and for cheap
 * no-op gates to finish), short enough to not hold up the webhook's 200
 * to Meta. The expected timeout abort is swallowed; the engine keeps
 * running server-side after our side of the connection closes.
 *
 * Falls back to an in-process dispatch when the self-call can't be made
 * (no ENCRYPTION_KEY, fetch refused) — correct on long-lived servers
 * (dev, VPS), best-effort on serverless.
 */
export async function triggerAiReplyEngine(
  origin: string,
  args: DispatchArgs,
): Promise<void> {
  const secret = aiEngineInternalSecret()
  if (!secret) {
    dispatchInboundToAiReply(args).catch((err) =>
      console.error('[ai auto-reply] inline dispatch failed:', err),
    )
    return
  }

  try {
    await fetch(`${origin}/api/ai/reply-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(2000),
    })
  } catch (err) {
    // Timeout = the engine invocation was accepted and is still working;
    // that's the normal fast-path exit, not a failure.
    if (err instanceof DOMException && err.name === 'TimeoutError') return
    console.error(
      '[ai auto-reply] self-invoke failed — falling back to inline dispatch:',
      err,
    )
    dispatchInboundToAiReply(args).catch((e) =>
      console.error('[ai auto-reply] inline dispatch failed:', e),
    )
  }
}
