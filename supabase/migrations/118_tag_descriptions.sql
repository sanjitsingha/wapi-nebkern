-- ============================================================
-- Tags get an optional description.
--
-- Settings → Tags edits a tag's name, colour and now a short note on
-- what it's for ("Asked about bulk pricing", "Paid in the last 30
-- days"), so a team agrees on when to use it. Editing is admin+, as
-- the existing tags_update policy already says.
-- ============================================================

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS description text
    CHECK (char_length(description) <= 200);
