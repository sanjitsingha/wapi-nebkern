// ============================================================
// Knowledge base sources — the three ways something gets into Maya's
// knowledge base (Maya → Knowledge base), validated in one place for
// the create and edit routes.
//
// Whatever the kind, `content` is the plain text that is chunked,
// embedded and retrieved (lib/ai/knowledge.ts). `meta` keeps what the
// page needs to show and edit the source as what it is:
//
//   text  — written or pasted. No meta.
//   qa    — question/answer pairs: meta {pairs}; content is the pairs
//           written out as "Q: … / A: …", so a question retrieves its
//           own answer.
//   file  — text read from an uploaded file in the browser: meta
//           {file_name, size_bytes}. The file itself isn't stored, so
//           it can be renamed but not edited — upload it again instead.
// ============================================================

export type KnowledgeKind = 'text' | 'qa' | 'file'

export const KNOWLEDGE_KINDS: KnowledgeKind[] = ['text', 'qa', 'file']

export interface QaPair {
  question: string
  answer: string
}

/** Longest searchable text one source may hold (~a 100-page document). */
export const MAX_CONTENT_CHARS = 200_000
export const MAX_TITLE_CHARS = 200
export const MAX_QA_PAIRS = 200

export function isKnowledgeKind(v: unknown): v is KnowledgeKind {
  return typeof v === 'string' && (KNOWLEDGE_KINDS as string[]).includes(v)
}

/** Q&A pairs as the text Maya searches. */
export function qaToContent(pairs: QaPair[]): string {
  return pairs.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n')
}

export interface KnowledgeWrite {
  title?: string
  content?: string
  meta?: Record<string, unknown> | null
}

type Result = { ok: true; value: KnowledgeWrite } | { ok: false; error: string }

const fail = (error: string): Result => ({ ok: false, error })

function cleanPairs(raw: unknown): QaPair[] | string {
  if (!Array.isArray(raw)) return 'Add at least one question and answer.'
  const pairs: QaPair[] = []
  for (const item of raw) {
    const question = typeof item?.question === 'string' ? item.question.trim() : ''
    const answer = typeof item?.answer === 'string' ? item.answer.trim() : ''
    if (!question && !answer) continue
    if (!question || !answer) return 'Every question needs an answer, and every answer a question.'
    pairs.push({ question, answer })
  }
  if (pairs.length === 0) return 'Add at least one question and answer.'
  if (pairs.length > MAX_QA_PAIRS) return `At most ${MAX_QA_PAIRS} questions per topic.`
  return pairs
}

/**
 * Read a create or edit body for a source of `kind`. On create every
 * required field must be there; on update only what's sent is checked,
 * and a file accepts nothing but a new title.
 */
export function parseKnowledgeInput(
  body: unknown,
  kind: KnowledgeKind,
  mode: 'create' | 'update',
): Result {
  const b = (body ?? {}) as Record<string, unknown>
  const out: KnowledgeWrite = {}

  if ('title' in b || mode === 'create') {
    let title = typeof b.title === 'string' ? b.title.trim() : ''
    // A file defaults to its own name.
    if (!title && kind === 'file' && mode === 'create') {
      const file = b.file as { name?: unknown } | undefined
      title = typeof file?.name === 'string' ? file.name.trim() : ''
    }
    if (!title) return fail('Give it a title.')
    if (title.length > MAX_TITLE_CHARS) return fail(`Titles can be at most ${MAX_TITLE_CHARS} characters.`)
    out.title = title
  }

  if (kind === 'text') {
    if ('content' in b || mode === 'create') {
      const content = typeof b.content === 'string' ? b.content.trim() : ''
      if (!content) return fail('Write something for Maya to learn.')
      if (content.length > MAX_CONTENT_CHARS) {
        return fail(`That's too long — keep it under ${MAX_CONTENT_CHARS.toLocaleString()} characters.`)
      }
      out.content = content
    }
  }

  if (kind === 'qa') {
    if ('pairs' in b || mode === 'create') {
      const pairs = cleanPairs(b.pairs)
      if (typeof pairs === 'string') return fail(pairs)
      const content = qaToContent(pairs)
      if (content.length > MAX_CONTENT_CHARS) return fail('Too many questions for one topic — split it in two.')
      out.content = content
      out.meta = { pairs }
    }
  }

  if (kind === 'file') {
    if (mode === 'update') {
      if ('content' in b || 'file' in b) return fail('A file can only be renamed — upload it again to change it.')
    } else {
      const content = typeof b.content === 'string' ? b.content.trim() : ''
      if (!content) return fail('No text could be read from that file.')
      if (content.length > MAX_CONTENT_CHARS) {
        return fail(`That file has too much text — keep it under ${MAX_CONTENT_CHARS.toLocaleString()} characters.`)
      }
      const file = (b.file ?? {}) as { name?: unknown; size?: unknown }
      out.content = content
      out.meta = {
        file_name: typeof file.name === 'string' ? file.name.slice(0, MAX_TITLE_CHARS) : out.title,
        size_bytes: typeof file.size === 'number' && file.size >= 0 ? Math.round(file.size) : null,
      }
    }
  }

  if (mode === 'update' && Object.keys(out).length === 0) return fail('Nothing to change.')
  return { ok: true, value: out }
}
