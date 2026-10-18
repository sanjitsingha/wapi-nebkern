-- ============================================================
-- Quick replies can carry an attachment.
--
-- A quick reply was text only. Now it may hold one image, video, audio
-- clip or document — picked from the media library or uploaded in the
-- quick-reply editor — and inserting it in the inbox stages that file
-- as the composer's attachment, with the text as its caption.
--
--   media_url   public URL Meta fetches at send time
--   media_kind  image | video | audio | document
--   media_name  file name, shown for documents
--   media_path  set only for a file uploaded for this reply (chat-media),
--               so it can be deleted with the reply; a media-library
--               file is shared and has none
--
-- The text may now be empty when there is an attachment (a brochure on
-- its own is a reasonable quick reply), but a reply can't be both.
-- ============================================================

ALTER TABLE quick_replies
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_kind text
    CHECK (media_kind IN ('image', 'video', 'audio', 'document')),
  ADD COLUMN IF NOT EXISTS media_name text,
  ADD COLUMN IF NOT EXISTS media_path text;

ALTER TABLE quick_replies DROP CONSTRAINT IF EXISTS quick_replies_body_check;
ALTER TABLE quick_replies
  ADD CONSTRAINT quick_replies_body_check
  CHECK (char_length(body) <= 4096 AND (char_length(body) >= 1 OR media_url IS NOT NULL));

ALTER TABLE quick_replies DROP CONSTRAINT IF EXISTS quick_replies_media_check;
ALTER TABLE quick_replies
  ADD CONSTRAINT quick_replies_media_check
  CHECK ((media_url IS NULL) = (media_kind IS NULL));
