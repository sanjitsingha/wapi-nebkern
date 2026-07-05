-- ============================================================
-- 038_ai_configs.sql — AI reply assistant (bring-your-own-key)
--
-- Adds the account-level config that powers the AI Agents surface:
-- the Playground, AI-drafted replies in the inbox, and (future) the
-- inbound auto-reply bot.
--
-- Design notes
--   - `ai_configs` is account-scoped and UNIQUE(account_id) — one AI
--     setup per workspace, exactly like `whatsapp_config`. Teammates
--     inside an account share it.
--   - `api_key` is the caller's own OpenAI / Anthropic key. We call the
--     provider *with* it on every draft/playground call, so we need the
--     plaintext at call time — stored AES-256-GCM-encrypted at rest
--     (same `encrypt()`/`decrypt()` as `whatsapp_config.access_token`)
--     and never returned to the client after save (the UI shows a masked
--     placeholder).
--   - `created_by` records who saved it (audit); ON DELETE SET NULL so
--     removing a teammate doesn't drop the workspace's AI config.
--   - `is_active` is the master switch (the inbox "Draft with AI" button
--     is live only when true). `auto_reply_enabled` /
--     `auto_reply_max_per_conversation` are reserved for the inbound
--     auto-reply bot (not yet wired) — kept here so enabling it later is
--     a code-only change.
--
-- RLS
--   Settings-class, mirroring `whatsapp_config`: any member may read the
--   config (the inbox needs to know whether the AI affordance is live),
--   but only admin+ may create / update / delete it.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_configs (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                        uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by                        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider                          text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'openrouter')),
  model                             text NOT NULL,
  api_key                           text NOT NULL,            -- AES-256-GCM-encrypted BYO provider key
  system_prompt                     text,                     -- business context / persona / tone
  is_active                         boolean NOT NULL DEFAULT false,
  auto_reply_enabled                boolean NOT NULL DEFAULT false,
  auto_reply_max_per_conversation   integer NOT NULL DEFAULT 3
                                      CHECK (auto_reply_max_per_conversation BETWEEN 1 AND 20),
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the account can see the config so the inbox
-- knows whether the "Draft with AI" affordance is live.
DROP POLICY IF EXISTS ai_configs_select ON ai_configs;
CREATE POLICY ai_configs_select ON ai_configs FOR SELECT
  USING (is_account_member(account_id));

-- INSERT / UPDATE / DELETE: admin+ only (settings-class).
DROP POLICY IF EXISTS ai_configs_insert ON ai_configs;
CREATE POLICY ai_configs_insert ON ai_configs FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_configs_update ON ai_configs;
CREATE POLICY ai_configs_update ON ai_configs FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_configs_delete ON ai_configs;
CREATE POLICY ai_configs_delete ON ai_configs FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Keep updated_at fresh on every write.
CREATE OR REPLACE FUNCTION public.update_ai_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_configs_updated_at ON ai_configs;
CREATE TRIGGER ai_configs_updated_at
  BEFORE UPDATE ON ai_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_configs_updated_at();
