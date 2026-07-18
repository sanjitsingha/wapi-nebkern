-- ============================================================
-- 062_plan_entitlements.sql — per-plan limits & feature gates
--
-- Adds a `limits` jsonb to billing_plans so the admin controls, per
-- plan, what an account may use:
--
--   max_users          int  — team members (incl. owner); null = unlimited
--   max_contacts       int  — contacts in the CRM;        null = unlimited
--   storage_mb         int  — media storage across the account-scoped
--                             buckets (flow-media / chat-media /
--                             template-media);             null = unlimited
--   allow_calling      bool — WhatsApp Calling toggle
--   allow_instagram    bool — Instagram DM channel connect
--   allow_automations  bool — Automations builder
--   allow_flows        bool — Flows (chatbot) builder
--   allow_integrations bool — API keys + outbound webhooks
--
-- Missing key / null ⇒ unlimited / allowed. Accounts with no
-- billing_plan_key (trial, grandfathered) are NOT constrained — the
-- app fails open, mirroring the subscription code's philosophy.
--
-- Also adds account_storage_bytes(): a SECURITY DEFINER helper that
-- sums storage.objects for the account's media prefix across the three
-- buckets, callable by account members (and the service role) — normal
-- clients cannot read storage.objects directly.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed sensible defaults for the three seeded tiers, ONLY where the
-- operator hasn't set anything yet (limits still '{}').
UPDATE billing_plans SET limits = '{
  "max_users": 3,
  "max_contacts": 1000,
  "storage_mb": 512,
  "allow_calling": false,
  "allow_instagram": false,
  "allow_automations": false,
  "allow_flows": false,
  "allow_integrations": false
}'::jsonb
WHERE key = 'starter' AND limits = '{}'::jsonb;

UPDATE billing_plans SET limits = '{
  "max_users": 10,
  "max_contacts": 25000,
  "storage_mb": 5120,
  "allow_calling": true,
  "allow_instagram": true,
  "allow_automations": true,
  "allow_flows": true,
  "allow_integrations": true
}'::jsonb
WHERE key = 'pro' AND limits = '{}'::jsonb;

UPDATE billing_plans SET limits = '{
  "max_users": null,
  "max_contacts": null,
  "storage_mb": 20480,
  "allow_calling": true,
  "allow_instagram": true,
  "allow_automations": true,
  "allow_flows": true,
  "allow_integrations": true
}'::jsonb
WHERE key = 'business' AND limits = '{}'::jsonb;

-- Total bytes stored under the account's media prefix across the
-- account-scoped buckets. SECURITY DEFINER because storage.objects is
-- not readable by normal clients; access is limited to members of the
-- account (or the service role).
CREATE OR REPLACE FUNCTION public.account_storage_bytes(p_account_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT CASE
    WHEN is_account_member(p_account_id) OR auth.role() = 'service_role' THEN
      COALESCE((
        SELECT sum((o.metadata->>'size')::bigint)
        FROM storage.objects o
        WHERE o.bucket_id IN ('flow-media', 'chat-media', 'template-media')
          AND o.name LIKE 'account-' || p_account_id || '/%'
          AND o.metadata ? 'size'
      ), 0)
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.account_storage_bytes(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.account_storage_bytes(uuid) TO authenticated, service_role;
