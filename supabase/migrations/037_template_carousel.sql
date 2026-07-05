-- ============================================================
-- 037_template_carousel.sql — WhatsApp carousel templates
--
-- A carousel template is a single BODY "bubble" followed by 2–10
-- swipeable cards. Every card shares the same media format (all IMAGE
-- or all VIDEO) and the same button structure (Meta rule); only the
-- media, card body text, and per-button values vary.
--
-- Storage:
--   - template_type          'standard' (existing) or 'carousel'
--   - carousel_card_format   'image' | 'video' — shared across cards
--   - carousel_cards         JSONB array of:
--        { media_url, media_handle?, body_text, buttons: [] }
--
-- The existing header/footer columns stay NULL for carousels; the
-- top-level bubble text reuses body_text.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS carousel_card_format TEXT,
  ADD COLUMN IF NOT EXISTS carousel_cards JSONB;

-- Guard the type + format enums. Drop-then-add so re-runs don't error
-- on an existing constraint.
ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_template_type_check;
ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_template_type_check
  CHECK (template_type IN ('standard', 'carousel'));

ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_carousel_format_check;
ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_carousel_format_check
  CHECK (carousel_card_format IS NULL OR carousel_card_format IN ('image', 'video'));

-- Shape guard: carousel_cards, when present, is an array of ≤10 items.
ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_carousel_cards_shape_check;
ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_carousel_cards_shape_check
  CHECK (
    carousel_cards IS NULL
    OR (
      jsonb_typeof(carousel_cards) = 'array'
      AND jsonb_array_length(carousel_cards) <= 10
    )
  );
