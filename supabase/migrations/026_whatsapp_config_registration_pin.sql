-- ============================================================
-- whatsapp_config: store the 2-step PIN chosen during onboarding
--
-- Why this exists:
--   The Embedded Signup flow registers a freshly-added (Pending)
--   phone number with POST /{phone_number_id}/register, which also
--   SETS the number's two-step verification PIN. Meta then requires
--   that SAME pin for any later re-registration (e.g. token refresh
--   or re-subscribing the number). Without persisting it we'd have to
--   invent a new pin on every re-register, which Meta rejects with
--   "The PIN could not be changed."
--
--   The pin is encrypted with the same ENCRYPTION_KEY / AES-256-GCM
--   scheme used for access_token (see src/lib/whatsapp/encryption.ts),
--   so it is never stored in plaintext.
--
-- Backfill: nullable. Existing rows (manual-credential setups) keep
-- NULL — they supply the pin by hand on each registration, unchanged.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS registration_pin TEXT;
