import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { indexKnowledgeDocument } from '@/lib/ai/knowledge'
import { isKnowledgeKind, parseKnowledgeInput } from '@/lib/ai/knowledge-sources'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/ai/knowledge/[id] — one source in full, for editing (any
 * member): its text, and for Q&A the pairs in meta.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { id } = await params
    const { data, error } = await supabase
      .from('ai_knowledge_documents')
      .select('id, title, kind, meta, content, updated_at')
      .eq('account_id', accountId)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('[ai/knowledge/[id] GET] error:', error)
      return NextResponse.json({ error: 'Failed to load document' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...data, kind: isKnowledgeKind(data.kind) ? data.kind : 'text' })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * PATCH /api/ai/knowledge/[id]  (admin+) — edit a source as its kind
 * allows (text: title/content; Q&A: title/pairs; file: title only),
 * re-indexing when its text changed.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-kb:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const { id } = await params
    const body = await request.json().catch(() => null)

    const { data: existing, error: readError } = await supabase
      .from('ai_knowledge_documents')
      .select('kind')
      .eq('account_id', accountId)
      .eq('id', id)
      .maybeSingle()
    if (readError) {
      console.error('[ai/knowledge/[id] PATCH] read error:', readError)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const kind = isKnowledgeKind(existing.kind) ? existing.kind : 'text'
    const parsed = parseKnowledgeInput(body, kind, 'update')
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const update = parsed.value

    const { error } = await supabase
      .from('ai_knowledge_documents')
      .update(update)
      .eq('account_id', accountId)
      .eq('id', id)
    if (error) {
      console.error('[ai/knowledge/[id] PATCH] error:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    const warning =
      update.content !== undefined
        ? await indexKnowledgeDocument(supabase, accountId, id, update.content)
        : null
    return NextResponse.json({ success: true, ...(warning ? { warning } : {}) })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/knowledge/[id]  (admin+) — chunks cascade.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const { id } = await params
    const { error } = await supabase
      .from('ai_knowledge_documents')
      .delete()
      .eq('account_id', accountId)
      .eq('id', id)
    if (error) {
      console.error('[ai/knowledge/[id] DELETE] error:', error)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
