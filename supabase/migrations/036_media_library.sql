-- ============================================================
-- 036_media_library.sql — reusable media library for templates
--
-- A dedicated place to upload images / videos / documents once,
-- validate them against Meta's WhatsApp caps, and reuse the resulting
-- public link as a template media header (header_media_url) — instead
-- of re-uploading the same file for every template.
--
-- Two parts:
--   1. `template-media` Storage bucket — public (so Meta can fetch the
--      link at send time), account-scoped writes. Mirrors chat-media
--      (migration 023) but WITHOUT audio: WhatsApp template headers
--      only support IMAGE / VIDEO / DOCUMENT.
--   2. `media_library` table — one row per uploaded asset, holding the
--      metadata the management page lists (name, kind, mime, size,
--      dimensions) plus the storage path + public URL.
--
-- Path convention (same as flow-media/chat-media post-020):
--   template-media/account-<account_id>/<timestamp>-<basename>.<ext>
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. template-media storage bucket
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-media',
  'template-media',
  TRUE,
  16777216, -- 16 MB (Meta video cap; images/documents fit under this)
  ARRAY[
    -- Images
    'image/png', 'image/jpeg', 'image/webp',
    -- Videos
    'video/mp4', 'video/3gpp',
    -- Documents
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Account-scoped writes, public reads — same predicate shape as
-- chat-media (migration 023). Drop-then-create (no CREATE POLICY IF
-- NOT EXISTS in Postgres).
DROP POLICY IF EXISTS "Template media is publicly readable" ON storage.objects;
CREATE POLICY "Template media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-media');

DROP POLICY IF EXISTS "Members can upload template media" ON storage.objects;
CREATE POLICY "Members can upload template media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'template-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can update template media" ON storage.objects;
CREATE POLICY "Members can update template media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'template-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete template media" ON storage.objects;
CREATE POLICY "Members can delete template media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'template-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

-- ------------------------------------------------------------
-- 2. media_library table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Uploader, for audit / "added by" display.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Friendly label (defaults to the original filename).
  name TEXT NOT NULL,
  -- WhatsApp header media kind.
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'document')),
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  -- Pixel dimensions for image/video; NULL for documents.
  width INT,
  height INT,
  bucket TEXT NOT NULL DEFAULT 'template-media',
  -- Storage object path (account-scoped).
  path TEXT NOT NULL,
  -- Public URL Meta fetches at send time.
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS media_library_account_created_idx
  ON media_library(account_id, created_at DESC);

ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_library_select ON media_library;
CREATE POLICY media_library_select ON media_library
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS media_library_insert ON media_library;
CREATE POLICY media_library_insert ON media_library
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS media_library_update ON media_library;
CREATE POLICY media_library_update ON media_library
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS media_library_delete ON media_library;
CREATE POLICY media_library_delete ON media_library
  FOR DELETE USING (is_account_member(account_id, 'agent'));
