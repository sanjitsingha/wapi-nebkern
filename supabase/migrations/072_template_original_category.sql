-- ============================================================
-- 072_template_original_category.sql — remember the category the user
-- submitted, so a later Meta reclassification stays visible.
--
-- Meta may re-classify a template during review (e.g. Marketing →
-- Utility). The Meta-sync route overwrites message_templates.category
-- with Meta's current value, which erased the category the user
-- originally chose. This column preserves that original intent:
--
--   - Set on submit (= the category the user picked).
--   - Left untouched by the sync route's UPDATE, so after Meta
--     reclassifies and the user syncs, `category` holds Meta's value
--     while `original_category` still holds the submitted one. The
--     campaigns table shows the original struck-through beside Meta's
--     new value whenever the two differ.
--
-- Nullable: rows imported straight from Meta (no local submission) and
-- every pre-existing row keep it NULL — we don't know their original
-- intent, so no "reclassified" badge is shown for them.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS original_category TEXT;
