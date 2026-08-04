-- ============================================================
-- REBUILD BUNDLE 5 of 5
--
-- Paste this whole file into the Supabase SQL editor and Run.
-- Run the parts IN ORDER. Each part must succeed before the next.
--
-- Contains these migrations, in order:
--   065_activation_codes.sql
--   066_messenger_channel.sql
--   067_walkthrough.sql
--   068_whatsapp_widget.sql
--   069_whatsapp_forms.sql
--   070_account_onboarding.sql
--   071_user_session_management.sql
--   072_template_original_category.sql
--   073_signup_identity_and_profile.sql
--   074_invoice_payment_reference_unique.sql
--   075_automation_wait_for_reply.sql
--   076_meta_unified_connect.sql
--   077_call_softphone.sql
--   078_messages_account_id.sql
--   079_account_claims_in_app_metadata.sql
-- ============================================================

-- ------------------------------------------------------------
-- 065_activation_codes.sql
-- ------------------------------------------------------------
-- ============================================================
-- 065_activation_codes.sql — prepaid activation codes
--
-- Admin generates codes in the back office; a tenant owner/admin
-- redeems one in the app (Settings → Billing) to activate a plan
-- for a fixed number of days — no payment provider involved.
--
-- What this adds
--   1. activation_codes — the codes themselves. Each is bound to a
--      billing_plans key and a duration in days. `max_uses` lets one
--      code serve several DIFFERENT accounts (a partner/promo code);
--      a single account can never redeem the same code twice.
--   2. activation_code_redemptions — who redeemed what, when.
--   3. redeem_activation_code(p_code) — SECURITY DEFINER RPC that does
--      the whole redemption atomically: validates the code, snapshots
--      the plan price onto the account (mirroring how the admin panel
--      assigns billing, migration 054), flips the subscription to
--      'active', and stamps the current period. Stacking: redeeming
--      onto an unexpired period OF THE SAME PLAN extends it; anything
--      else starts a fresh period from now.
--
-- RLS: both tables are service-role only (no policies) — tenants
-- interact exclusively through the RPC, admins through the
-- service-role client. The RPC checks the caller's role itself.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) codes ---------------------------------------------
CREATE TABLE IF NOT EXISTS activation_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,        -- stored uppercase: WAPI-XXXX-XXXX-XXXX
  plan_key      text NOT NULL REFERENCES billing_plans(key) ON UPDATE CASCADE,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  max_uses      integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count     integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at    timestamptz,                 -- redemption deadline for the CODE (not the plan period)
  is_active     boolean NOT NULL DEFAULT true,
  note          text,                        -- admin memo ("Diwali promo", "Client X")
  created_by    uuid,                        -- admin auth.uid()
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activation_codes ENABLE ROW LEVEL SECURITY;

-- ---- (2) redemptions ---------------------------------------
CREATE TABLE IF NOT EXISTS activation_code_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id     uuid NOT NULL REFERENCES activation_codes(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  redeemed_by uuid,                          -- tenant auth.uid()
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, account_id)
);

ALTER TABLE activation_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS activation_code_redemptions_account_idx
  ON activation_code_redemptions (account_id);

-- ---- (3) redemption RPC ------------------------------------
-- Returns jsonb: { ok: true, plan_key, plan_name, duration_days,
-- period_end } on success, or { ok: false, error: <slug> } where slug ∈
-- invalid_code | code_disabled | code_expired | code_exhausted |
-- already_redeemed | plan_unavailable | no_account | forbidden.
-- Errors are values (not exceptions) so the API route can map them to
-- friendly messages without string-matching Postgres errors.
CREATE OR REPLACE FUNCTION public.redeem_activation_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_account uuid;
  v_role    text;
  v_code    activation_codes%ROWTYPE;
  v_plan    billing_plans%ROWTYPE;
  v_base    timestamptz;
  v_end     timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT account_id, account_role INTO v_account, v_role
    FROM profiles WHERE user_id = v_uid;
  IF v_account IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_account');
  END IF;
  IF v_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Lock the code row so concurrent redemptions serialize on use_count.
  SELECT * INTO v_code
    FROM activation_codes
   WHERE code = upper(trim(p_code))
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF NOT v_code.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_disabled');
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_expired');
  END IF;
  IF v_code.use_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_exhausted');
  END IF;
  IF EXISTS (
    SELECT 1 FROM activation_code_redemptions
     WHERE code_id = v_code.id AND account_id = v_account
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  SELECT * INTO v_plan FROM billing_plans
   WHERE key = v_code.plan_key AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_unavailable');
  END IF;

  -- Same plan with time left → stack on top of the current period;
  -- otherwise the new period starts now.
  SELECT CASE
           WHEN a.billing_plan_key = v_code.plan_key
            AND a.current_period_end IS NOT NULL
            AND a.current_period_end > now()
           THEN a.current_period_end
           ELSE now()
         END
    INTO v_base
    FROM accounts a
   WHERE a.id = v_account
   FOR UPDATE;

  v_end := v_base + make_interval(days => v_code.duration_days);

  UPDATE accounts
     SET plan                 = v_code.plan_key,
         subscription_status  = 'active',
         billing_plan_key     = v_code.plan_key,
         billing_amount       = v_plan.amount,
         billing_currency     = v_plan.currency,
         billing_interval     = v_plan.interval,
         current_period_start = CASE WHEN v_base > now() THEN current_period_start ELSE now() END,
         current_period_end   = v_end
   WHERE id = v_account;

  INSERT INTO activation_code_redemptions (code_id, account_id, redeemed_by)
  VALUES (v_code.id, v_account, v_uid);

  UPDATE activation_codes
     SET use_count = use_count + 1
   WHERE id = v_code.id;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_key', v_code.plan_key,
    'plan_name', v_plan.name,
    'duration_days', v_code.duration_days,
    'period_end', v_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO service_role;


-- ------------------------------------------------------------
-- 066_messenger_channel.sql
-- ------------------------------------------------------------
-- ============================================================
-- 066_messenger_channel.sql — Facebook Messenger as a third channel
--
-- Adds Facebook Messenger alongside WhatsApp and Instagram (migration
-- 044), sharing the same contacts / conversations / messages tables
-- (channel-tagged) rather than a parallel schema. The messaging
-- pipeline itself (OAuth, config, webhook, send route, Meta helpers)
-- is a fully separate parallel implementation under
-- src/app/api/messenger/ and src/lib/messenger/, so no existing
-- WhatsApp/Instagram call sites are touched.
--
-- Design notes (mirrors 044 exactly, one channel over):
--   - `contacts.messenger_id` is the customer's PSID (Page-Scoped ID)
--     — an opaque exact identifier like instagram_id, so no
--     generated/normalized column is needed.
--   - The identity CHECK is widened: a contact must carry at least one
--     of phone / instagram_id / messenger_id.
--   - `conversations.channel` CHECK gains 'messenger'.
--   - `messenger_config` mirrors `instagram_config` but is Page-based
--     (Facebook Login → a Page + its long-lived Page access token).
--     Two extra columns support the connect flow:
--       * `page_name`          — shown in the settings UI.
--       * `user_access_token`  — the long-lived USER token, stored only
--         transiently while the operator picks which Page to connect
--         (a user may manage several). Cleared once a Page is chosen.
--     Both `page_id` and `access_token` are nullable so a half-finished
--     "picking a page" row can exist; a fully connected row has both.
--   - RLS mirrors instagram_config exactly: any member reads, admin+
--     writes. Tokens are encrypted at the app layer (AES-256-GCM),
--     same as whatsapp_config / instagram_config.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- CONTACTS — messenger_id (PSID) + widened identity CHECK
-- ============================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS messenger_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_messenger_id
  ON contacts (account_id, messenger_id)
  WHERE messenger_id IS NOT NULL;

-- Replace the two-way identity CHECK (migration 044) with a three-way
-- one. Drop the old, add the new under a fresh name.
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_phone_or_instagram_id_required;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_identity_required'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_identity_required
      CHECK (phone IS NOT NULL OR instagram_id IS NOT NULL OR messenger_id IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- CONVERSATIONS — widen channel discriminator
-- ============================================================
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_channel_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_channel_check
  CHECK (channel IN ('whatsapp', 'instagram', 'messenger'));

-- ============================================================
-- MESSENGER_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS messenger_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page_id                  TEXT,
  page_name                TEXT,
  access_token             TEXT,             -- encrypted long-lived Page token
  user_access_token        TEXT,             -- encrypted long-lived USER token (transient, during page pick)
  verify_token             TEXT,
  connect_method           TEXT NOT NULL DEFAULT 'oauth' CHECK (connect_method IN ('oauth', 'manual')),
  status                   TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at             TIMESTAMPTZ,
  subscribed_at            TIMESTAMPTZ,
  last_verification_error  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global Page uniqueness (partial — a "picking a page" row has no
-- page_id yet). Mirrors instagram_config's uniqueness on the business
-- account id: the webhook resolves the owning account by page_id, so
-- two accounts claiming the same Page would break resolution.
CREATE UNIQUE INDEX IF NOT EXISTS idx_messenger_config_page_id
  ON messenger_config (page_id)
  WHERE page_id IS NOT NULL;

ALTER TABLE messenger_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messenger_config_select ON messenger_config;
CREATE POLICY messenger_config_select ON messenger_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS messenger_config_insert ON messenger_config;
CREATE POLICY messenger_config_insert ON messenger_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS messenger_config_update ON messenger_config;
CREATE POLICY messenger_config_update ON messenger_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS messenger_config_delete ON messenger_config;
CREATE POLICY messenger_config_delete ON messenger_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON messenger_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON messenger_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- 067_walkthrough.sql
-- ------------------------------------------------------------
-- ============================================================
-- 067_walkthrough.sql — per-user product walkthrough state
--
-- Tracks whether a user has finished (or dismissed) the guided
-- walkthrough, so it auto-runs exactly once per person and the sidebar
-- "Walkthrough" button can replay it on demand.
--
-- Design notes:
--   - Lives on `profiles`, not `accounts`: the tour teaches a person
--     how to use the app, so every team member gets their own run. An
--     account-level flag would mean the second member to join never
--     sees it.
--   - Timestamp rather than boolean — "when did they finish" is
--     strictly more information than "did they", and it lets us
--     re-trigger the tour after a major UI change by comparing against
--     a cutoff date instead of resetting a flag.
--   - NULL means "never completed" → the tour auto-starts. Backfilled
--     to now() for existing users so nobody who has already learned
--     the app gets an unsolicited tour on next login.
--   - No new RLS policy needed: `profiles_update` already scopes
--     writes to `auth.uid() = user_id`, which is exactly the
--     permission a user needs to record their own progress.
-- ============================================================

alter table public.profiles
  add column if not exists walkthrough_completed_at timestamptz;

comment on column public.profiles.walkthrough_completed_at is
  'When this user finished or dismissed the guided walkthrough. NULL = never seen, so the tour auto-starts on next dashboard load.';

-- Existing users have already found their way around — treat them as
-- done so the tour only ever surfaces for genuinely new sign-ups.
update public.profiles
   set walkthrough_completed_at = now()
 where walkthrough_completed_at is null;


-- ------------------------------------------------------------
-- 068_whatsapp_widget.sql
-- ------------------------------------------------------------
-- ============================================================
-- 068_whatsapp_widget.sql — embeddable WhatsApp chat widget
--
-- One configurable chat bubble per account, embedded on the
-- customer's own website via a one-line <script> tag. The loader is
-- served publicly from /widget.js?id=<public_key>, which reads this
-- row with the service-role client (RLS is bypassed there), so the
-- policies below only need to cover the dashboard's own access.
--
-- Design notes:
--   - `public_key` is the identifier that ends up in the customer's
--     page source. Deliberately NOT the account_id: it is rotatable,
--     so a widget embedded on a site you no longer control can be
--     killed without touching anything else, and it leaks no internal
--     tenancy id. It is not a credential — it grants read of exactly
--     this row's presentation fields and nothing more.
--   - `phone` is a SNAPSHOT of the account's connected WhatsApp
--     number, written by the settings page on save. It is not typed
--     by hand. Denormalized on purpose: the public loader is a hot
--     path on third-party sites, and resolving the live number means
--     decrypting a token and calling Meta — far too expensive to do
--     per widget load.
--   - `placement`, not `position`: POSITION is a SQL function, and an
--     unquoted column of that name is a footgun in later migrations.
--   - Text defaults are the same strings the settings UI seeds, so a
--     row inserted by hand still renders a sane widget.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_widgets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  public_key              TEXT NOT NULL UNIQUE,
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Master switch. Disabled serves a no-op script rather than a 404,
  -- so a still-embedded snippet degrades to nothing instead of a
  -- console error on the customer's site.
  enabled                 BOOLEAN NOT NULL DEFAULT true,

  -- Destination (snapshot of the connected number — see notes above).
  phone                   TEXT,
  prefilled_message       TEXT NOT NULL DEFAULT '',

  -- Presentation
  business_name           TEXT NOT NULL DEFAULT '',
  tagline                 TEXT NOT NULL DEFAULT 'Typically replies within minutes',
  greeting                TEXT NOT NULL DEFAULT 'Hi there! How can we help you today?',
  brand_color             TEXT NOT NULL DEFAULT '#25D366',
  placement               TEXT NOT NULL DEFAULT 'right' CHECK (placement IN ('left', 'right')),

  -- Behaviour. NULL delay means "never auto-open" — 0 would be
  -- ambiguous with "open immediately".
  auto_open_delay_seconds INTEGER CHECK (auto_open_delay_seconds IS NULL OR auto_open_delay_seconds BETWEEN 0 AND 300),
  show_on_mobile          BOOLEAN NOT NULL DEFAULT true,
  show_on_desktop         BOOLEAN NOT NULL DEFAULT true,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The public loader's only lookup.
CREATE INDEX IF NOT EXISTS idx_whatsapp_widgets_public_key
  ON whatsapp_widgets (public_key);

ALTER TABLE whatsapp_widgets ENABLE ROW LEVEL SECURITY;

-- Any member can read the config (the settings page renders it);
-- admin+ to change it, matching messenger_config / instagram_config.
DROP POLICY IF EXISTS whatsapp_widgets_select ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_select ON whatsapp_widgets FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS whatsapp_widgets_insert ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_insert ON whatsapp_widgets FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_widgets_update ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_update ON whatsapp_widgets FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_widgets_delete ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_delete ON whatsapp_widgets FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_widgets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- 069_whatsapp_forms.sql
-- ------------------------------------------------------------
-- ============================================================
-- 069_whatsapp_forms.sql — Native WhatsApp Flows ("Forms")
--
-- Called "Forms" in the product (not "Flows") to avoid colliding with
-- the existing Flows bot-builder feature (migration 010) — these are
-- two unrelated things that happen to share Meta's name for one of
-- them. A wacrm Form maps 1:1 to a Meta WhatsApp Flow object.
--
-- Scope: STATIC flows only (fixed screens, no live backend data
-- mid-flow) — no `endpoint_uri`, no data-exchange encryption. A form
-- is always exactly one screen: a set of input fields plus a submit
-- button that completes the flow and delivers the answers back via
-- webhook (`interactive.nfm_reply`).
--
-- `fields` is wacrm's own simplified authoring shape (what the builder
-- UI edits); `flow_json` is the Meta Flow JSON generated from it and
-- actually uploaded to Meta — kept alongside for support/debugging
-- without needing to regenerate or re-fetch it.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  categories        TEXT[] NOT NULL DEFAULT '{OTHER}',
  fields            JSONB NOT NULL DEFAULT '[]',
  flow_json         JSONB,
  meta_flow_id      TEXT,
  -- Mirrors Meta's own Flow status enum exactly (DRAFT | PUBLISHED |
  -- DEPRECATED | BLOCKED | THROTTLED) rather than inventing a
  -- parallel one — this value is written straight from Meta's
  -- response, not computed locally.
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'BLOCKED', 'THROTTLED')),
  validation_errors JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_forms_account ON whatsapp_forms(account_id);

-- A Meta flow_id, once assigned, is globally unique — but null while
-- still being created (the very first Meta call can fail after the
-- local row exists in rarer partial-failure paths), so this is a
-- partial index rather than a plain UNIQUE column constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_forms_meta_flow_id
  ON whatsapp_forms(meta_flow_id)
  WHERE meta_flow_id IS NOT NULL;

ALTER TABLE whatsapp_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_forms_select ON whatsapp_forms;
CREATE POLICY whatsapp_forms_select ON whatsapp_forms FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS whatsapp_forms_insert ON whatsapp_forms;
CREATE POLICY whatsapp_forms_insert ON whatsapp_forms FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_forms_update ON whatsapp_forms;
CREATE POLICY whatsapp_forms_update ON whatsapp_forms FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_forms_delete ON whatsapp_forms;
CREATE POLICY whatsapp_forms_delete ON whatsapp_forms FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_forms;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MESSAGES — a flow's completed-form answers, rendered in the thread
-- ============================================================
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video', 'location',
    'template', 'interactive', 'call', 'form_response'
  ));

-- Which form a given outbound message sent, and which form a given
-- inbound form_response answers — both nullable, only one populated
-- per row. Lets the inbox thread show the response with a live link
-- back to its form even if the form is later renamed.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_form_id UUID
  REFERENCES whatsapp_forms(id) ON DELETE SET NULL;

-- The customer's submitted answers on a form_response row, keyed by
-- field LABEL where the originating form could be resolved (via
-- flow_token below) and by raw field id otherwise. Rendered as a
-- small table in the inbox rather than a single content_text line.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS form_answers JSONB;

-- The opaque flow_token generated per send (src/lib/whatsapp/forms.ts
-- sendFlowMessage). Meta echoes it back unchanged in the nfm_reply
-- completion webhook, which is otherwise identified only by the
-- customer's phone number — with this, the webhook can look back up
-- WHICH form (of possibly several sent to the same contact) a given
-- response answers, rather than assuming "their most recent form".
ALTER TABLE messages ADD COLUMN IF NOT EXISTS flow_token TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_flow_token
  ON messages(flow_token)
  WHERE flow_token IS NOT NULL;


-- ------------------------------------------------------------
-- 070_account_onboarding.sql
-- ------------------------------------------------------------
-- ============================================================
-- 070_account_onboarding.sql — one-time plan-selection gate
--
-- Every new account already starts on a 14-day trial (migration 051).
-- This adds the flag that lets the app force a NEW account owner through
-- a one-time plan-selection screen (/onboarding) BEFORE they reach the
-- app: start the free trial, or subscribe now.
--
--   onboarded_at NULL  -> owner hasn't chosen yet -> gate to /onboarding
--   onboarded_at set   -> choice made (trial started, or a plan was paid)
--
-- Nothing here BLOCKS — enforcement lives in the app (src/middleware.ts).
-- The flag is stamped by:
--   * POST /api/account/onboarding/start-trial  (chose the free trial)
--   * POST /api/billing/razorpay/verify         (paid for a plan)
--
-- Grandfathering: the column is added WITH a DEFAULT of now(), which
-- stamps every account that already exists in one shot, then the default
-- is dropped. New rows created by handle_new_user() (migration 051) don't
-- set onboarded_at, so with no default they land NULL and are gated —
-- exactly the accounts that just registered.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op on a re-run (so existing
-- onboarded_at values are never re-stamped), and DROP DEFAULT on an
-- already-defaultless column is harmless.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz DEFAULT now();

ALTER TABLE accounts
  ALTER COLUMN onboarded_at DROP DEFAULT;


-- ------------------------------------------------------------
-- 071_user_session_management.sql
-- ------------------------------------------------------------
-- ============================================================
-- 071_user_session_management.sql — self-serve device/session list
--
-- Lets a signed-in user SEE their own active auth sessions (one per
-- device/browser) and revoke any of them from Settings → Profile.
--
-- auth.sessions isn't reachable from the client (protected schema, no
-- RLS), so two SECURITY DEFINER functions in `public` expose exactly the
-- caller's own rows: every statement is filtered by auth.uid(), so a user
-- can never see or revoke another user's session. Both are locked down to
-- the `authenticated` role only.
--
-- Revoking = deleting the session row, which kills its refresh token; the
-- device loses access as soon as its short-lived access token expires.
--
-- Idempotent: CREATE OR REPLACE, and the grants are reset on every run.
-- ============================================================

-- ---- list the caller's own sessions ------------------------
create or replace function public.list_user_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamptz,
  not_after timestamptz,
  user_agent text,
  ip text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    s.id,
    s.created_at,
    s.updated_at,
    -- refreshed_at is a naive UTC timestamp; stamp the zone so the client
    -- gets an unambiguous instant to format as "last active".
    (s.refreshed_at at time zone 'utc') as refreshed_at,
    s.not_after,
    s.user_agent,
    host(s.ip) as ip
  from auth.sessions s
  where s.user_id = (select auth.uid())
  order by coalesce((s.refreshed_at at time zone 'utc'), s.updated_at, s.created_at) desc
$$;

revoke all on function public.list_user_sessions() from public, anon;
grant execute on function public.list_user_sessions() to authenticated;

-- ---- revoke one of the caller's sessions -------------------
create or replace function public.revoke_user_session(target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  delete from auth.sessions
  where id = target
    and user_id = (select auth.uid());
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function public.revoke_user_session(uuid) from public, anon;
grant execute on function public.revoke_user_session(uuid) to authenticated;


-- ------------------------------------------------------------
-- 072_template_original_category.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 073_signup_identity_and_profile.sql
-- ------------------------------------------------------------
-- ============================================================
-- 073_signup_identity_and_profile.sql — "one email, one account"
--
-- Three pieces, all serving the signup flow:
--
--   1. profiles.profile_completed_at — gates the post-Google
--      "tell us about yourself" step (/welcome). A password signup
--      already types its full name into the form, so it is stamped
--      complete on arrival; an OAuth signup lands NULL and gets
--      routed through /welcome by src/middleware.ts.
--
--   2. profiles.referral_source — the "how did you hear about us"
--      answer collected on that step. Free text rather than an enum
--      so marketing can reword the option list without a migration
--      (the canonical list lives in src/lib/auth/referral-sources.ts).
--
--   3. public.auth_email_status(text) — a service-role-only lookup
--      answering "is this email taken, and by which provider?".
--
-- Why (3) exists: GoTrue deliberately refuses to tell the browser
-- whether an email is registered (enumeration protection). signUp()
-- on an existing address returns a *decoy* user with an empty
-- identities array and no error, so the naive form shows "check your
-- email" for an account that was never created and the user waits for
-- a mail that never comes. Worse for the Google case — someone who
-- signed up with Google and then tries email+password gets that same
-- silent no-op instead of "your account uses Google".
--
-- So the app asks the database directly, through a SECURITY DEFINER
-- function that is executable ONLY by service_role and returns the
-- bare minimum (a boolean + provider names, never a user id or hash).
-- The anon key cannot reach it; the one caller is the server route
-- /api/auth/check-email, which throttles per IP.
--
-- Grandfathering mirrors 070: profile_completed_at is added WITH a
-- DEFAULT of now() so every existing profile is stamped in one shot,
-- then the default is dropped so new rows follow the trigger's logic.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op on re-run (existing
-- profile_completed_at values are never re-stamped), DROP DEFAULT on a
-- defaultless column is harmless, and the function is CREATE OR
-- REPLACE. The trigger from 051 is left bound — the signature of
-- handle_new_user() is unchanged, so replacing the body is enough.
-- ============================================================

-- ---- (1) profile columns -----------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE profiles
  ALTER COLUMN profile_completed_at DROP DEFAULT;

COMMENT ON COLUMN profiles.profile_completed_at IS
  'NULL until the user finishes /welcome. Only OAuth signups start NULL; password signups collect the same details on the signup form.';
COMMENT ON COLUMN profiles.referral_source IS
  'Free-text "how did you hear about us" key; option list in src/lib/auth/referral-sources.ts.';

-- ---- (2) signup trigger: stamp completion for password signups ----
-- Replaces the 051 body. Same account+profile+trial bootstrap, now
-- also deciding whether the new profile needs the /welcome step.
--
-- auth.users.raw_app_meta_data->>'provider' is set by GoTrue at insert
-- time: 'email' for a password signup, the provider name ('google',
-- ...) for OAuth. Anything unrecognised is treated as OAuth — the
-- worst case is one extra confirmation screen, versus silently losing
-- the details we meant to collect.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
  v_provider TEXT;
  v_completed_at TIMESTAMPTZ;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_provider  := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_completed_at := CASE WHEN v_provider = 'email' THEN NOW() ELSE NULL END;

  INSERT INTO public.accounts (
    name, owner_user_id,
    plan, subscription_status, trial_started_at, trial_ends_at
  )
  VALUES (
    COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id,
    'trial', 'trialing', NOW(), NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (
    user_id, full_name, email, account_id, account_role, profile_completed_at
  )
  VALUES (
    NEW.id, v_full_name, NEW.email, v_account_id, 'owner', v_completed_at
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account\profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- ---- (3) email availability lookup -------------------------
-- Returns one row, always:
--   user_exists = false, providers = {}          -> address is free
--   user_exists = true,  providers = {google}    -> Google-only account
--   user_exists = true,  providers = {email,...} -> has a password
--
-- Matching is case-insensitive and trims surrounding whitespace, so
-- " Foo@Example.com " resolves the same row GoTrue would.
CREATE OR REPLACE FUNCTION public.auth_email_status(p_email TEXT)
RETURNS TABLE (user_exists BOOLEAN, providers TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT u.id INTO v_user_id
    FROM auth.users u
   WHERE lower(u.email) = lower(btrim(p_email))
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, ARRAY[]::TEXT[];
    RETURN;
  END IF;

  -- auth.identities is the live source: it also covers a password
  -- account that later linked Google (or vice versa), which a column
  -- snapshotted at signup would miss.
  RETURN QUERY
  SELECT true, COALESCE(array_agg(DISTINCT i.provider), ARRAY[]::TEXT[])
    FROM auth.identities i
   WHERE i.user_id = v_user_id;
END;
$$;

ALTER FUNCTION public.auth_email_status(TEXT) OWNER TO postgres;

-- Service role only. Revoking from PUBLIC also covers anon/authenticated,
-- but they are named explicitly so a future GRANT to either is a visible
-- decision rather than an accident — handing the anon key a bulk email
-- oracle is exactly what this function must not become.
REVOKE ALL ON FUNCTION public.auth_email_status(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_email_status(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.auth_email_status(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_status(TEXT) TO service_role;


-- ------------------------------------------------------------
-- 074_invoice_payment_reference_unique.sql
-- ------------------------------------------------------------
-- ============================================================
-- 074_invoice_payment_reference_unique.sql — one invoice per payment
--
-- The Razorpay verify route (src/app/api/billing/razorpay/verify) treats
-- invoices.payment_reference as its idempotency key: before activating a
-- plan it looks for an invoice already carrying that razorpay_payment_id.
--
-- That check was advisory only. Nothing in the schema stopped two rows
-- sharing a payment_reference, so two verify calls racing on the same
-- payment — a double-clicked handler, a retried fetch, Razorpay firing
-- the handler twice — could both read "no invoice yet" and both proceed,
-- billing the ledger twice and stacking two periods onto the account for
-- a single charge.
--
-- A unique index makes the second writer lose at the database instead,
-- which is the only layer that can actually see the race.
--
-- Partial (WHERE NOT NULL) because payment_reference is nullable and
-- carries free text for manually-recorded invoices: a cheque number or
-- "paid in cash" may legitimately repeat, and only the rows that have a
-- reference at all need to be distinct. NULLs are distinct in Postgres
-- unique indexes anyway, but the predicate also keeps the index small.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- If duplicates already exist this index build fails, which is the
-- correct outcome: they need reconciling by hand (a real double-charge
-- or a double-credit) before uniqueness can be asserted. Query to find
-- them:
--
--   SELECT payment_reference, count(*), array_agg(invoice_number)
--   FROM invoices
--   WHERE payment_reference IS NOT NULL
--   GROUP BY payment_reference HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_payment_reference_key
  ON invoices (payment_reference)
  WHERE payment_reference IS NOT NULL;


-- ------------------------------------------------------------
-- 075_automation_wait_for_reply.sql
-- ------------------------------------------------------------
-- ============================================================
-- 075_automation_wait_for_reply.sql — pause a sequence on the customer
--
-- The automation engine could only ever wait for a CLOCK. `wait` parks a
-- run in automation_pending_executions with a `run_at`, and the cron
-- resumes it when that time passes. There was no way to park a run until
-- the customer does something, which is what a drip campaign needs the
-- moment it asks a question:
--
--     send "Still interested?"  →  wait for the reply  →  branch
--
-- Without it, a Condition placed under a Send Buttons step evaluates
-- milliseconds later, against the message that TRIGGERED the automation
-- (usually none at all), so it always takes the same branch. The engine
-- had the suspend/resume machinery already — it just had one wake-up
-- source. This adds a second.
--
-- Three outcomes, not two
--   A question has a third answer: silence. Most contacts never tap
--   anything, so 'timeout' joins 'yes'/'no' as a real branch rather than
--   being folded into 'no' — "said no" and "never answered" usually
--   deserve different follow-ups, and conflating them is how a drip ends
--   up thanking someone for a reply they never sent.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) how a parked run wakes up ------------------------
-- 'timer' is the historical behaviour and stays the default, so every
-- existing pending row keeps resuming exactly as before.
ALTER TABLE automation_pending_executions
  ADD COLUMN IF NOT EXISTS wait_kind TEXT NOT NULL DEFAULT 'timer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'automation_pending_wait_kind_check'
  ) THEN
    ALTER TABLE automation_pending_executions
      ADD CONSTRAINT automation_pending_wait_kind_check
      CHECK (wait_kind IN ('timer', 'reply'));
  END IF;
END $$;

-- The wait_for_reply step itself. Its children (the yes/no/timeout
-- branches) hang off this id, exactly as a Condition's children do —
-- on resume the engine descends into it rather than continuing at
-- next_step_position.
ALTER TABLE automation_pending_executions
  ADD COLUMN IF NOT EXISTS reply_step_id UUID
    REFERENCES automation_steps(id) ON DELETE CASCADE;

-- ---- (2) widen `branch` to admit 'timeout' -----------------
-- Both tables carry the same vocabulary and both must accept it: the
-- steps table stores which branch a child belongs to, the pending table
-- stores which branch a parked run will resume into.
ALTER TABLE automation_steps
  DROP CONSTRAINT IF EXISTS automation_steps_branch_check;
ALTER TABLE automation_steps
  ADD CONSTRAINT automation_steps_branch_check
  CHECK (branch IN ('yes', 'no', 'timeout'));

ALTER TABLE automation_pending_executions
  DROP CONSTRAINT IF EXISTS automation_pending_executions_branch_check;
ALTER TABLE automation_pending_executions
  ADD CONSTRAINT automation_pending_executions_branch_check
  CHECK (branch IN ('yes', 'no', 'timeout'));

-- ---- (3) the lookup the webhook does on every inbound message ----
-- Partial: only rows actually awaiting a reply are ever probed, and
-- they're a tiny slice of the table. Without this the hot path degrades
-- into a scan of every pending execution on each message received.
CREATE INDEX IF NOT EXISTS idx_automation_pending_awaiting_reply
  ON automation_pending_executions (contact_id, status)
  WHERE wait_kind = 'reply' AND status = 'pending';

COMMENT ON COLUMN automation_pending_executions.wait_kind IS
  '''timer'' = resume when run_at passes (the `wait` step). ''reply'' = resume when the contact sends a message; run_at then acts as the give-up deadline that routes to the ''timeout'' branch.';
COMMENT ON COLUMN automation_pending_executions.reply_step_id IS
  'The wait_for_reply step whose branch children the run resumes into. NULL for timer waits, which resume at next_step_position instead.';


-- ------------------------------------------------------------
-- 076_meta_unified_connect.sql
-- ------------------------------------------------------------
-- ============================================================
-- 076_meta_unified_connect.sql — one Facebook login connects both
-- Messenger and Instagram DMs
--
-- Until now the two Meta channels were connected by two unrelated
-- flows:
--   * Messenger  — Facebook Login → a Page + its long-lived Page token
--                  (migration 066).
--   * Instagram  — Instagram Business Login → a graph.instagram.com
--                  token, with `page_id` left NULL (migration 046).
--
-- Now that this instance is an approved Meta Tech Provider, both
-- channels come out of a SINGLE Facebook Login for Business consent:
-- `GET /me/accounts` returns each Page, its Page access token, AND the
-- Instagram professional account linked to that Page, so one grant
-- yields credentials for both inboxes.
--
-- That makes the Page token the credential for Instagram too (the
-- "Instagram API with Facebook Login" path, which is what
-- src/lib/instagram/meta-api.ts already targets: it POSTs to
-- graph.facebook.com/{ig-id}/messages). Rows produced by the older
-- Instagram Business Login flow carry a graph.instagram.com token that
-- that endpoint does not accept — and a NULL `page_id`, which
-- loadInstagramAccess() treats as "not configured" — so those rows
-- could never actually send. Reconnecting through the unified flow
-- replaces them with a working Page-token row.
--
-- Changes here are additive metadata only; no data is rewritten.
--   - `connect_method` gains 'meta' so support can tell at a glance
--     which of the three flows minted a row (and therefore which Meta
--     host its token belongs to).
--   - `page_name` / `username` are display-only, so the settings UI can
--     say "Nova Store · @novastore" instead of two opaque numeric ids.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- INSTAGRAM_CONFIG — third connect method + display fields
-- ============================================================
-- Migration 046 added `connect_method` with an inline CHECK, so Postgres
-- auto-named the constraint. Rather than assume that name, drop every
-- CHECK on this table that mentions the column — there is only ever the
-- one, and this stays correct whatever it ended up called.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'instagram_config'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%connect_method%'
  LOOP
    EXECUTE format('ALTER TABLE instagram_config DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE instagram_config
    ADD CONSTRAINT instagram_config_connect_method_check
    CHECK (connect_method IN ('manual', 'oauth', 'meta'));
END $$;

-- Name of the Facebook Page the Instagram account is linked through.
-- Only set by the unified flow; NULL on manual / Instagram-Login rows.
ALTER TABLE instagram_config ADD COLUMN IF NOT EXISTS page_name TEXT;

-- The Instagram handle (no leading @), for display in settings and the
-- inbox. NULL when Meta did not return one.
ALTER TABLE instagram_config ADD COLUMN IF NOT EXISTS username TEXT;

-- ============================================================
-- MESSENGER_CONFIG — no schema change needed
-- ============================================================
-- The unified flow reuses `messenger_config.user_access_token` as the
-- transient parking spot for the long-lived USER token while the
-- operator picks which Page to connect. A Facebook Page is the anchor
-- of this flow (Instagram is reached THROUGH the Page), so a
-- messenger_config row always exists by the time a pick is pending —
-- no second staging table is warranted.


-- ------------------------------------------------------------
-- 077_call_softphone.sql
-- ------------------------------------------------------------
-- ============================================================
-- 077_call_softphone.sql — WhatsApp Calling Layer B (answer + place)
--
-- Migration 050 built Layer A: enable calling on the number, log the
-- webhook's connect/terminate events, show a call chip in the thread.
-- It could not ANSWER a call, because answering means completing a
-- WebRTC handshake, and there was nowhere to put the two halves of it.
--
-- The handshake, end to end:
--   inbound   customer's SDP offer arrives on the webhook's `calls[]`
--             event → stored here as `sdp_offer` → pushed to the agent's
--             browser over Realtime → the browser answers → the answer
--             goes to Meta as action=accept.
--   outbound  the browser makes the offer first → sent to Meta as
--             action=connect → Meta's answer arrives on the webhook →
--             stored as `sdp_answer` → Realtime carries it back to the
--             browser, which sets it as the remote description.
--
-- Why columns rather than reading `raw`: `raw` is overwritten wholesale
-- on every upsert and its shape is Meta's, not ours. The SDP is load
-- bearing — the call does not connect without it — so it gets a column
-- whose meaning cannot drift out from under the client.
--
-- `answered_by` records WHICH agent took the call. Nullable: an inbound
-- call that nobody picked up has no answerer, and Layer A rows predate
-- the concept entirely.
--
-- `status` deliberately stays free TEXT (see migration 050) — Layer B
-- adds 'connecting' and 'in_progress' to the values in circulation, and
-- a CHECK here would have to be widened every time Meta names a new
-- terminate reason.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- The customer's WebRTC offer (inbound calls).
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sdp_offer TEXT;

-- Meta's WebRTC answer (outbound calls we placed).
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sdp_answer TEXT;

-- The agent who accepted or placed it.
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- Realtime delivery
-- ============================================================
-- The softphone lives in the browser, so the ringing event has to reach
-- it without a poll. call_logs is already SELECT-able by any account
-- member (migration 050) and Realtime respects that policy, so adding
-- the table to the publication exposes nothing new — it only lets
-- members hear about rows they could already read.
--
-- Guarded: adding a table already in the publication raises 42710.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;  -- publication absent (self-hosted)
END $$;

-- Realtime sends only the primary key in the OLD record unless the
-- table replicates in full; the softphone diffs status transitions
-- (ringing → in_progress → completed), so it needs whole rows.
ALTER TABLE call_logs REPLICA IDENTITY FULL;


-- ------------------------------------------------------------
-- 078_messages_account_id.sql
-- ------------------------------------------------------------
-- ============================================================
-- 078 — messages.account_id, so Realtime can actually deliver
--
-- WHY THIS EXISTS
--
-- `messages` was the one hot table that migration 017 never gave an
-- `account_id` column. Its policies (017, lines 511-518) therefore have
-- to reach through the parent row:
--
--   EXISTS (SELECT 1 FROM conversations c
--           WHERE c.id = messages.conversation_id
--             AND is_account_member(c.account_id))
--
-- Supabase Realtime evaluates a cross-table policy like that poorly, so
-- INSERT events on `messages` frequently never reach the subscribed
-- client. The inbox worked around it by refetching the ENTIRE open
-- conversation every 5 seconds (inbox/page.tsx), which on a 100-message
-- thread is ~17 GB of egress a month for a single user — over 3x the
-- whole free-tier allowance.
--
-- Flattening the policy to a single-table check is what makes Realtime
-- reliable, which in turn lets that poll drop to a slow safety net.
--
-- SAFETY
--
-- Written to be re-runnable and non-destructive:
--   * the column is added nullable and backfilled before any NOT NULL
--   * a BEFORE INSERT trigger fills it, so the 27 insert sites in the
--     webhook/send paths need no code change and cannot forget it
--   * the NOT NULL is applied ONLY if the backfill left no gaps
--   * policies are replaced, not dropped-and-left — there is never a
--     window where `messages` is unprotected
-- ============================================================

-- ---- 1. Column ------------------------------------------------
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- ---- 2. Backfill from the parent conversation -----------------
-- Batched by conversation rather than one giant UPDATE so this stays
-- manageable on a large table. Only touches rows that need it, so a
-- re-run is a no-op.
UPDATE messages m
SET account_id = c.account_id
FROM conversations c
WHERE c.id = m.conversation_id
  AND m.account_id IS DISTINCT FROM c.account_id;

-- ---- 3. Keep it filled, without touching application code -----
-- Every insert path (Meta webhook, send routes, flows engine,
-- broadcasts) inserts messages knowing only conversation_id. A trigger
-- derives the account so none of them can drift, including any future
-- insert site.
CREATE OR REPLACE FUNCTION set_message_account_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT c.account_id INTO NEW.account_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION set_message_account_id() OWNER TO postgres;

DROP TRIGGER IF EXISTS messages_set_account_id ON messages;
CREATE TRIGGER messages_set_account_id
  BEFORE INSERT OR UPDATE OF conversation_id ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_message_account_id();

-- ---- 4. updated_at, so the poll can be incremental ------------
-- `messages` only ever had created_at. That is not enough for an
-- incremental sync: a message's status moves sending → sent →
-- delivered → read AFTER insert, and a created_at watermark would
-- never see those transitions — delivery ticks would stop updating.
--
-- With updated_at maintained here, the inbox can ask for "anything
-- that changed since X" in one query that returns zero rows when the
-- thread is idle, and still catches both new messages and status
-- changes.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Seed existing rows so the first poll after deploy isn't handed a
-- NULL watermark for the whole table.
UPDATE messages SET updated_at = created_at WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION touch_message_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER FUNCTION touch_message_updated_at() OWNER TO postgres;

DROP TRIGGER IF EXISTS messages_touch_updated_at ON messages;
CREATE TRIGGER messages_touch_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_message_updated_at();

-- ---- 5. Indexes -----------------------------------------------
-- The inbox's hot query is "this account's messages in this
-- conversation, oldest first".
CREATE INDEX IF NOT EXISTS idx_messages_account_conversation_created
  ON messages(account_id, conversation_id, created_at);

-- The incremental poll: "anything in this conversation that changed
-- since my watermark".
CREATE INDEX IF NOT EXISTS idx_messages_conversation_updated
  ON messages(conversation_id, updated_at);

-- ---- 6. Flatten the policies ----------------------------------
-- Same access semantics as 017 — read for any member, write for agent
-- and above — but resolvable from the row itself, which is what
-- Realtime needs. CREATE OR REPLACE POLICY isn't available on all
-- supported versions, so drop+create each in turn; both statements run
-- inside the migration's implicit transaction, so there is no window
-- where the table is readable without a policy.
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (
  is_account_member(account_id)
);

DROP POLICY IF EXISTS messages_modify ON messages;
CREATE POLICY messages_modify ON messages FOR ALL USING (
  is_account_member(account_id, 'agent')
) WITH CHECK (
  is_account_member(account_id, 'agent')
);
-- Service-role webhook inserts (Meta deliveries) bypass RLS as before.

-- ---- 7. NOT NULL, but only when it is safe --------------------
-- A message whose conversation was deleted mid-migration, or an
-- orphaned row from an older fork, would make this fail and roll back
-- the whole migration. Guard it: enforce the constraint when the
-- backfill is complete, and leave a notice when it is not, so the
-- column still works and the gap is visible rather than fatal.
DO $$
DECLARE
  orphans BIGINT;
BEGIN
  SELECT count(*) INTO orphans FROM messages WHERE account_id IS NULL;

  IF orphans = 0 THEN
    ALTER TABLE messages ALTER COLUMN account_id SET NOT NULL;
  ELSE
    RAISE NOTICE
      '078: % message row(s) have no account_id (orphaned conversation?). '
      'Column left nullable. Investigate, then run: '
      'ALTER TABLE messages ALTER COLUMN account_id SET NOT NULL;',
      orphans;
  END IF;
END $$;


-- ------------------------------------------------------------
-- 079_account_claims_in_app_metadata.sql
-- ------------------------------------------------------------
-- ============================================================
-- 079 — mirror account context into auth.users.app_metadata
--
-- WHY THIS EXISTS
--
-- Two hot paths re-read the same near-static facts on every request.
--
-- 1. `getCurrentAccount()` (src/lib/auth/account.ts), called by 68 API
--    route files, did:
--       a. supabase.auth.getUser()   — network call to Supabase Auth
--       b. SELECT ... FROM profiles  — to learn account_id + role
--    (b) is pure repetition: a user's account and role change maybe
--    once in the life of the account.
--
-- 2. The onboarding gate in src/middleware.ts ran a
--    profiles + accounts join on EVERY protected page navigation, just
--    to test two nullable timestamps that, once set, never unset.
--
-- Both already call `getUser()`, and `getUser()` returns the user's
-- `app_metadata` straight from the auth schema. Mirroring these values
-- there makes both extra queries disappear into a call we were already
-- making.
--
-- Chosen over a Custom Access Token Hook (needs Supabase console
-- configuration, and only refreshes on token rotation) and over a
-- signed cookie for the gate (forgeable surface in front of a paywall).
--
-- FRESHNESS
--
-- getUser() reads the live auth.users row, not the copy baked into the
-- client's JWT, so a change here takes effect on the very next request
-- — no waiting on a token refresh. That matters for the gate: paying
-- for a plan must let you in immediately.
--
-- The application still falls back to querying when a key is missing,
-- so sessions predating this migration keep working.
-- ============================================================

-- ---- 1. One recompute, one writer -----------------------------
-- Every trigger below funnels through this. Deriving all keys in one
-- place means no trigger can clobber another's work, and there is a
-- single definition of what the metadata means.
--
-- SECURITY DEFINER because the auth schema is not writable by the roles
-- that cause these changes. Merges rather than replaces, so Supabase's
-- own keys (provider, providers, ...) survive untouched.
CREATE OR REPLACE FUNCTION sync_user_app_metadata(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_account_id   UUID;
  p_account_role TEXT;
  a_name         TEXT;
  p_complete     BOOLEAN;
  a_onboarded    BOOLEAN;
BEGIN
  SELECT
    p.account_id,
    p.account_role::TEXT,
    a.name,
    p.profile_completed_at IS NOT NULL,
    a.onboarded_at IS NOT NULL
  INTO p_account_id, p_account_role, a_name, p_complete, a_onboarded
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = target_user_id;

  -- No profile yet (mid-signup). Leave metadata alone; the app's
  -- fallback query handles this window, and the trigger fires again
  -- when the row lands.
  IF p_account_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
             'account_id',       p_account_id,
             'account_role',     p_account_role,
             'account_name',     a_name,
             'profile_complete', p_complete,
             'onboarded',        a_onboarded
           )
  WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION sync_user_app_metadata(UUID) OWNER TO postgres;

-- ---- 2. Triggers ----------------------------------------------
-- profiles: joining an account, a role change, or clearing the
-- /welcome gate.
CREATE OR REPLACE FUNCTION profiles_sync_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM sync_user_app_metadata(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION profiles_sync_app_metadata() OWNER TO postgres;

DROP TRIGGER IF EXISTS profiles_app_metadata_sync ON profiles;
CREATE TRIGGER profiles_app_metadata_sync
  AFTER INSERT OR UPDATE OF account_id, account_role, profile_completed_at
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_sync_app_metadata();

-- accounts: a rename, or clearing the /onboarding gate by starting a
-- trial or paying. Fans out to every member of the account.
CREATE OR REPLACE FUNCTION accounts_sync_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.onboarded_at IS DISTINCT FROM OLD.onboarded_at THEN
    PERFORM sync_user_app_metadata(p.user_id)
    FROM profiles p
    WHERE p.account_id = NEW.id AND p.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION accounts_sync_app_metadata() OWNER TO postgres;

DROP TRIGGER IF EXISTS accounts_app_metadata_sync ON accounts;
CREATE TRIGGER accounts_app_metadata_sync
  AFTER UPDATE OF name, onboarded_at ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_sync_app_metadata();

-- ---- 3. Backfill every existing member ------------------------
-- Without this the fast paths never engage for anyone who signed up
-- before today — every request would keep taking the fallback query.
DO $$
DECLARE
  r RECORD;
  n BIGINT := 0;
BEGIN
  FOR r IN
    SELECT p.user_id
    FROM profiles p
    JOIN accounts a ON a.id = p.account_id
    WHERE p.user_id IS NOT NULL
  LOOP
    PERFORM sync_user_app_metadata(r.user_id);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '079: synced app_metadata for % user(s)', n;
END $$;
