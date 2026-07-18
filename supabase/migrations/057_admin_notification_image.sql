-- ============================================================
-- 057_admin_notification_image.sql — image on announcements
--
-- Adds an optional image to admin announcements (056). The URL can be a
-- hosted image (https://…) or a same-app path (/…); it's rendered in the
-- tenant's notification bell and validated at the write route.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS image_url text;
