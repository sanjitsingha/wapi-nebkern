import { describe, expect, it } from 'vitest'

import { parseKnowledgeInput, qaToContent } from './knowledge-sources'

describe('parseKnowledgeInput', () => {
  it('takes text with a title and content', () => {
    const r = parseKnowledgeInput({ title: ' Returns ', content: ' 7 days. ' }, 'text', 'create')
    expect(r).toEqual({ ok: true, value: { title: 'Returns', content: '7 days.' } })
  })

  it('refuses text without content', () => {
    const r = parseKnowledgeInput({ title: 'Returns', content: '  ' }, 'text', 'create')
    expect(r.ok).toBe(false)
  })

  it('writes Q&A out as searchable text and keeps the pairs', () => {
    const pairs = [
      { question: 'Delivery time?', answer: '3–5 days.' },
      { question: '', answer: '' }, // an empty row left in the form
    ]
    const r = parseKnowledgeInput({ title: 'Shipping', pairs }, 'qa', 'create')
    expect(r.ok && r.value.content).toBe('Q: Delivery time?\nA: 3–5 days.')
    expect(r.ok && r.value.meta).toEqual({ pairs: [pairs[0]] })
  })

  it('refuses a question without an answer', () => {
    const r = parseKnowledgeInput(
      { title: 'Shipping', pairs: [{ question: 'Free?', answer: '' }] },
      'qa',
      'create',
    )
    expect(r.ok).toBe(false)
  })

  it("names a file after itself and keeps its name and size", () => {
    const r = parseKnowledgeInput(
      { content: 'Catalogue text', file: { name: 'catalogue.pdf', size: 1234 } },
      'file',
      'create',
    )
    expect(r).toEqual({
      ok: true,
      value: {
        title: 'catalogue.pdf',
        content: 'Catalogue text',
        meta: { file_name: 'catalogue.pdf', size_bytes: 1234 },
      },
    })
  })

  it('lets a file be renamed but not rewritten', () => {
    expect(parseKnowledgeInput({ title: 'Catalogue' }, 'file', 'update')).toEqual({
      ok: true,
      value: { title: 'Catalogue' },
    })
    expect(parseKnowledgeInput({ content: 'new' }, 'file', 'update').ok).toBe(false)
  })

  it('needs something to change on update', () => {
    expect(parseKnowledgeInput({}, 'text', 'update').ok).toBe(false)
  })
})

describe('qaToContent', () => {
  it('separates pairs with a blank line', () => {
    expect(
      qaToContent([
        { question: 'A?', answer: 'a' },
        { question: 'B?', answer: 'b' },
      ]),
    ).toBe('Q: A?\nA: a\n\nQ: B?\nA: b')
  })
})
