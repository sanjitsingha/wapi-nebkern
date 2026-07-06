import { NextResponse } from 'next/server'
import { dispatchInboundToAiReply, type DispatchArgs } from '@/lib/ai/auto-reply'
import { aiEngineInternalSecret } from '@/lib/ai/internal-auth'

/**
 * POST /api/ai/reply-engine — internal-only.
 *
 * Runs one AI auto-reply dispatch in its OWN serverless invocation.
 *
 * Why this exists: on serverless hosts the webhook's instance freezes
 * the moment its 200 goes back to Meta, killing any fire-and-forget
 * work — an in-flight LLM call would resume only when the next request
 * thaws the instance (replies arriving late, or only after the customer
 * sends another message). The webhook instead POSTs here with a ~2s
 * client timeout and moves on; this invocation keeps running to
 * completion on its own budget.
 *
 * Auth: `x-internal-secret` must match the ENCRYPTION_KEY-derived
 * secret (see internal-auth.ts) — not a public endpoint, no cookies.
 */

// LLM generation + retry + WhatsApp send can take a while on free-tier
// models; give this invocation a full minute.
export const maxDuration = 60

export async function POST(request: Request) {
  const expected = aiEngineInternalSecret()
  if (!expected) {
    return NextResponse.json({ error: 'engine not configured' }, { status: 503 })
  }
  if (request.headers.get('x-internal-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as DispatchArgs | null
  if (
    !body ||
    typeof body.accountId !== 'string' ||
    typeof body.conversationId !== 'string' ||
    typeof body.contactId !== 'string' ||
    typeof body.configOwnerUserId !== 'string' ||
    typeof body.messageText !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Owns its try/catch and never throws; all gating happens inside.
  await dispatchInboundToAiReply(body)

  return NextResponse.json({ ok: true })
}
