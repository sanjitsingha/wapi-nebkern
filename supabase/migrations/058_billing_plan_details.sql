-- ============================================================
-- 058_billing_plan_details.sql — richer, admin-created plans
--
-- Extends billing_plans (054) so the admin can build DETAILED plans
-- (feature list, tagline, "featured" highlight) and create new ones,
-- instead of only editing the three seeded tiers.
--
--   tagline      short subtitle under the name
--   features     jsonb array of bullet strings
--   is_featured  visually highlight this plan (e.g. "Popular")
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS tagline     text,
  ADD COLUMN IF NOT EXISTS features    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
