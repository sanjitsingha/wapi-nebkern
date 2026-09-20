-- ============================================================
-- 104 — a separate title for search results
--
-- A post's headline and its search-result title want different things.
-- The headline is written for someone already reading the page and can
-- be long, playful, or rely on the picture above it. The search title
-- has about 60 characters before Google cuts it, and has to carry the
-- words people actually type.
--
-- Until now the article page used the headline for both, so making one
-- work meant spoiling the other. `meta_title` holds the search version
-- when there is one; everything falls back to `title` when it is null,
-- which is every post that exists today.
-- ============================================================

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS meta_title text;

COMMENT ON COLUMN blog_posts.meta_title IS
  'Title for search results and the browser tab. Falls back to title when null. Around 60 characters before Google truncates.';
