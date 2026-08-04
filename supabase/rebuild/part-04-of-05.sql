-- ============================================================
-- REBUILD BUNDLE 4 of 5
--
-- Paste this whole file into the Supabase SQL editor and Run.
-- Run the parts IN ORDER. Each part must succeed before the next.
--
-- Contains these migrations, in order:
--   044_instagram_channel.sql
--   045_contact_marital.sql
--   046_instagram_oauth.sql
--   047_filter_contacts_by_tags_opt_out.sql
--   048_append_automation_log_steps.sql
--   049_ai_reply_debounce.sql
--   050_call_logs.sql
--   051_account_trial.sql
--   052_quick_replies.sql
--   053_support_tickets.sql
--   054_billing.sql
--   055_invoices.sql
--   056_admin_notifications.sql
--   057_admin_notification_image.sql
--   058_billing_plan_details.sql
--   059_app_popups.sql
--   060_webhooks.sql
--   061_app_announcements.sql
--   062_plan_entitlements.sql
--   063_blog_posts.sql
--   064_system_health.sql
-- ============================================================

-- ------------------------------------------------------------
-- 044_instagram_channel.sql
-- ------------------------------------------------------------
-- ============================================================
-- 044_instagram_channel.sql — Instagram DM as a second channel
--
-- Adds Instagram Direct Messages as a channel alongside WhatsApp,
-- sharing the same `contacts`/`conversations`/`messages` tables
-- (channel-tagged) rather than a parallel schema. The messaging
-- pipeline itself (webhook, send route, Meta API helpers) is a
-- fully separate parallel implementation — see
-- src/app/api/instagram/ and src/lib/instagram/ — so none of the
-- 18+ existing `whatsapp_config` call sites are touched by this
-- migration or need to change.
--
-- Design notes
--   - `contacts.phone` becomes nullable: an Instagram DM contact
--     often has no phone number at all. Verified safe against the
--     existing `phone_normalized` generated column + partial unique
--     index (migration 022) — `regexp_replace(NULL, ...)` evaluates
--     to NULL, and `NULL <> ''` evaluates to NULL (not TRUE), so
--     NULL-phone rows automatically fall outside that index's WHERE
--     clause. No changes needed to migration 022's objects.
--   - `contacts.instagram_id` is the customer's IGSID
--     (Instagram-scoped id) — an exact opaque identifier, not a
--     fuzzy-matched value like phone, so no generated/normalized
--     column is needed for it.
--   - A contact row must carry at least one identity (phone or
--     instagram_id) — enforced by a CHECK constraint.
--   - `conversations.channel` defaults every existing row to
--     'whatsapp' so no backfill is required. NOTE: the existing
--     `idx_conversations_account_contact` unique index (migration
--     027, `UNIQUE(account_id, contact_id) WHERE account_id IS NOT
--     NULL`) is deliberately NOT widened to include `channel` here.
--     This is safe only because a contact's identity is
--     channel-exclusive in this MVP (a contact is created via either
--     the WhatsApp phone-match path or the Instagram instagram_id-
--     match path, never both) — so "one conversation per contact"
--     already implies "one per contact per channel". THIS INVARIANT
--     BREAKS the day cross-channel contact merging is built
--     (explicitly deferred) — revisit this index at that time.
--   - `messages` gets NO new column. The UI always has the parent
--     `conversations.channel` in hand wherever messages are
--     rendered, threaded down as a prop — duplicating a value that
--     never changes per-conversation onto every message row would
--     be pure redundancy.
--   - `instagram_config` mirrors `whatsapp_config`, simplified (no
--     phone /register+PIN dance, no WABA-subscribe step — those are
--     WhatsApp Cloud API-specific with no Instagram equivalent).
--     Follows the shared `update_updated_at_column()` trigger
--     convention from migrations 042/043 (the current majority
--     pattern), not migration 038's one-off per-table function.
--     RLS mirrors `whatsapp_config` exactly: any member reads,
--     admin+ writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- CONTACTS — nullable phone + instagram_id
-- ============================================================
ALTER TABLE contacts ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_instagram_id
  ON contacts (account_id, instagram_id)
  WHERE instagram_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_phone_or_instagram_id_required'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_phone_or_instagram_id_required
      CHECK (phone IS NOT NULL OR instagram_id IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- CONVERSATIONS — channel discriminator
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'instagram'));

CREATE INDEX IF NOT EXISTS idx_conversations_account_channel
  ON conversations (account_id, channel);

-- ============================================================
-- INSTAGRAM_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS instagram_config (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                     UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by                     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page_id                        TEXT NOT NULL,
  instagram_business_account_id  TEXT NOT NULL,
  access_token                   TEXT NOT NULL,
  verify_token                   TEXT,
  status                         TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at                   TIMESTAMPTZ,
  subscribed_at                  TIMESTAMPTZ,
  last_verification_error        TEXT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global uniqueness, mirroring whatsapp_config.phone_number_id
-- (migration 013) — the webhook resolves the owning account by this
-- id, so two accounts claiming the same IG business account would
-- break resolution the same way issue #136 did for phone numbers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instagram_config_ig_business_account_id_key'
  ) THEN
    ALTER TABLE instagram_config
      ADD CONSTRAINT instagram_config_ig_business_account_id_key
      UNIQUE (instagram_business_account_id);
  END IF;
END $$;

ALTER TABLE instagram_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_config_select ON instagram_config;
CREATE POLICY instagram_config_select ON instagram_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS instagram_config_insert ON instagram_config;
CREATE POLICY instagram_config_insert ON instagram_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS instagram_config_update ON instagram_config;
CREATE POLICY instagram_config_update ON instagram_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS instagram_config_delete ON instagram_config;
CREATE POLICY instagram_config_delete ON instagram_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON instagram_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON instagram_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- 045_contact_marital.sql
-- ------------------------------------------------------------
-- ============================================================
-- 045_contact_marital.sql — Marital status + spouse on contacts
--
-- `marital_status` is free-form TEXT (the UI offers a fixed set);
-- `spouse_name` is only meaningful when married and is cleared by the
-- app otherwise. Both nullable, additive, idempotent.
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS spouse_name    TEXT;


-- ------------------------------------------------------------
-- 046_instagram_oauth.sql
-- ------------------------------------------------------------
-- ============================================================
-- 046_instagram_oauth.sql — Instagram Business Login (OAuth) connect
--
-- Adds a one-click "Connect with Instagram" flow (Instagram API with
-- Instagram Login — https://developers.facebook.com/docs/instagram-platform)
-- alongside the existing manual Page-Access-Token entry form. Unlike
-- the manual flow, Instagram Business Login does NOT go through a
-- linked Facebook Page at all — the user logs in directly with their
-- Instagram Professional account and grants permissions, so
-- `instagram_config.page_id` (NOT NULL until now) has no value to
-- store for these rows.
--
-- `connect_method` records which flow produced the row, mainly for
-- support/debugging (the two flows mint tokens from different Meta
-- API hosts — graph.instagram.com for OAuth vs graph.facebook.com for
-- the legacy Page-token path — so knowing which one a given row used
-- matters when something needs troubleshooting).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE instagram_config ALTER COLUMN page_id DROP NOT NULL;

ALTER TABLE instagram_config
  ADD COLUMN IF NOT EXISTS connect_method TEXT NOT NULL DEFAULT 'manual'
  CHECK (connect_method IN ('manual', 'oauth'));


-- ------------------------------------------------------------
-- 047_filter_contacts_by_tags_opt_out.sql
-- ------------------------------------------------------------
-- ============================================================
-- 047_filter_contacts_by_tags_opt_out.sql — opt-out filter on the
-- tag-filtered contacts RPC
--
-- The Contacts page's "Filter" dropdown now also offers an "Opted
-- out only" toggle (marketing_opt_out = true). When no tags are
-- selected, the plain client-side query can just add .eq() directly.
-- But when tags ARE selected, contacts go through
-- filter_contacts_by_tags (025, extended by 032) instead — so that
-- RPC needs the same opt-out condition to keep both filters
-- composable.
--
-- p_opted_out: NULL (default) = no filter, TRUE = opted-out only,
-- FALSE = opted-in only.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.filter_contacts_by_tags(
  p_tag_ids UUID[],
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_created_from DATE DEFAULT NULL,
  p_created_to DATE DEFAULT NULL,
  p_opted_out BOOLEAN DEFAULT NULL
)
RETURNS TABLE (contact contacts, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matched AS (
    -- Distinct contacts having ANY of the selected tags (OR),
    -- narrowed by the same name/phone/email search as the list, plus
    -- an optional creation-date range and opt-out state.
    SELECT DISTINCT c.id, c.created_at
    FROM contacts c
    JOIN contact_tags ct ON ct.contact_id = c.id
    WHERE ct.tag_id = ANY(p_tag_ids)
      AND (
        p_search IS NULL
        OR c.name ILIKE '%' || p_search || '%'
        OR c.phone ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
      )
      AND (p_created_from IS NULL OR c.created_at >= p_created_from)
      AND (p_created_to IS NULL OR c.created_at < p_created_to + INTERVAL '1 day')
      AND (p_opted_out IS NULL OR c.marketing_opt_out = p_opted_out)
  ),
  page AS (
    -- count(*) OVER() is evaluated before LIMIT, so it is the full
    -- match total regardless of the page being returned.
    SELECT id, count(*) OVER() AS total_count
    FROM matched
    ORDER BY created_at DESC, id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT c AS contact, page.total_count
  FROM page
  JOIN contacts c ON c.id = page.id
  ORDER BY c.created_at DESC, c.id;
$$;

ALTER FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, DATE, DATE, BOOLEAN) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, DATE, DATE, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, DATE, DATE, BOOLEAN) TO authenticated;

-- Drop the old 6-arg overload — PostgREST would otherwise see two
-- candidate overloads for the old call shape and refuse to pick one.
DROP FUNCTION IF EXISTS public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, DATE, DATE);


-- ------------------------------------------------------------
-- 048_append_automation_log_steps.sql
-- ------------------------------------------------------------
-- ============================================================
-- 048_append_automation_log_steps.sql — atomic step-result append
--
-- engine.ts's appendResults() used to SELECT steps_executed, merge in
-- JS, then UPDATE — two round trips per automation-log write, on the
-- hot path of every single automation run (webhook -> automations ->
-- Meta send -> this write, all inline before the webhook can ack).
-- This function does the JSONB concat + status/error_message update
-- in one statement, cutting that to one round trip and making
-- concurrent scope-completions (nested condition branches) race-safe
-- instead of last-write-wins.
--
-- p_status/p_error_message NULL = leave the existing column value
-- alone (mirrors the old code's `if (status !== null)` /
-- `if (errorMessage)` guards — status is only overwritten by the
-- outermost scope, and error_message is never explicitly cleared).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.append_automation_log_steps(
  p_log_id UUID,
  p_new_items JSONB,
  p_status TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE automation_logs
  SET steps_executed = steps_executed || p_new_items,
      status = COALESCE(p_status, status),
      error_message = COALESCE(p_error_message, error_message)
  WHERE id = p_log_id;
$$;

ALTER FUNCTION public.append_automation_log_steps(UUID, JSONB, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.append_automation_log_steps(UUID, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_automation_log_steps(UUID, JSONB, TEXT, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 049_ai_reply_debounce.sql
-- ------------------------------------------------------------
-- ============================================================
-- 049_ai_reply_debounce.sql — burst-coalescing for AI auto-reply
--
-- Problem: a customer who fires several quick messages ("Hi" / "Hey" /
-- "How are you") gets one bot reply PER message, because each inbound
-- spawns its own reply-engine invocation and they don't coordinate.
-- Comparing "which message is newest" doesn't fix it — insertion
-- latency lets multiple invocations anchor on the SAME latest message
-- and all reply together, and WhatsApp timestamps are second-grained
-- so ties are common.
--
-- Fix: a monotonic per-conversation sequence + deadline. Every eligible
-- inbound BUMPS the sequence (superseding any earlier waiting
-- invocation) and pushes the deadline to now()+delay. Each invocation
-- then waits and CLAIMS: the claim only succeeds for the holder of the
-- current (highest) sequence once the deadline has elapsed. Because the
-- sequence is a real counter, exactly one invocation per burst can ever
-- win — no ties, no dependence on message ordering.
--
--   - `conversations.ai_debounce_seq`      — monotonic bump counter.
--   - `conversations.ai_debounce_deadline` — when the quiet period ends;
--     NULL once claimed (so a claim can't fire twice).
--
-- Runs under the service-role client from the reply engine (no
-- auth.uid()), so no extra RLS is needed — same as claim_ai_reply_slot.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_debounce_seq bigint NOT NULL DEFAULT 0;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_debounce_deadline timestamptz;

-- Bump: called once per eligible inbound message. Increments the
-- sequence (so any earlier invocation still waiting is now stale) and
-- (re)sets the deadline to now() + p_delay_ms. Returns the new sequence
-- value for the caller to hold and present to claim_ai_reply_debounce.
CREATE OR REPLACE FUNCTION public.bump_ai_reply_debounce(
  p_conversation_id uuid,
  p_delay_ms integer
)
RETURNS bigint AS $$
  UPDATE conversations
  SET ai_debounce_seq = ai_debounce_seq + 1,
      ai_debounce_deadline = now() + make_interval(secs => p_delay_ms / 1000.0)
  WHERE id = p_conversation_id
  RETURNING ai_debounce_seq;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Claim: called after the caller has waited out the quiet period.
-- Succeeds (returns true, and clears the deadline so no one else can
-- also win) only when the caller still holds the latest sequence AND
-- the deadline has actually elapsed — i.e. no newer message bumped past
-- it. Atomic single UPDATE, so at most one caller per burst wins.
CREATE OR REPLACE FUNCTION public.claim_ai_reply_debounce(
  p_conversation_id uuid,
  p_seq bigint
)
RETURNS boolean AS $$
  WITH claimed AS (
    UPDATE conversations
    SET ai_debounce_deadline = NULL
    WHERE id = p_conversation_id
      AND ai_debounce_seq = p_seq
      AND ai_debounce_deadline IS NOT NULL
      AND ai_debounce_deadline <= now()
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Read the current sequence — lets a waiting invocation notice it's
-- been superseded and stand down early instead of sleeping out the
-- whole window. Correctness rests on the atomic claim above; this is
-- only an optimization, so a plain read is fine.
CREATE OR REPLACE FUNCTION public.current_ai_reply_debounce_seq(
  p_conversation_id uuid
)
RETURNS bigint AS $$
  SELECT ai_debounce_seq FROM conversations WHERE id = p_conversation_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Same lockdown rationale as claim_ai_reply_slot (039): SECURITY DEFINER
-- functions default to PUBLIC/anon and bypass RLS, so restrict EXECUTE
-- to the service-role client the reply engine runs under.
REVOKE ALL ON FUNCTION public.bump_ai_reply_debounce(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_ai_reply_debounce(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.claim_ai_reply_debounce(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_debounce(uuid, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.current_ai_reply_debounce_seq(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_ai_reply_debounce_seq(uuid) TO service_role;


-- ------------------------------------------------------------
-- 050_call_logs.sql
-- ------------------------------------------------------------
-- ============================================================
-- 050_call_logs.sql — WhatsApp Business Calling (Layer A: call log)
--
-- Records inbound (and, later, outbound) WhatsApp voice-call events
-- delivered on the webhook's `calls` field. Layer A does NOT answer
-- calls (that's the WebRTC softphone, Layer B) — it enables calling on
-- the number, receives the connect/terminate events, and logs them so
-- the business can see when customers tried to call.
--
-- Design notes
--   - Account-scoped, read-only in the app: any member can SELECT;
--     there are no INSERT/UPDATE/DELETE policies because the ONLY writer
--     is the webhook, which uses the service-role client (bypasses RLS).
--     Mirrors automation_logs (migration 017): logs are observed, never
--     hand-edited. This also means no client can forge a call record.
--   - `wa_call_id` is Meta's call id. UNIQUE(account_id, wa_call_id) so
--     the webhook can UPSERT: the `connect` event creates the row, the
--     later `terminate` event finalizes it (status/duration/ended_at)
--     without racing to a duplicate, and redelivered events are no-ops.
--   - conversation_id / contact_id are nullable FKs (ON DELETE SET NULL)
--     so purging a contact or conversation doesn't cascade-delete the
--     historical call record.
--   - `status` is kept as free TEXT (no CHECK): the exact set of
--     terminate statuses Meta emits for this new API isn't nailed down
--     yet, and a too-strict CHECK would drop real events. `raw` keeps the
--     full webhook object for forensics / fields we don't model yet.
--   - `created_by` deliberately absent — calls originate from Meta, not
--     a user.
--
-- Also widens messages.content_type to allow 'call', so a finalized call
-- shows inline in the existing inbox thread as a normal message row
-- (rendered as a call chip) without a separate timeline merge.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS call_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id  UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  wa_call_id       TEXT NOT NULL,
  direction        TEXT NOT NULL DEFAULT 'inbound'
                     CHECK (direction IN ('inbound', 'outbound')),
  -- e.g. 'ringing' (connect seen, not yet ended), 'completed', 'missed',
  -- 'declined', 'failed'. Free text on purpose — see banner.
  status           TEXT NOT NULL DEFAULT 'ringing',
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  raw              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, wa_call_id)
);

CREATE INDEX IF NOT EXISTS idx_call_logs_account_created
  ON call_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_conversation
  ON call_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact
  ON call_logs(contact_id);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Read-only in the app; writes are service-role only (webhook).
DROP POLICY IF EXISTS call_logs_select ON call_logs;
CREATE POLICY call_logs_select ON call_logs FOR SELECT
  USING (is_account_member(account_id));

DROP TRIGGER IF EXISTS set_updated_at ON call_logs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON call_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Allow 'call' as a message content_type so finalized calls appear
-- inline in the inbox thread. Widens the CHECK last set in migration
-- 010 (which added 'interactive'); re-added here with 'call'.
-- ============================================================
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive', 'call'
  ));


-- ------------------------------------------------------------
-- 051_account_trial.sql
-- ------------------------------------------------------------
-- ============================================================
-- 051_account_trial.sql — 14-day free trial on every account
--
-- Adds subscription/trial state to `accounts` (one subscription per
-- tenant, the unit everything is already scoped to). This pass covers
-- the FREE TRIAL only — paid plans and payment-provider linkage are
-- documented in docs/billing-and-trial.md and added later.
--
-- What this does
--   1. subscription_status_enum lifecycle type.
--   2. Four columns on accounts: plan, subscription_status,
--      trial_started_at, trial_ends_at.
--   3. Backfills EXISTING accounts to 'active' (grandfathered) so
--      current users/dev accounts are never trapped in an expired trial.
--   4. Replaces handle_new_user() so NEW signups start a 14-day trial
--      atomically with account creation.
--
-- Effective state is computed on read (see src/lib/billing/subscription.ts):
-- a 'trialing' row past trial_ends_at is treated as expired without needing
-- a cron. No enforcement lives in the DB — the app layer gates on it.
--
-- Idempotent: enum guarded by pg_type check; columns use IF NOT EXISTS;
-- the trigger/function are DROP-then-CREATE.
-- ============================================================

-- ---- (1) lifecycle enum ------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE subscription_status_enum AS ENUM (
      'trialing',   -- inside the free-trial window
      'active',     -- paid & current (also: grandfathered accounts)
      'past_due',   -- payment failed, grace period (paid plans, later)
      'canceled',   -- canceled; access until period end (later)
      'expired'     -- trial/subscription lapsed with no active plan
    );
  END IF;
END $$;

-- ---- (2) columns on accounts -------------------------------
-- Defaults describe a NEW trialing account; the trigger sets the trial
-- dates explicitly. Existing rows get the defaults from this ADD COLUMN,
-- then step (3) overrides them to grandfather.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS plan                TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status_enum NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at       TIMESTAMPTZ;

-- ---- (3) grandfather existing accounts ---------------------
-- Only touch rows that predate this migration: a fresh trialing row with
-- no trial dates set is an existing account (the trigger always sets
-- trial dates going forward). Guard on trial_started_at IS NULL so a
-- re-run doesn't re-stamp accounts created after this deployed.
UPDATE accounts
SET plan = 'grandfathered',
    subscription_status = 'active'
WHERE trial_started_at IS NULL
  AND subscription_status = 'trialing';

-- ---- (4) signup trigger: start the trial -------------------
-- Replaces the 017 version. Same account+profile bootstrap, now also
-- stamping a 14-day trial on the new account. Trial length is inlined
-- here and mirrored by TRIAL_DAYS in src/lib/billing/subscription.ts —
-- keep them in sync if it changes.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (
    name, owner_user_id,
    plan, subscription_status, trial_started_at, trial_ends_at
  )
  VALUES (
    COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id,
    'trial', 'trialing', NOW(), NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------
-- 052_quick_replies.sql
-- ------------------------------------------------------------
-- ============================================================
-- 052_quick_replies.sql — Canned agent replies ("quick replies")
--
-- Free-form snippets an agent fires off from the inbox by typing
-- `/shortcut`. NOT to be confused with Meta's template QUICK_REPLY
-- button type (message_templates) — these never touch Meta, they just
-- expand into the composer as ordinary text before sending.
--
-- The composer already advertised "Type '/' for quick replies" but no
-- backing feature existed; this migration adds it.
--
-- Design notes
--   - Account-scoped and SHARED across the team: one library per account,
--     not per agent. `user_id` records who created the row (audit only)
--     and is ON DELETE SET NULL so removing a teammate keeps their
--     snippets.
--   - `shortcut` is the token typed after `/`, so it must be a single
--     word — the CHECK enforces [a-z0-9_-] and the composer's regex
--     matches the same shape.
--   - UNIQUE on (account_id, lower(shortcut)) so `/Thanks` and `/thanks`
--     can't both exist and the autocomplete never has to disambiguate.
--   - RLS mirrors the operational tier (contacts/conversations): any
--     member may read; agent+ may create/edit/delete.
--
-- Idempotent — IF NOT EXISTS throughout; policies dropped before create.
-- ============================================================

CREATE TABLE IF NOT EXISTS quick_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Creator, for audit. Nullable so deleting a user doesn't cascade-drop
  -- a snippet the rest of the team relies on.
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shortcut   TEXT NOT NULL CHECK (
               shortcut ~ '^[A-Za-z0-9_-]{1,32}$'
             ),
  body       TEXT NOT NULL CHECK (
               char_length(body) BETWEEN 1 AND 4096
             ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One shortcut per account, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_account_shortcut
  ON quick_replies(account_id, lower(shortcut));

CREATE INDEX IF NOT EXISTS idx_quick_replies_account
  ON quick_replies(account_id);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON quick_replies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quick_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- RLS: read = any member; write = agent+ ----------------
DROP POLICY IF EXISTS quick_replies_select ON quick_replies;
DROP POLICY IF EXISTS quick_replies_insert ON quick_replies;
DROP POLICY IF EXISTS quick_replies_update ON quick_replies;
DROP POLICY IF EXISTS quick_replies_delete ON quick_replies;

CREATE POLICY quick_replies_select ON quick_replies FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY quick_replies_insert ON quick_replies FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY quick_replies_update ON quick_replies FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY quick_replies_delete ON quick_replies FOR DELETE
  USING (is_account_member(account_id, 'agent'));


-- ------------------------------------------------------------
-- 053_support_tickets.sql
-- ------------------------------------------------------------
-- ============================================================
-- 053_support_tickets.sql — In-app support ticketing
--
-- A lightweight helpdesk: a tenant raises a ticket from the sidebar
-- "Support" modal, and the conversation is a thread of messages. Two
-- author roles:
--   - 'user'    — written by an account member (the customer)
--   - 'support' — written by the product team, inserted server-side with
--                 the service role (bypasses RLS). Users are barred from
--                 forging a 'support' message by the messages INSERT policy.
--
-- Unread signal: `last_support_reply_at` vs `user_last_read_at` on the
-- ticket. When support has replied more recently than the user last opened
-- the ticket, the sidebar shows an alert dot. The app stamps
-- `user_last_read_at = now()` when the ticket is opened.
--
-- Design notes
--   - Account-scoped and shared across the team (one queue per account);
--     `user_id` records the author for audit and is ON DELETE SET NULL so
--     removing a teammate keeps the thread intact.
--   - `account_id` is denormalized onto messages so RLS is a direct
--     is_account_member() check rather than a parent subquery.
--   - Denormalized `last_message_at` / `last_support_reply_at` are kept
--     current by an AFTER INSERT trigger, so they stay correct even when a
--     'support' reply arrives via the service role.
--
-- Idempotent — IF NOT EXISTS throughout; policies dropped before create.
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Creator, for audit. Nullable so deleting a user doesn't drop the ticket.
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject               TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  category              TEXT NOT NULL DEFAULT 'general' CHECK (
                          category IN ('general', 'billing', 'technical', 'feature', 'other')
                        ),
  priority              TEXT NOT NULL DEFAULT 'normal' CHECK (
                          priority IN ('low', 'normal', 'high')
                        ),
  status                TEXT NOT NULL DEFAULT 'open' CHECK (
                          status IN ('open', 'pending', 'resolved', 'closed')
                        ),
  -- Maintained by the touch trigger below.
  last_message_at       TIMESTAMPTZ,
  last_support_reply_at TIMESTAMPTZ,
  -- Stamped by the app when the user opens the ticket; drives the unread dot.
  user_last_read_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_account
  ON support_tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_account_updated
  ON support_tickets(account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  -- Denormalized from the parent ticket so RLS stays a direct membership
  -- check; the app/service-role writer sets it to the ticket's account_id.
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('user', 'support')),
  -- Author, for audit. NULL for 'support' messages (product team).
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket
  ON support_ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_account
  ON support_ticket_messages(account_id);

-- ---- Touch trigger: keep the ticket's denormalized timestamps fresh -------
-- Runs for both 'user' and 'support' inserts. A 'support' insert also
-- advances last_support_reply_at, which is what the unread dot compares
-- against user_last_read_at.
CREATE OR REPLACE FUNCTION support_ticket_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE support_tickets
     SET last_message_at = NEW.created_at,
         last_support_reply_at = CASE
           WHEN NEW.author_role = 'support' THEN NEW.created_at
           ELSE last_support_reply_at
         END,
         updated_at = NOW()
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_ticket_touch ON support_ticket_messages;
CREATE TRIGGER support_ticket_touch
  AFTER INSERT ON support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION support_ticket_touch();

DROP TRIGGER IF EXISTS set_updated_at ON support_tickets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- RLS ------------------------------------------------------------------
ALTER TABLE support_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: any member of the account may read, raise, and update (the
-- update path covers stamping user_last_read_at and closing a ticket).
-- Deletion is admin+ only.
DROP POLICY IF EXISTS support_tickets_select ON support_tickets;
DROP POLICY IF EXISTS support_tickets_insert ON support_tickets;
DROP POLICY IF EXISTS support_tickets_update ON support_tickets;
DROP POLICY IF EXISTS support_tickets_delete ON support_tickets;

CREATE POLICY support_tickets_select ON support_tickets FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY support_tickets_insert ON support_tickets FOR INSERT
  WITH CHECK (is_account_member(account_id));
CREATE POLICY support_tickets_update ON support_tickets FOR UPDATE
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));
CREATE POLICY support_tickets_delete ON support_tickets FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Messages: members read the thread and post their own ('user') messages.
-- The author_role = 'user' guard means a tenant can never insert a message
-- that impersonates the support team — those arrive only via the service
-- role, which bypasses RLS. Messages are immutable (no update/delete policy).
DROP POLICY IF EXISTS support_ticket_messages_select ON support_ticket_messages;
DROP POLICY IF EXISTS support_ticket_messages_insert ON support_ticket_messages;

CREATE POLICY support_ticket_messages_select ON support_ticket_messages FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY support_ticket_messages_insert ON support_ticket_messages FOR INSERT
  WITH CHECK (is_account_member(account_id) AND author_role = 'user');

-- ---- Realtime: live unread dot on the sidebar Support button --------------
-- The useSupportUnread hook subscribes to support_tickets changes. Add the
-- table to the realtime publication (guarded/idempotent) and set REPLICA
-- IDENTITY FULL so RLS-filtered UPDATE/DELETE events carry the whole old row
-- (see migration 028 for why the partial default breaks policy evaluation).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
  END IF;
END $$;

ALTER TABLE support_tickets REPLICA IDENTITY FULL;


-- ------------------------------------------------------------
-- 054_billing.sql
-- ------------------------------------------------------------
-- ============================================================
-- 054_billing.sql — admin-managed pricing + per-account billing
--
-- First billing pass: PRICING + SUBSCRIPTION management (manual). No
-- payment provider yet — the admin sets an account's plan, price, billing
-- interval, and current period by hand. Razorpay linkage comes later; the
-- columns here (amount in minor units, currency, interval, period window)
-- are shaped to map cleanly onto a provider subscription when it lands.
--
-- What this adds
--   1. billing_plans — the priced plan catalog, editable from the admin
--      panel (so pricing changes need no redeploy). Keyed by a stable
--      plan key that mirrors src/lib/billing/plans.ts.
--   2. Six columns on accounts describing the account's CURRENT billing:
--      chosen plan key, agreed amount (snapshot, so later price changes
--      don't silently re-bill existing accounts), currency, interval, and
--      the current period start/end.
--
-- Money is stored in MINOR UNITS (paise/cents) as an integer — never
-- floats — so totals are exact.
--
-- RLS
--   billing_plans: any authenticated user may read ACTIVE plans (the app's
--   pricing page can show them); only the service role writes (the admin
--   panel uses the service-role client, which bypasses RLS). The account
--   billing columns live on `accounts`, which already has its own RLS.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) plan catalog --------------------------------------
CREATE TABLE IF NOT EXISTS billing_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,          -- 'starter' | 'pro' | 'business' | …
  name        text NOT NULL,
  description text,
  amount      integer NOT NULL DEFAULT 0     -- minor units (e.g. paise)
                CHECK (amount >= 0),
  currency    text NOT NULL DEFAULT 'INR',
  interval    text NOT NULL DEFAULT 'monthly'
                CHECK (interval IN ('monthly', 'yearly')),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may read active plans (pricing display). Writes have
-- no policy, so they're denied under RLS — only the service-role admin
-- client (which bypasses RLS) can change pricing.
DROP POLICY IF EXISTS billing_plans_select ON billing_plans;
CREATE POLICY billing_plans_select ON billing_plans FOR SELECT
  USING (is_active OR auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.update_billing_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_plans_updated_at ON billing_plans;
CREATE TRIGGER billing_plans_updated_at
  BEFORE UPDATE ON billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_plans_updated_at();

-- Seed the three tiers (mirrors src/lib/billing/plans.ts). Placeholder
-- INR pricing — edit it from Admin → Plans. ON CONFLICT DO NOTHING so a
-- re-run never clobbers prices the operator has since edited.
INSERT INTO billing_plans (key, name, description, amount, currency, interval, sort_order)
VALUES
  ('starter',  'Starter',  'For getting started on WhatsApp',  49900, 'INR', 'monthly', 1),
  ('pro',      'Pro',      'For growing teams',                99900, 'INR', 'monthly', 2),
  ('business', 'Business', 'For scale',                       249900, 'INR', 'monthly', 3)
ON CONFLICT (key) DO NOTHING;

-- ---- (2) per-account billing columns -----------------------
-- The account's CURRENT billing arrangement. `billing_amount` is a
-- snapshot of the agreed price at assignment time (independent of later
-- catalog edits). All nullable — an account on trial / grandfathered has
-- no paid billing set.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS billing_plan_key      text,
  ADD COLUMN IF NOT EXISTS billing_amount        integer CHECK (billing_amount IS NULL OR billing_amount >= 0),
  ADD COLUMN IF NOT EXISTS billing_currency      text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS billing_interval      text CHECK (billing_interval IS NULL OR billing_interval IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS current_period_start  timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end    timestamptz;


-- ------------------------------------------------------------
-- 055_invoices.sql
-- ------------------------------------------------------------
-- ============================================================
-- 055_invoices.sql — manual invoices / billing history
--
-- Builds on 054 (pricing + per-account billing). An admin records a
-- payment as an invoice against an account; the tenant sees its own
-- invoices in Settings → Plan and can open a printable copy. Still
-- MANUAL — no payment provider. When Razorpay lands, its webhook can
-- insert rows here with the same shape (amount in minor units, a status,
-- a period window), so this table is the durable billing ledger either
-- way.
--
-- Numbering
--   invoice_number is human-facing (INV-000001) and assigned by a BEFORE
--   INSERT trigger off a dedicated sequence — atomic, gap-tolerant, and
--   never colliding under concurrency.
--
-- RLS
--   SELECT: any account member may read THEIR account's invoices (the
--   Plan tab lists them). No INSERT/UPDATE/DELETE policy — invoices are
--   written only by the service-role admin client (which bypasses RLS),
--   so tenants can read but never forge or alter their own billing.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_number    text UNIQUE,                    -- set by trigger (INV-000001)
  plan_key          text,                           -- snapshot of the billed plan, if any
  description       text NOT NULL,
  amount            integer NOT NULL CHECK (amount >= 0),   -- minor units (paise/cents)
  currency          text NOT NULL DEFAULT 'INR',
  status            text NOT NULL DEFAULT 'due'
                      CHECK (status IN ('due', 'paid', 'void')),
  period_start      timestamptz,
  period_end        timestamptz,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  due_date          timestamptz,
  paid_at           timestamptz,
  payment_method    text,                           -- 'bank_transfer' | 'upi' | 'cash' | 'card' | …
  payment_reference text,                           -- txn id / cheque no / note
  notes             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_account_id_idx ON invoices (account_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_issued_at_idx ON invoices (issued_at DESC);

-- ---- invoice number + updated_at triggers ------------------
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_set_number ON invoices;
CREATE TRIGGER invoices_set_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_number();

CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoices_updated_at();

-- ---- RLS ---------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Members read their own account's invoices. Writes have no policy, so
-- they're denied under RLS — only the service-role admin client writes.
DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select ON invoices FOR SELECT
  USING (is_account_member(account_id));


-- ------------------------------------------------------------
-- 056_admin_notifications.sql
-- ------------------------------------------------------------
-- ============================================================
-- 056_admin_notifications.sql — global / targeted announcements
--
-- Lets an operator push a notification from the admin panel that shows up
-- in tenants' header bell alongside the derived feed (unread messages, AI
-- handoffs, template verdicts, campaigns — see /api/notifications).
--
-- Audience
--   'all'      → every account sees it (a global announcement).
--   'account'  → only the named account_id sees it (a targeted notice).
--
-- Lifecycle: is_active toggles visibility without deleting; expires_at
-- (optional) auto-hides it. Both are enforced in the RLS SELECT policy so
-- the tenant feed query stays trivial.
--
-- RLS
--   SELECT: any authenticated member may read an announcement that is
--   active, not expired, and either global or scoped to an account they
--   belong to. No INSERT/UPDATE/DELETE policy — only the service-role
--   admin client writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  href        text,                       -- optional in-app link
  audience    text NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'account')),
  account_id  uuid REFERENCES accounts(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- A targeted announcement must name its account; a global one must not.
  CONSTRAINT admin_notifications_audience_account_ck
    CHECK ((audience = 'all' AND account_id IS NULL)
        OR (audience = 'account' AND account_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx
  ON admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_account_id_idx
  ON admin_notifications (account_id);

CREATE OR REPLACE FUNCTION public.update_admin_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_notifications_updated_at ON admin_notifications;
CREATE TRIGGER admin_notifications_updated_at
  BEFORE UPDATE ON admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_admin_notifications_updated_at();

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Members read active, non-expired announcements addressed to them (global
-- or their account). Writes have no policy → service-role admin only.
DROP POLICY IF EXISTS admin_notifications_select ON admin_notifications;
CREATE POLICY admin_notifications_select ON admin_notifications FOR SELECT
  USING (
    is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND (audience = 'all' OR is_account_member(account_id))
  );


-- ------------------------------------------------------------
-- 057_admin_notification_image.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 058_billing_plan_details.sql
-- ------------------------------------------------------------
-- ============================================================
-- 058_billing_plan_details.sql — richer, admin-created plans
--
-- Extends billing_plans (054) so the admin can build DETAILED plans
-- (feature list, tagline, "featured" highlight) and create new ones,
-- instead of only editing the three seeded tiers.
--
--   tagline      short subtitle under the name
--   features     jsonb array of bullet strings
--   is_featured  visually highlight this plan (e.g. "Popular")
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS tagline     text,
  ADD COLUMN IF NOT EXISTS features    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;


-- ------------------------------------------------------------
-- 059_app_popups.sql
-- ------------------------------------------------------------
-- ============================================================
-- 059_app_popups.sql — admin-managed splash popup on app load
--
-- A modal the tenant sees when they open the app. One flexible record
-- covers every content combination the brief asked for:
--   text, image, image + text, a YouTube video, and a link/CTA.
--
-- Audience / lifecycle mirror admin_notifications (056): 'all' vs a
-- single 'account', gated by is_active + an optional [starts_at,
-- expires_at] window, all enforced in the RLS SELECT policy. Per-popup
-- dismissal is tracked client-side (localStorage by id), so there's no
-- read-state table.
--
-- RLS
--   SELECT: any authenticated member may read a live popup addressed to
--   them. No write policy — only the service-role admin client writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_popups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  body        text,
  image_url   text,
  youtube_url text,
  link_url    text,
  link_label  text,
  audience    text NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'account')),
  account_id  uuid REFERENCES accounts(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  starts_at   timestamptz,
  expires_at  timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_popups_audience_account_ck
    CHECK ((audience = 'all' AND account_id IS NULL)
        OR (audience = 'account' AND account_id IS NOT NULL)),
  -- A popup must carry at least one piece of content.
  CONSTRAINT app_popups_has_content
    CHECK (coalesce(title, '') <> ''
        OR coalesce(body, '') <> ''
        OR coalesce(image_url, '') <> ''
        OR coalesce(youtube_url, '') <> '')
);

CREATE INDEX IF NOT EXISTS app_popups_created_at_idx
  ON app_popups (created_at DESC);
CREATE INDEX IF NOT EXISTS app_popups_account_id_idx
  ON app_popups (account_id);

CREATE OR REPLACE FUNCTION public.update_app_popups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_popups_updated_at ON app_popups;
CREATE TRIGGER app_popups_updated_at
  BEFORE UPDATE ON app_popups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_popups_updated_at();

ALTER TABLE app_popups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_popups_select ON app_popups;
CREATE POLICY app_popups_select ON app_popups FOR SELECT
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND (audience = 'all' OR is_account_member(account_id))
  );


-- ------------------------------------------------------------
-- 060_webhooks.sql
-- ------------------------------------------------------------
-- ============================================================
-- 060_webhooks.sql — outbound webhooks + teardown of the old
-- appointment integration.
--
-- Part A drops account_settings (029), which only ever backed the removed
-- "appointment notification" integration. Part B adds the outbound
-- webhooks platform: per-account endpoints the tenant registers, and a
-- delivery queue the cron dispatcher drains with retries.
--
-- Events fan out to every active endpoint subscribed to the event type;
-- each delivery is HMAC-signed with the endpoint's secret so the receiver
-- can verify authenticity. This is the layer that makes the app work with
-- Zapier / Make / n8n and any custom backend.
--
-- RLS: settings-class. Members of an account read its endpoints +
-- deliveries; only admins create/update/delete endpoints. The dispatcher
-- and emit paths run under the service-role client (no auth.uid()).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (A) remove the old integration's table ----------------
DROP TABLE IF EXISTS account_settings;

-- ---- (B1) endpoints ----------------------------------------
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text NOT NULL DEFAULT 'Webhook',
  url         text NOT NULL,
  -- HMAC signing secret, AES-256-GCM-encrypted at rest (same encrypt()
  -- as WhatsApp tokens). Decrypted at send time to sign; revealable to
  -- the account so they can verify signatures on their end.
  secret      text NOT NULL,
  -- Subscribed event types (e.g. {message.received, contact.created}).
  events      text[] NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_account_id_idx
  ON webhook_endpoints (account_id);

CREATE OR REPLACE FUNCTION public.update_webhook_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_webhook_endpoints_updated_at();

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_endpoints_select ON webhook_endpoints;
CREATE POLICY webhook_endpoints_select ON webhook_endpoints FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS webhook_endpoints_insert ON webhook_endpoints;
CREATE POLICY webhook_endpoints_insert ON webhook_endpoints FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS webhook_endpoints_update ON webhook_endpoints;
CREATE POLICY webhook_endpoints_update ON webhook_endpoints FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS webhook_endpoints_delete ON webhook_endpoints;
CREATE POLICY webhook_endpoints_delete ON webhook_endpoints FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ---- (B2) delivery queue / log -----------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'success', 'failed')),
  attempts        integer NOT NULL DEFAULT 0,
  response_status integer,
  error           text,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- The dispatcher polls for due, still-pending rows.
CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON webhook_deliveries (next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS webhook_deliveries_account_idx
  ON webhook_deliveries (account_id, created_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Members may read their account's delivery log (observability). Writes
-- are service-role only (emit + dispatcher), so there's no write policy.
DROP POLICY IF EXISTS webhook_deliveries_select ON webhook_deliveries;
CREATE POLICY webhook_deliveries_select ON webhook_deliveries FOR SELECT
  USING (is_account_member(account_id));


-- ------------------------------------------------------------
-- 061_app_announcements.sql
-- ------------------------------------------------------------
-- ============================================================
-- 061_app_announcements.sql — admin-managed announcement bar
--
-- A slim bar shown directly under the dashboard navbar to surface
-- important, time-boxed messages: plan-expiry reminders, scheduled
-- maintenance, a new blog post, product news/updates, etc.
--
-- One flexible record: a message, an optional link/CTA, and a
-- `variant` that drives the bar's severity styling (info / success /
-- warning / critical). Audience / lifecycle mirror app_popups (059):
-- 'all' vs a single 'account', gated by is_active + an optional
-- [starts_at, expires_at] window, all enforced in the RLS SELECT
-- policy. Per-bar dismissal is tracked client-side (localStorage by
-- id), so there's no read-state table.
--
-- RLS
--   SELECT: any authenticated member may read a live bar addressed to
--   them. No write policy — only the service-role admin client writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message     text NOT NULL,
  link_url    text,
  link_label  text,
  variant     text NOT NULL DEFAULT 'info'
                CHECK (variant IN ('info', 'success', 'warning', 'critical')),
  dismissible boolean NOT NULL DEFAULT true,
  audience    text NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'account')),
  account_id  uuid REFERENCES accounts(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  starts_at   timestamptz,
  expires_at  timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_announcements_audience_account_ck
    CHECK ((audience = 'all' AND account_id IS NULL)
        OR (audience = 'account' AND account_id IS NOT NULL)),
  -- A bar must carry a non-empty message.
  CONSTRAINT app_announcements_has_message
    CHECK (coalesce(message, '') <> '')
);

CREATE INDEX IF NOT EXISTS app_announcements_created_at_idx
  ON app_announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS app_announcements_account_id_idx
  ON app_announcements (account_id);

CREATE OR REPLACE FUNCTION public.update_app_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_announcements_updated_at ON app_announcements;
CREATE TRIGGER app_announcements_updated_at
  BEFORE UPDATE ON app_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_announcements_updated_at();

ALTER TABLE app_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_announcements_select ON app_announcements;
CREATE POLICY app_announcements_select ON app_announcements FOR SELECT
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (expires_at IS NULL OR expires_at > now())
    AND (audience = 'all' OR is_account_member(account_id))
  );


-- ------------------------------------------------------------
-- 062_plan_entitlements.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 063_blog_posts.sql
-- ------------------------------------------------------------
-- ============================================================
-- 063_blog_posts.sql — marketing-site blog, managed from the admin panel
--
-- Posts are authored in the admin back office (Medium-style editor,
-- content stored as sanitized-by-trust HTML — only ADMIN_EMAILS admins
-- can write) and rendered on the public marketing site at /blog and
-- /blog/[slug].
--
-- RLS
--   SELECT: anyone (including anon — the marketing site is public) may
--   read PUBLISHED posts. Drafts are invisible outside the admin panel.
--   No write policy — only the service-role admin client writes.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  excerpt         text,
  content_html    text NOT NULL DEFAULT '',
  cover_image_url text,
  author_name     text,
  tags            text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  published_at    timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_slug_shape CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx
  ON blog_posts (status, published_at DESC);

CREATE OR REPLACE FUNCTION public.update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blog_posts_updated_at ON blog_posts;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_posts_updated_at();

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blog_posts_public_read ON blog_posts;
CREATE POLICY blog_posts_public_read ON blog_posts FOR SELECT
  USING (status = 'published');


-- ------------------------------------------------------------
-- 064_system_health.sql
-- ------------------------------------------------------------
-- ============================================================
-- 064_system_health.sql — admin System Health console plumbing
--
-- Two things:
--   1. system_cron_heartbeats — one row per background job; each cron
--      run upserts its liveness (last run, status, duration, detail,
--      rolling counters) via record_cron_heartbeat(). Lets the admin
--      console tell a healthy cron from a silently-dead one.
--   2. A set of SECURITY DEFINER metric functions that expose
--      Postgres/storage/auth internals (database size, table sizes,
--      per-bucket storage usage, auth user stats) as jsonb. These read
--      pg_catalog / storage / auth, which normal roles can't — so they
--      run as the definer and are LOCKED to the service role (REVOKE
--      from public, GRANT to service_role). Only the admin back office
--      (service-role client) can call them; a tenant cannot.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- (1) cron heartbeats -----------------------------------
CREATE TABLE IF NOT EXISTS system_cron_heartbeats (
  job_key          text PRIMARY KEY,
  last_run_at      timestamptz NOT NULL DEFAULT now(),
  last_status      text NOT NULL DEFAULT 'ok'
                     CHECK (last_status IN ('ok', 'error')),
  last_duration_ms integer,
  last_detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error       text,
  run_count        bigint NOT NULL DEFAULT 0,
  error_count      bigint NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS on with NO policies ⇒ tenants can't read it; the service-role
-- admin client bypasses RLS.
ALTER TABLE system_cron_heartbeats ENABLE ROW LEVEL SECURITY;

-- Atomic upsert of a job's heartbeat, incrementing the rolling counters.
CREATE OR REPLACE FUNCTION public.record_cron_heartbeat(
  p_job_key     text,
  p_status      text,
  p_duration_ms integer,
  p_detail      jsonb,
  p_error       text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO system_cron_heartbeats AS h (
    job_key, last_run_at, last_status, last_duration_ms, last_detail,
    last_error, run_count, error_count, updated_at
  )
  VALUES (
    p_job_key, now(),
    CASE WHEN p_status = 'error' THEN 'error' ELSE 'ok' END,
    p_duration_ms, coalesce(p_detail, '{}'::jsonb), p_error,
    1, CASE WHEN p_status = 'error' THEN 1 ELSE 0 END, now()
  )
  ON CONFLICT (job_key) DO UPDATE SET
    last_run_at      = now(),
    last_status      = excluded.last_status,
    last_duration_ms = excluded.last_duration_ms,
    last_detail      = excluded.last_detail,
    last_error       = excluded.last_error,
    run_count        = h.run_count + 1,
    error_count      = h.error_count
                         + CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    updated_at       = now();
$$;

REVOKE ALL ON FUNCTION public.record_cron_heartbeat(text, text, integer, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_cron_heartbeat(text, text, integer, jsonb, text) TO service_role;

-- ---- (2) metric functions (service-role only) --------------

-- Database: size, connection load, version.
CREATE OR REPLACE FUNCTION public.admin_database_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'size_bytes', pg_database_size(current_database()),
    'active_connections',
      (SELECT count(*) FROM pg_stat_activity
        WHERE datname = current_database()),
    'max_connections', current_setting('max_connections')::int,
    'postgres_version', current_setting('server_version')
  );
$$;

REVOKE ALL ON FUNCTION public.admin_database_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_database_metrics() TO service_role;

-- Largest public tables by total (heap+indexes+toast) size, with the
-- planner's row estimate (cheap; exact counts would scan every table).
CREATE OR REPLACE FUNCTION public.admin_table_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'name', c.relname,
      'bytes', pg_total_relation_size(c.oid),
      'est_rows', GREATEST(c.reltuples, 0)::bigint
    ) AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 12
  ) sub;
$$;

REVOKE ALL ON FUNCTION public.admin_table_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_table_metrics() TO service_role;

-- Storage usage per bucket (object count + summed byte size).
CREATE OR REPLACE FUNCTION public.admin_storage_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT coalesce(jsonb_agg(b ORDER BY (b->>'bytes')::bigint DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'bucket', o.bucket_id,
      'objects', count(*),
      'bytes', coalesce(sum((o.metadata->>'size')::bigint), 0)
    ) AS b
    FROM storage.objects o
    GROUP BY o.bucket_id
  ) s;
$$;

REVOKE ALL ON FUNCTION public.admin_storage_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_storage_metrics() TO service_role;

-- Auth: user totals, confirmation, recency.
CREATE OR REPLACE FUNCTION public.admin_auth_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'confirmed', count(*) FILTER (WHERE email_confirmed_at IS NOT NULL),
    'unconfirmed', count(*) FILTER (WHERE email_confirmed_at IS NULL),
    'new_24h', count(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    'new_7d', count(*) FILTER (WHERE created_at > now() - interval '7 days'),
    'active_24h', count(*) FILTER (WHERE last_sign_in_at > now() - interval '24 hours')
  )
  FROM auth.users;
$$;

REVOKE ALL ON FUNCTION public.admin_auth_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_auth_metrics() TO service_role;
