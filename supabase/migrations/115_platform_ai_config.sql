-- ============================================================
-- AI is provided by Instant, not brought by each account.
--
-- Until now every account entered its own provider, model and API key
-- (ai_configs.provider / model / api_key, all required), and Maya only
-- existed for an account once someone had pasted a key. The model and
-- the paid key are now the platform's, set once in the admin panel:
--
--   platform_ai_config — a single row: provider, model, the chat key and
--   an optional embeddings key, both AES-256-GCM-encrypted by the app
--   (same ENCRYPTION_KEY as every other stored secret). RLS on with no
--   policies, so only the service role — the admin panel and the server
--   loading Maya's config — can read or write it. No tenant ever sees
--   the key, not even its ciphertext.
--
-- ai_configs keeps what is per-account — Maya's behaviour: the master
-- switch, auto-reply, prompts, timing, hours. Its credential columns
-- become optional and are no longer read; existing values stay where
-- they are rather than being destroyed by a migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_ai_config (
  -- A singleton: the primary key can only ever be TRUE.
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  provider            text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'openrouter')),
  model               text NOT NULL,
  api_key             text NOT NULL,   -- encrypted
  embeddings_api_key  text,            -- encrypted; OpenAI-compatible, optional
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text             -- the admin's email, for the record
);

ALTER TABLE platform_ai_config ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: anon and authenticated get nothing.

ALTER TABLE ai_configs ALTER COLUMN provider DROP NOT NULL;
ALTER TABLE ai_configs ALTER COLUMN model DROP NOT NULL;
ALTER TABLE ai_configs ALTER COLUMN api_key DROP NOT NULL;
