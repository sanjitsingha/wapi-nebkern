-- ============================================================
-- 105 — a saved AI overview on each campaign
--
-- The campaign page can ask the account's own AI provider to read the
-- results and write a short overview: a one-line verdict, a paragraph
-- on what worked and what did not, and what to try next time. Each one spends the
-- account's tokens, so it is generated on request and kept here rather
-- than recomputed on every visit. Refreshing overwrites it.
--
-- `ai_overview` holds the parsed sections plus the numbers it was based
-- on, so the page can say "written when 1,200 of 1,500 had been
-- delivered" once the counters have moved on. Both columns are null
-- until someone generates one, which is every campaign today.
--
-- No policy changes: broadcasts_update (migration 017) already lets an
-- agent write the row, and the overview route requires agent.
-- ============================================================

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS ai_overview jsonb,
  ADD COLUMN IF NOT EXISTS ai_overview_at timestamptz;

COMMENT ON COLUMN broadcasts.ai_overview IS
  'AI-written campaign overview: { headline, summary, suggestions[], basis, provider, model }. Null until generated.';
COMMENT ON COLUMN broadcasts.ai_overview_at IS
  'When ai_overview was last generated.';
