-- API Keys for external integrations (server-to-server auth)
-- Per-account scoped keys with permissions. Raw keys are shown once at creation; only SHA-256 hashes are stored.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Integration key',
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read:templates', 'send:messages'],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON public.api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_select
  ON public.api_keys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.account_id = api_keys.account_id
      AND profiles.user_id = auth.uid()
  ));

CREATE POLICY api_keys_insert
  ON public.api_keys FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.account_id = api_keys.account_id
      AND profiles.user_id = auth.uid()
  ));

CREATE POLICY api_keys_delete
  ON public.api_keys FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.account_id = api_keys.account_id
      AND profiles.user_id = auth.uid()
  ));

-- Minimal account_settings (used by integration setup panel for template preferences)
CREATE TABLE IF NOT EXISTS public.account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  appointment_notification_template text,
  appointment_notification_enabled boolean NOT NULL DEFAULT false,
  appointment_variable_order text[] NOT NULL DEFAULT ARRAY[
    'patient_name', 'patient_phone', 'appointment_id',
    'appointment_date', 'appointment_time', 'doctor_name', 'clinic_name'
  ],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_settings_select
  ON public.account_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.account_id = account_settings.account_id
      AND profiles.user_id = auth.uid()
  ));

CREATE POLICY account_settings_insert
  ON public.account_settings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.account_id = account_settings.account_id
      AND profiles.user_id = auth.uid()
  ));

CREATE POLICY account_settings_update
  ON public.account_settings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.account_id = account_settings.account_id
      AND profiles.user_id = auth.uid()
  ));
