import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { indexKnowledgeDocument } from '@/lib/ai/knowledge'
import { isKnowledgeKind, parseKnowledgeInput } from '@/lib/ai/knowledge-sources'

interface DocRow {
  id: string
  title: string
  kind: string | null
  meta: Record<string, unknown> | null
  content: string
  updated_at: string
}

/**
 * GET /api/ai/knowledge
 *
 * The account's sources for Maya → Knowledge base (any member): what
 * each is and how big, not the text itself — that's GET /[id].
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase
      .from('ai_knowledge_documents')
      .select('id, title, kind, meta, content, updated_at')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('[ai/knowledge GET] error:', error)
      return NextResponse.json(
        { error: 'Failed to load knowledge base' },
        { status: 500 },
      )
    }
    const documents = ((data ?? []) as DocRow[]).map((d) => {
      const meta = d.meta ?? {}
      const pairs = Array.isArray(meta.pairs) ? meta.pairs.length : null
      return {
        id: d.id,
        title: d.title,
        kind: isKnowledgeKind(d.kind) ? d.kind : 'text',
        updated_at: d.updated_at,
        chars: d.content.length,
        questions: pairs,
        file_name: typeof meta.file_name === 'string' ? meta.file_name : null,
        size_bytes: typeof meta.size_bytes === 'number' ? meta.size_bytes : null,
      }
    })
    return NextResponse.json({ documents })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/knowledge  (admin+)
 *
 * Add a source — `kind` 'text' (title, content), 'qa' (title, pairs) or
 * 'file' (content read from the file in the browser, file {name, size}).
 * Saved first, then indexed; an indexing problem comes back as a
 * `warning` with the source already in place.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-kb:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const kind = body?.kind === undefined ? 'text' : body.kind
    if (!isKnowledgeKind(kind)) {
      return NextResponse.json({ error: 'Unknown kind of source.' }, { status: 400 })
    }
    const parsed = parseKnowledgeInput(body, kind, 'create')
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { title, content, meta } = parsed.value

    const { data: doc, error } = await supabase
      .from('ai_knowledge_documents')
      .insert({
        account_id: accountId,
        created_by: userId,
        kind,
        title,
        content,
        meta: meta ?? null,
      })
      .select('id')
      .single()
    if (error || !doc) {
      console.error('[ai/knowledge POST] insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save' },
        { status: 500 },
      )
    }

    const warning = await indexKnowledgeDocument(supabase, accountId, doc.id, content!)
    return NextResponse.json({ success: true, id: doc.id, ...(warning ? { warning } : {}) })
  } catch (err) {
    return toErrorResponse(err)
  }
}
