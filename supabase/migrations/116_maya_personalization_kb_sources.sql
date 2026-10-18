-- ============================================================
-- Maya: personalization, and what kind each knowledge source is.
--
-- The old Settings → AI behaviour page is gone; everything it held now
-- lives in Maya's own pages, and the parts of those pages that were UI
-- only are wired to these columns:
--
--   ai_configs.personality   Personalization → Personality type, one of
--                            lib/ai/personalities.ts. NULL = the default.
--   ai_configs.restrictions  Personalization → Restrictions: what she
--                            must not do, in the business's own words.
--   (system_prompt, unchanged, is now Personalization → "Agent role and
--   instructions" — the old page's business context, carried over as is.)
--
--   ai_knowledge_documents.kind  'text' | 'qa' | 'file' — how it was added
--                            and how the Knowledge base page edits it.
--                            Every existing document was written as text.
--   ai_knowledge_documents.meta  the source's own shape: {pairs: [{question,
--                            answer}]} for Q&A, {file_name, size_bytes} for
--                            a file. `content` stays the searchable text
--                            Maya retrieves from, whatever the kind.
-- ============================================================

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS personality text
    CHECK (personality IN ('strict-grounded', 'spartan', 'friendly', 'sales-forward')),
  ADD COLUMN IF NOT EXISTS restrictions text;

ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'qa', 'file')),
  ADD COLUMN IF NOT EXISTS meta jsonb;
