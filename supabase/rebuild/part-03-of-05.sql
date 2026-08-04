-- ============================================================
-- REBUILD BUNDLE 3 of 5
--
-- Paste this whole file into the Supabase SQL editor and Run.
-- Run the parts IN ORDER. Each part must succeed before the next.
--
-- Contains these migrations, in order:
--   025_filter_contacts_by_tags.sql
--   025_presence_offline.sql
--   026_whatsapp_config_registration_pin.sql
--   027_conversation_dedup.sql
--   028_realtime_replica_identity.sql
--   029_api_keys.sql
--   030_contacts_spam.sql
--   031_conversation_customer_replied_at.sql
--   032_filter_contacts_by_tags_created_at.sql
--   033_contacts_address.sql
--   034_contacts_mute_block.sql
--   035_conversation_assigned_flow.sql
--   036_media_library.sql
--   037_template_carousel.sql
--   038_ai_configs.sql
--   039_ai_autoreply.sql
--   040_ai_knowledge.sql
--   041_ai_agent_assignment.sql
--   042_contact_lists.sql
--   043_segments.sql
--   044_contact_dob.sql
-- ============================================================

-- ------------------------------------------------------------
-- 025_filter_contacts_by_tags.sql
-- ------------------------------------------------------------
-- ============================================================
-- 025_filter_contacts_by_tags.sql — server-side tag filter
--
-- Why an RPC
--
--   The Contacts page filters by tag by resolving the selected
--   tags to contact ids and paging the result. Doing that on the
--   client (SELECT contact_id FROM contact_tags WHERE tag_id IN …,
--   then .in('id', ids) on contacts) hits two PostgREST limits for
--   accounts where a tag covers many contacts:
--     - the unbounded contact_tags select is silently capped
--       (~1000 rows), dropping contacts from the filter, and
--     - the follow-up .in('id', ids) pushes every matching id into
--       one IN-clause (the ~1000-value cap the broadcast sender
--       already pages around) and bloats the request URL.
--
--   Both break the total count and pagination. This function does
--   the join, de-duplication (OR across tags), ordering, windowed
--   total count, and LIMIT/OFFSET in one query so the result is
--   always complete and correctly counted.
--
-- Security
--
--   SECURITY INVOKER (the default): the function runs as the
--   caller, so the existing RLS on `contacts` and `contact_tags`
--   (account membership, migration 017) scopes the result to the
--   caller's account. No privilege bypass — unlike the SECURITY
--   DEFINER member RPCs in 018/019.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.filter_contacts_by_tags(
  p_tag_ids UUID[],
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (contact contacts, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matched AS (
    -- Distinct contacts having ANY of the selected tags (OR),
    -- narrowed by the same name/phone/email search as the list.
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

ALTER FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT) TO authenticated;


-- ------------------------------------------------------------
-- 025_presence_offline.sql
-- ------------------------------------------------------------
-- ============================================================
-- 025_presence_offline.sql — manual "unavailable" presence
--
-- Adds an explicit 'offline' stored status so a member can mark
-- themselves unavailable from the account menu while their tab is
-- still open. Previously 'offline' was ONLY ever derived from
-- staleness (migration 024); there was no way to appear offline
-- on purpose.
--
-- The heartbeat now reports 'offline' while the member toggles
-- availability off, and viewers render that immediately (no 75s
-- staleness wait). Toggling back on resumes 'online'/'away'.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ---- widen the status CHECK to include 'offline' -----------
ALTER TABLE member_presence
  DROP CONSTRAINT IF EXISTS member_presence_status_check;

ALTER TABLE member_presence
  ADD CONSTRAINT member_presence_status_check
  CHECK (status IN ('online', 'away', 'offline'));

-- ---- heartbeat RPC: accept 'offline' -----------------------
-- Same body as migration 024 with the validation list widened.
CREATE OR REPLACE FUNCTION public.touch_presence(
  p_status TEXT DEFAULT 'online'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('online', 'away', 'offline') THEN
    RAISE EXCEPTION 'Invalid presence status: %', p_status
      USING ERRCODE = '22023';
  END IF;

  SELECT account_id INTO v_account_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No account for caller' USING ERRCODE = '22023';
  END IF;

  INSERT INTO member_presence (user_id, account_id, status, last_seen_at)
  VALUES (auth.uid(), v_account_id, p_status, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status       = excluded.status,
        last_seen_at = now(),
        account_id   = excluded.account_id;
END;
$$;


-- ------------------------------------------------------------
-- 026_whatsapp_config_registration_pin.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 027_conversation_dedup.sql
-- ------------------------------------------------------------
-- ============================================================
-- 027_conversation_dedup
--
-- Guarantee ONE conversation per (account, contact).
--
-- The WhatsApp webhook assumes a single conversation thread per
-- contact, but nothing in the database enforced it. A race between two
-- near-simultaneous inbound messages (each looking up "no conversation
-- yet" and both inserting) could create a duplicate pair; once two
-- existed, the webhook's old `.single()` lookup raised PGRST116 on every
-- later message and created yet another — a runaway that surfaced as
-- "every message starts a new chat with the same number".
--
-- The handler is now tolerant (reuses the oldest thread), but that only
-- stops growth. This migration, in order, mirrors 022_contact_phone_dedup:
--   1. merges existing duplicate conversations into the oldest row,
--      re-pointing all child records first so nothing is lost;
--   2. refreshes the surviving thread's denormalized last-message fields;
--   3. adds a UNIQUE index on (account_id, contact_id) so the race can
--      never recreate a duplicate.
--
-- No data loss — messages, reactions, deals, and flow runs on a losing
-- conversation are re-pointed to the survivor before it is deleted
-- (messages + message_reactions are ON DELETE CASCADE, so the re-point
-- is what saves them).
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_duplicate_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group    RECORD;
  v_survivor UUID;
  v_losers   UUID[];
  v_merged   INTEGER := 0;
BEGIN
  FOR v_group IN
    SELECT account_id,
           contact_id,
           array_agg(id ORDER BY created_at ASC, id ASC) AS ids
    FROM conversations
    GROUP BY account_id, contact_id
    HAVING count(*) > 1
  LOOP
    v_survivor := v_group.ids[1];
    v_losers   := v_group.ids[2:array_length(v_group.ids, 1)];

    -- Re-point children to the survivor BEFORE deleting the losers.
    -- messages + message_reactions are ON DELETE CASCADE (without this
    -- re-point they'd be destroyed); deals has no cascade (a delete
    -- would fail its FK); flow_runs is ON DELETE SET NULL. None of these
    -- have a conversation-scoped unique constraint, so a plain re-point
    -- is safe.
    UPDATE messages          SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE message_reactions SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE deals             SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE flow_runs         SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);

    DELETE FROM conversations WHERE id = ANY(v_losers);

    v_merged := v_merged + COALESCE(array_length(v_losers, 1), 0);
  END LOOP;

  -- Refresh denormalized last-message fields on every thread that has
  -- messages, so a merged survivor's inbox row reflects the combined
  -- history rather than a stale value from before the merge.
  UPDATE conversations c SET
    last_message_at   = m.max_created,
    last_message_text = m.last_text,
    updated_at        = NOW()
  FROM (
    SELECT DISTINCT ON (conversation_id)
           conversation_id,
           created_at AS max_created,
           COALESCE(content_text, '[' || content_type || ']') AS last_text
    FROM messages
    ORDER BY conversation_id, created_at DESC
  ) m
  WHERE m.conversation_id = c.id;

  RETURN v_merged;
END;
$$;

ALTER FUNCTION public.merge_duplicate_conversations() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.merge_duplicate_conversations() FROM PUBLIC;

-- Collapse whatever duplicates exist right now.
SELECT public.merge_duplicate_conversations();

-- Authoritative guarantee: one conversation per (account, contact).
-- Partial (account_id IS NOT NULL) because legacy rows predate the
-- account_id column added in 017; the merge above already collapsed
-- any NULL-account duplicates by grouping NULLs together.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_account_contact
  ON conversations (account_id, contact_id)
  WHERE account_id IS NOT NULL;


-- ------------------------------------------------------------
-- 028_realtime_replica_identity.sql
-- ------------------------------------------------------------
-- ============================================================
-- 028_realtime_replica_identity
--
-- Make inbox Realtime reliable under RLS.
--
-- Supabase Realtime evaluates each table's RLS SELECT policy against
-- the changed row before delivering it to a subscribed client. Since
-- 017_account_sharing, those policies reference NON-primary-key columns:
--
--   messages_select      -> messages.conversation_id (joins conversations)
--   conversations policy -> conversations.account_id
--
-- With the default REPLICA IDENTITY (primary key only), UPDATE and
-- DELETE WAL records carry just the PK in their `old` image — so
-- Realtime can't see conversation_id / account_id to authorize the row,
-- and silently DROPS the event for RLS-restricted clients. That's why
-- the inbox was flaky: message INSERTs (full row in WAL) mostly arrived,
-- but the conversation-list "new message" bump (an UPDATE) often didn't.
--
-- REPLICA IDENTITY FULL logs the complete old row in WAL, so the policy
-- can always be evaluated and every event is delivered. Cost is a little
-- extra WAL volume on these tables — negligible at inbox scale.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE messages          REPLICA IDENTITY FULL;
ALTER TABLE conversations     REPLICA IDENTITY FULL;
ALTER TABLE message_reactions REPLICA IDENTITY FULL;


-- ------------------------------------------------------------
-- 029_api_keys.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 030_contacts_spam.sql
-- ------------------------------------------------------------
-- ============================================================
-- 030_contacts_spam.sql — "Mark as Spam" flag on contacts
--
-- Adds a per-contact spam flag, toggled from the inbox contact
-- detail panel. Account members (agent+) can flip it via the
-- existing contacts_update RLS policy (migration 017) — no new
-- policy needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_spam BOOLEAN NOT NULL DEFAULT false;

-- Partial index so a future "hide spam" filter stays cheap; only
-- indexes the (typically small) set of flagged contacts.
CREATE INDEX IF NOT EXISTS contacts_is_spam_idx
  ON contacts(account_id)
  WHERE is_spam;


-- ------------------------------------------------------------
-- 031_conversation_customer_replied_at.sql
-- ------------------------------------------------------------
-- Track when the customer last sent a message so the inbox can show
-- the remaining WhatsApp 24-hour messaging window.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS customer_replied_at TIMESTAMPTZ;

-- Backfill from existing messages so the timer works on launch.
UPDATE conversations c
SET customer_replied_at = (
  SELECT MAX(m.created_at)
  FROM messages m
  WHERE m.conversation_id = c.id
    AND m.sender_type = 'customer'
)
WHERE customer_replied_at IS NULL;


-- ------------------------------------------------------------
-- 032_filter_contacts_by_tags_created_at.sql
-- ------------------------------------------------------------
-- ============================================================
-- 032_filter_contacts_by_tags_created_at.sql — creation-date range
-- on the tag-filtered contacts RPC
--
-- The Contacts page now also offers a "Creation date" filter. When no
-- tags are selected, the plain client-side query can just add
-- .gte()/.lt() on created_at directly. But when tags ARE selected,
-- contacts go through filter_contacts_by_tags (025) instead — so that
-- RPC needs the same date bounds to keep both filters composable.
--
-- p_created_from/p_created_to are DATE, inclusive on both ends: the
-- upper bound is compared against the start of the *next* day so a
-- contact created any time on p_created_to is included.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.filter_contacts_by_tags(
  p_tag_ids UUID[],
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0,
  p_created_from DATE DEFAULT NULL,
  p_created_to DATE DEFAULT NULL
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
    -- an optional creation-date range.
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

ALTER FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, DATE, DATE) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, DATE, DATE) TO authenticated;

-- Drop the old 5-arg overload — PostgREST would otherwise see two
-- candidate overloads for the old call shape and refuse to pick one.
DROP FUNCTION IF EXISTS public.filter_contacts_by_tags(UUID[], TEXT, INT, INT);


-- ------------------------------------------------------------
-- 033_contacts_address.sql
-- ------------------------------------------------------------
-- ============================================================
-- 033_contacts_address.sql — structured postal address on contacts
--
-- Adds the address fields shown in the contact Details tab: street,
-- locality, city, state, pin code. Stored as separate nullable TEXT
-- columns (rather than one JSON blob) so they stay queryable/filterable
-- later and map cleanly to individual form inputs.
--
-- Account members (agent+) can read/write them through the existing
-- contacts_update / contacts_select RLS policies (migration 017) — no
-- new policy needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS street   TEXT,
  ADD COLUMN IF NOT EXISTS locality TEXT,
  ADD COLUMN IF NOT EXISTS city     TEXT,
  ADD COLUMN IF NOT EXISTS state    TEXT,
  ADD COLUMN IF NOT EXISTS pin_code TEXT;


-- ------------------------------------------------------------
-- 034_contacts_mute_block.sql
-- ------------------------------------------------------------
-- ============================================================
-- 034_contacts_mute_block.sql — mute & block flags on contacts
--
-- Adds the two remaining per-contact status flags surfaced by the
-- contact detail header's actions menu (mute / report spam / block).
-- `is_spam` already exists (migration 030); this adds `is_muted` and
-- `is_blocked`.
--
--   - is_muted   → suppress notifications for this contact
--   - is_blocked → contact is blocked; used to hide/skip them
--
-- Account members (agent+) can flip both through the existing
-- contacts_update RLS policy (migration 017) — no new policy needed.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_muted   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

-- Partial index so a future "hide blocked" filter stays cheap; only
-- indexes the (typically small) set of blocked contacts.
CREATE INDEX IF NOT EXISTS contacts_is_blocked_idx
  ON contacts(account_id)
  WHERE is_blocked;


-- ------------------------------------------------------------
-- 035_conversation_assigned_flow.sql
-- ------------------------------------------------------------
-- ============================================================
-- 035_conversation_assigned_flow.sql — assign a conversation to a bot
--
-- The inbox "Assign" dropdown can now hand a conversation to a Flow
-- (bot) instead of a human agent. This records which flow is driving
-- the conversation so the UI can show the bot's name as the assignee.
--
--   - assigned_flow_id → the flow currently handling this conversation
--     (NULL when a human agent owns it, or nobody does)
--
-- ON DELETE SET NULL: deleting a flow simply un-assigns any
-- conversations it was driving rather than cascading them away.
--
-- The actual bot behavior is driven by flow_runs (the engine advances
-- the per-contact run on each inbound message); this column is the
-- conversation-level pointer the inbox reads for its label.
--
-- Account members (agent+) can set it through the existing
-- conversations_update RLS policy (migration 017) — no new policy.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_flow_id UUID
    REFERENCES flows(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_assigned_flow_idx
  ON conversations(assigned_flow_id)
  WHERE assigned_flow_id IS NOT NULL;


-- ------------------------------------------------------------
-- 036_media_library.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 037_template_carousel.sql
-- ------------------------------------------------------------
-- ============================================================
-- 037_template_carousel.sql — WhatsApp carousel templates
--
-- A carousel template is a single BODY "bubble" followed by 2–10
-- swipeable cards. Every card shares the same media format (all IMAGE
-- or all VIDEO) and the same button structure (Meta rule); only the
-- media, card body text, and per-button values vary.
--
-- Storage:
--   - template_type          'standard' (existing) or 'carousel'
--   - carousel_card_format   'image' | 'video' — shared across cards
--   - carousel_cards         JSONB array of:
--        { media_url, media_handle?, body_text, buttons: [] }
--
-- The existing header/footer columns stay NULL for carousels; the
-- top-level bubble text reuses body_text.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS carousel_card_format TEXT,
  ADD COLUMN IF NOT EXISTS carousel_cards JSONB;

-- Guard the type + format enums. Drop-then-add so re-runs don't error
-- on an existing constraint.
ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_template_type_check;
ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_template_type_check
  CHECK (template_type IN ('standard', 'carousel'));

ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_carousel_format_check;
ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_carousel_format_check
  CHECK (carousel_card_format IS NULL OR carousel_card_format IN ('image', 'video'));

-- Shape guard: carousel_cards, when present, is an array of ≤10 items.
ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_carousel_cards_shape_check;
ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_carousel_cards_shape_check
  CHECK (
    carousel_cards IS NULL
    OR (
      jsonb_typeof(carousel_cards) = 'array'
      AND jsonb_array_length(carousel_cards) <= 10
    )
  );


-- ------------------------------------------------------------
-- 038_ai_configs.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 039_ai_autoreply.sql
-- ------------------------------------------------------------
-- ============================================================
-- 039_ai_autoreply.sql — inbound AI auto-reply bot
--
-- The AI config (038) already carries `auto_reply_enabled` and
-- `auto_reply_max_per_conversation`. This migration adds the two
-- per-conversation columns the bot needs to stay bounded, plus an
-- atomic slot-claim function so concurrent inbound messages can never
-- overshoot the per-conversation cap.
--
--   - `conversations.ai_autoreply_disabled` — set true when the model
--     signals a human handoff, or when someone turns the bot off for
--     that one thread. Sticky: once handed off it stays off until
--     explicitly re-enabled.
--   - `conversations.ai_reply_count` — running count of bot auto-replies
--     in the thread, checked against `auto_reply_max_per_conversation`.
--
-- The bot runs under the service-role client from the webhook (no
-- auth.uid()), so these need no extra RLS.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_autoreply_disabled boolean NOT NULL DEFAULT false;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_reply_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- Atomic auto-reply slot claim.
--
-- The bot claims a reply slot through this function rather than a
-- read-then-write from the app: two inbound messages on one
-- conversation can be processed concurrently, and a client-side
-- "read count, check < cap, then increment" would let both pass the
-- check and overshoot the per-conversation cap. Here the cap check and
-- the `+ 1` happen in a single UPDATE, so exactly `max_replies` slots
-- can ever be claimed. Returns true when a slot was claimed (the caller
-- may send), false when the cap is already reached (skip).
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_ai_reply_slot(
  conversation_id uuid,
  max_replies integer
)
RETURNS boolean AS $$
  WITH claimed AS (
    UPDATE conversations
    SET ai_reply_count = ai_reply_count + 1
    WHERE id = conversation_id
      AND ai_reply_count < max_replies
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Lock down EXECUTE. This is SECURITY DEFINER and would otherwise
-- default to PUBLIC (the anon role) — which, since it bypasses RLS and
-- mutates a counter by conversation id, would let an unauthenticated
-- caller who guessed a conversation UUID inflate ai_reply_count and
-- permanently silence the bot on that thread. Only the auto-reply bot
-- (service-role client) ever claims a slot.
REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_slot(uuid, integer) TO service_role;


-- ------------------------------------------------------------
-- 040_ai_knowledge.sql
-- ------------------------------------------------------------
-- ============================================================
-- 040_ai_knowledge.sql — AI knowledge base (RAG grounding)
--
-- Gives the AI assistant (migration 038) an account-owned knowledge
-- base — FAQ / policy / product text — that it retrieves into every
-- draft, auto-reply, and Playground turn, so it can answer
-- business-specific questions instead of handing off.
--
-- Hybrid retrieval:
--   - Lexical: a generated `fts` tsvector on each chunk, ranked with
--     ts_rank. Works for every account with no extra credentials.
--   - Semantic: an optional pgvector `embedding` per chunk (OpenAI
--     text-embedding-3-small, 1536 dims), populated only when the
--     account configures an embeddings key. Anthropic/OpenRouter-only
--     accounts keep the lexical path with zero extra setup.
--
-- pgvector: `CREATE EXTENSION IF NOT EXISTS vector` works on a stock
-- Postgres. On hosted Supabase the extension usually lives in the
-- `extensions` schema — if your project pins that, run
-- `create extension if not exists vector with schema extensions;`
-- once, then this file is a no-op for the extension.
--
-- RLS: settings-class, mirroring `ai_configs` / `whatsapp_config` —
-- any member may read the knowledge base; only admin+ may change it.
-- The retrieval RPCs and the ingest path run under the service-role
-- client (the auto-reply bot has no auth.uid()), so RLS guards
-- dashboard reads.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Optional embeddings key (OpenAI-compatible). When set, the KB is
-- embedded and semantic search turns on. Stored AES-256-GCM-encrypted,
-- same as ai_configs.api_key.
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS embeddings_api_key text;

-- ============================================================
-- Documents — one row per KB entry the user pastes (title + body).
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_documents_account_id_idx
  ON ai_knowledge_documents (account_id);

ALTER TABLE ai_knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_documents_select ON ai_knowledge_documents;
CREATE POLICY ai_knowledge_documents_select ON ai_knowledge_documents FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS ai_knowledge_documents_insert ON ai_knowledge_documents;
CREATE POLICY ai_knowledge_documents_insert ON ai_knowledge_documents FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_knowledge_documents_update ON ai_knowledge_documents;
CREATE POLICY ai_knowledge_documents_update ON ai_knowledge_documents FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_knowledge_documents_delete ON ai_knowledge_documents;
CREATE POLICY ai_knowledge_documents_delete ON ai_knowledge_documents FOR DELETE
  USING (is_account_member(account_id, 'admin'));

CREATE OR REPLACE FUNCTION public.update_ai_knowledge_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_knowledge_documents_updated_at ON ai_knowledge_documents;
CREATE TRIGGER ai_knowledge_documents_updated_at
  BEFORE UPDATE ON ai_knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_knowledge_documents_updated_at();

-- ============================================================
-- Chunks — retrieval units. `account_id` is denormalized off the
-- document so the match RPCs and RLS filter without a join.
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES ai_knowledge_documents(id) ON DELETE CASCADE,
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  chunk_index  integer NOT NULL DEFAULT 0,
  content      text NOT NULL,
  -- Language-neutral FTS config: this lexical path is the fallback for
  -- accounts without an embeddings key. `'simple'` tokenizes + lowercases
  -- without English-only stemming/stopwords, so it degrades gracefully in
  -- any language. (Accounts wanting paraphrase/morphology matching add an
  -- embeddings key for the semantic path.)
  fts          tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  embedding    vector(1536),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_account_id_idx
  ON ai_knowledge_chunks (account_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_document_id_idx
  ON ai_knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_fts_idx
  ON ai_knowledge_chunks USING gin (fts);
-- Cosine-distance ANN index for the semantic path. Rows with a NULL
-- embedding (lexical-only accounts) are simply absent from it.
--
-- HNSW (not IVFFlat): per-account knowledge bases start empty and grow
-- incrementally, and IVFFlat must be trained on existing rows — built
-- against an empty/tiny table its centroids are meaningless and recall
-- is poor until it's large and REINDEXed. HNSW needs no training and is
-- accurate from the first row.
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx
  ON ai_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_knowledge_chunks_select ON ai_knowledge_chunks;
CREATE POLICY ai_knowledge_chunks_select ON ai_knowledge_chunks FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS ai_knowledge_chunks_insert ON ai_knowledge_chunks;
CREATE POLICY ai_knowledge_chunks_insert ON ai_knowledge_chunks FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_knowledge_chunks_update ON ai_knowledge_chunks;
CREATE POLICY ai_knowledge_chunks_update ON ai_knowledge_chunks FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS ai_knowledge_chunks_delete ON ai_knowledge_chunks;
CREATE POLICY ai_knowledge_chunks_delete ON ai_knowledge_chunks FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- Retrieval RPCs. Both SECURITY DEFINER and hard-scoped to the passed
-- account_id so the service-role caller can only ever read one
-- account's chunks.
-- ============================================================

-- Lexical: full-text rank. `plainto_tsquery` turns a raw customer
-- message into a query safely (no operator injection). Uses the same
-- language-neutral `'simple'` config as the stored `fts` column.
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts(
  p_account_id  uuid,
  p_query       text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT c.id,
         c.content,
         ts_rank(c.fts, plainto_tsquery('simple', p_query)) AS rank
  FROM ai_knowledge_chunks c
  WHERE c.account_id = p_account_id
    AND c.fts @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
-- search_path includes `extensions`: on hosted Supabase pgvector's
-- `vector` type and `<=>` operator live in the extensions schema, and a
-- bare `public` search_path would fail to resolve them inside this
-- SECURITY DEFINER function (silently breaking semantic retrieval).
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions;

-- Semantic: cosine distance against the query embedding. Only rows
-- that actually have an embedding participate.
--
-- `p_query_embedding` is declared `text` (not `vector`) and cast inside:
-- the caller sends the canonical pgvector literal `[0.1,0.2,...]` as a
-- plain string, so there's no ambiguity in how PostgREST binds a JSON
-- value to a `vector` parameter. Casting a literal to a constant vector
-- still lets the HNSW index serve the `<=>` order-by.
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_semantic(
  p_account_id      uuid,
  p_query_embedding text,
  p_match_count     integer
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
  SELECT c.id,
         c.content,
         (c.embedding <=> p_query_embedding::vector(1536)) AS distance
  FROM ai_knowledge_chunks c
  WHERE c.account_id = p_account_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding::vector(1536)
  LIMIT GREATEST(p_match_count, 0);
-- search_path includes `extensions`: on hosted Supabase pgvector's
-- `vector` type and `<=>` operator live in the extensions schema, and a
-- bare `public` search_path would fail to resolve them inside this
-- SECURITY DEFINER function (silently breaking semantic retrieval).
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions;

-- Lock down EXECUTE. These are SECURITY DEFINER and would otherwise
-- default to PUBLIC — i.e. the anon role — which, since the function
-- bypasses RLS and only gates on the passed account_id, would let an
-- unauthenticated caller read any account's knowledge base. The draft
-- path calls them as `authenticated` and the auto-reply bot as
-- `service_role`.
REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 041_ai_agent_assignment.sql
-- ------------------------------------------------------------
-- ============================================================
-- 041_ai_agent_assignment.sql — per-conversation AI agent assignment
--
-- Lets the inbox hand a single conversation to the account's AI agent
-- (the BYO-key assistant from 038–040), the same way it hands one to a
-- human agent or a Flow. When set, the auto-reply engine answers every
-- inbound on that thread regardless of the account-wide
-- `auto_reply_enabled` toggle and without the per-conversation cap —
-- the user explicitly chose "the AI owns this chat".
--
--   - Mutually exclusive with `assigned_agent_id` / `assigned_flow_id`
--     (enforced in the assign route, mirroring how agent vs flow is
--     already kept exclusive there).
--   - The master switch (`ai_configs.is_active`) still governs: turning
--     the assistant off silences assigned chats too.
--   - On a handoff signal the engine clears this flag so the chat
--     surfaces as unassigned for a human to pick up.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_agent_assigned boolean NOT NULL DEFAULT false;

-- Partial index: the webhook reads this per-conversation (PK lookup), so
-- no index is strictly needed; this one keeps "which chats does the AI
-- own" dashboard queries cheap without indexing the false majority.
CREATE INDEX IF NOT EXISTS conversations_ai_agent_assigned_idx
  ON conversations (account_id)
  WHERE ai_agent_assigned;


-- ------------------------------------------------------------
-- 042_contact_lists.sql
-- ------------------------------------------------------------
-- ============================================================
-- 042_contact_lists.sql — Lists (manual contact collections)
--
-- A List is a manually-managed, many-to-many collection of contacts
-- used to scope campaign audiences (e.g. "Facebook Leads"). Lists
-- store only references to contacts — no filter logic (that's the
-- separate, not-yet-built Segments module).
--
-- Design notes
--   - `lists` is account-scoped, settings-class (mirrors `tags` /
--     `pipelines`): any member reads, admin+ writes (create, rename,
--     archive/restore, delete all go through the same admin+
--     INSERT/UPDATE/DELETE policies).
--   - `created_by` (not `user_id`) records the author for audit only —
--     follows the newer minimal pattern from 038/040, not the legacy
--     017 dual-column one (this is a green-field table with no pre-
--     account-sharing history). ON DELETE SET NULL: removing a
--     teammate doesn't drop the account's lists.
--   - `contact_lists` is the join table. No `account_id` of its own —
--     child/join tables in this codebase don't duplicate the tenant
--     column (see `contact_tags`, `pipeline_stages`); RLS checks via
--     EXISTS through `lists`. Membership changes (add/remove contacts)
--     are operational and gated agent+, one tier below the admin+
--     list-CRUD tier.
--   - `total_contacts` is a denormalized counter maintained by an
--     incremental AFTER INSERT/DELETE trigger on `contact_lists` —
--     same technique as `broadcasts.*_count` (migration 005). Avoids
--     an N+1 COUNT(*) per row on the list-of-lists page. The
--     maintenance function is SECURITY DEFINER because an agent (who
--     can INSERT/DELETE contact_lists) cannot UPDATE `lists` directly
--     (admin+ only) — the trigger needs to bypass that.
--   - Reuses `update_updated_at_column()` from migration 001 for
--     `lists.updated_at` — the majority convention in this schema.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- LISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  total_contacts  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lists_account        ON lists(account_id);
CREATE INDEX IF NOT EXISTS idx_lists_account_status ON lists(account_id, status);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lists_select ON lists;
CREATE POLICY lists_select ON lists FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS lists_insert ON lists;
CREATE POLICY lists_insert ON lists FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

-- Covers rename, description/color edits, AND archive/restore (both
-- are just UPDATEs to this row) — one policy for all of them.
DROP POLICY IF EXISTS lists_update ON lists;
CREATE POLICY lists_update ON lists FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS lists_delete ON lists;
CREATE POLICY lists_delete ON lists FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON lists;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CONTACT_LISTS (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  list_id     UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(contact_id, list_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_lists_contact    ON contact_lists(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_list       ON contact_lists(list_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_list_added ON contact_lists(list_id, added_at DESC);

ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_lists_select ON contact_lists;
CREATE POLICY contact_lists_select ON contact_lists FOR SELECT USING (
  EXISTS (SELECT 1 FROM lists l WHERE l.id = contact_lists.list_id AND is_account_member(l.account_id))
);

-- agent+ (operational, high-frequency) — one tier below list CRUD.
DROP POLICY IF EXISTS contact_lists_modify ON contact_lists;
CREATE POLICY contact_lists_modify ON contact_lists FOR ALL USING (
  EXISTS (SELECT 1 FROM lists l WHERE l.id = contact_lists.list_id AND is_account_member(l.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM lists l WHERE l.id = contact_lists.list_id AND is_account_member(l.account_id, 'agent'))
);

-- ============================================================
-- total_contacts maintenance — incremental, mirrors migration 005.
-- SECURITY DEFINER: an agent can insert/delete contact_lists rows but
-- cannot UPDATE lists directly (admin+ only) — this bypasses that so
-- the counter stays correct regardless of who changes membership.
-- ============================================================
CREATE OR REPLACE FUNCTION public._list_bump_contact_count(p_list_id UUID, delta INT)
RETURNS VOID AS $$
BEGIN
  -- Deliberately does NOT touch updated_at — membership churn
  -- shouldn't make "Last Updated" look like the list itself was
  -- edited. Only rename/edit/archive bump updated_at, via the
  -- set_updated_at trigger above.
  UPDATE lists SET total_contacts = GREATEST(0, total_contacts + delta)
  WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.contact_lists_count_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM _list_bump_contact_count(NEW.list_id, 1);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM _list_bump_contact_count(OLD.list_id, -1);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS contact_lists_count ON contact_lists;
CREATE TRIGGER contact_lists_count
  AFTER INSERT OR DELETE ON contact_lists
  FOR EACH ROW EXECUTE FUNCTION contact_lists_count_trigger();

-- Safety net for drift (matches recompute_broadcast_counts precedent).
CREATE OR REPLACE FUNCTION public.recompute_list_contact_count(p_list_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE lists l SET total_contacts = (
    SELECT COUNT(*) FROM contact_lists cl WHERE cl.list_id = p_list_id
  ) WHERE l.id = p_list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC 1 — create_list_with_contacts
--
-- SECURITY INVOKER: RLS on lists (admin+ insert) and contact_lists
-- (agent+ insert) both apply against the calling user, so an
-- unprivileged caller's attempt fails atomically inside the function
-- (a Postgres function body is an implicit subtransaction — an error
-- aborts the whole call, no orphaned empty list left behind).
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_list_with_contacts(
  p_account_id  UUID,
  p_name        TEXT,
  p_description TEXT DEFAULT NULL,
  p_color       TEXT DEFAULT NULL,
  p_contact_ids UUID[] DEFAULT '{}'
)
RETURNS lists
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_list lists;
BEGIN
  INSERT INTO lists (account_id, name, description, color, created_by)
  VALUES (p_account_id, p_name, p_description, p_color, auth.uid())
  RETURNING * INTO v_list;

  IF array_length(p_contact_ids, 1) > 0 THEN
    INSERT INTO contact_lists (contact_id, list_id, added_by)
    SELECT DISTINCT cid, v_list.id, auth.uid()
    FROM unnest(p_contact_ids) AS cid
    ON CONFLICT (contact_id, list_id) DO NOTHING;
  END IF;

  SELECT * INTO v_list FROM lists WHERE id = v_list.id;
  RETURN v_list;
END;
$$;

ALTER FUNCTION public.create_list_with_contacts(UUID, TEXT, TEXT, TEXT, UUID[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_list_with_contacts(UUID, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_list_with_contacts(UUID, TEXT, TEXT, TEXT, UUID[]) TO authenticated;

-- ============================================================
-- RPC 2 — duplicate_list
-- SECURITY INVOKER, same rationale as above.
-- ============================================================
CREATE OR REPLACE FUNCTION public.duplicate_list(
  p_source_list_id UUID,
  p_new_name       TEXT,
  p_copy_contacts  BOOLEAN DEFAULT true
)
RETURNS lists
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_source lists;
  v_new    lists;
BEGIN
  SELECT * INTO v_source FROM lists WHERE id = p_source_list_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source list % not found or not visible', p_source_list_id;
  END IF;

  -- New copy always starts active, regardless of the source's status.
  INSERT INTO lists (account_id, name, description, color, created_by)
  VALUES (v_source.account_id, p_new_name, v_source.description, v_source.color, auth.uid())
  RETURNING * INTO v_new;

  IF p_copy_contacts THEN
    INSERT INTO contact_lists (contact_id, list_id, added_by)
    SELECT contact_id, v_new.id, auth.uid()
    FROM contact_lists
    WHERE list_id = p_source_list_id
    ON CONFLICT (contact_id, list_id) DO NOTHING;

    SELECT * INTO v_new FROM lists WHERE id = v_new.id;
  END IF;

  RETURN v_new;
END;
$$;

ALTER FUNCTION public.duplicate_list(UUID, TEXT, BOOLEAN) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.duplicate_list(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_list(UUID, TEXT, BOOLEAN) TO authenticated;

-- ============================================================
-- RPC 3 — list_contacts_page (search + sort + pagination for the
-- in-list contact table). Mirrors filter_contacts_by_tags (025/032)
-- almost exactly — same reason: PostgREST embedded-resource search
-- with an accurate windowed count has no clean client-only answer.
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_contacts_page(
  p_list_id UUID,
  p_search  TEXT DEFAULT NULL,
  p_sort    TEXT DEFAULT 'added_at_desc', -- 'added_at_desc'|'added_at_asc'|'name_asc'|'name_desc'
  p_limit   INT DEFAULT 25,
  p_offset  INT DEFAULT 0
)
RETURNS TABLE (contact contacts, added_at TIMESTAMPTZ, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matched AS (
    SELECT cl.contact_id, cl.added_at, c.name
    FROM contact_lists cl
    JOIN contacts c ON c.id = cl.contact_id
    WHERE cl.list_id = p_list_id
      AND (
        p_search IS NULL OR p_search = ''
        OR c.name ILIKE '%' || p_search || '%'
        OR c.phone ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
      )
  ),
  page AS (
    SELECT contact_id, added_at, name, count(*) OVER() AS total_count
    FROM matched
    ORDER BY
      CASE WHEN p_sort = 'name_asc'  THEN name END ASC NULLS LAST,
      CASE WHEN p_sort = 'name_desc' THEN name END DESC NULLS LAST,
      CASE WHEN p_sort = 'added_at_asc' THEN added_at END ASC,
      CASE WHEN p_sort IS NULL OR p_sort NOT IN ('name_asc','name_desc','added_at_asc') THEN added_at END DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT c AS contact, page.added_at, page.total_count
  FROM page
  JOIN contacts c ON c.id = page.contact_id
  ORDER BY
    CASE WHEN p_sort = 'name_asc'  THEN page.name END ASC NULLS LAST,
    CASE WHEN p_sort = 'name_desc' THEN page.name END DESC NULLS LAST,
    CASE WHEN p_sort = 'added_at_asc' THEN page.added_at END ASC,
    CASE WHEN p_sort IS NULL OR p_sort NOT IN ('name_asc','name_desc','added_at_asc') THEN page.added_at END DESC;
$$;

ALTER FUNCTION public.list_contacts_page(UUID, TEXT, TEXT, INT, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_contacts_page(UUID, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_contacts_page(UUID, TEXT, TEXT, INT, INT) TO authenticated;


-- ------------------------------------------------------------
-- 043_segments.sql
-- ------------------------------------------------------------
-- ============================================================
-- 043_segments.sql — Segments (dynamic, rule-based audiences)
--
-- A Segment stores ONLY filter rules — never contact membership.
-- Matching contacts are computed on demand by evaluating the rule tree
-- against `contacts` (+ tags / lists / custom values). This keeps a
-- segment always current as contact data changes.
--
-- Design notes
--   - `segments` mirrors `lists` (042): account-scoped, settings-class
--     (member reads, admin+ writes), `created_by` for audit only,
--     `update_updated_at_column()` for updated_at.
--   - Rules live in a single JSONB tree so nested AND/OR groups need no
--     extra tables and new field types slot in without a schema change:
--       { "combinator": "and", "rules": [
--           { "field": "city", "op": "equals", "value": "Kolkata" },
--           { "combinator": "or", "rules": [ <leaf>, <leaf> ] }
--       ] }
--   - Evaluation is a recursive JSONB→SQL compiler (`_segment_where`)
--     feeding two SECURITY INVOKER entry points — `segment_count` (live
--     count) and `segment_contacts_page` (preview + campaign send). Both
--     run as the caller so RLS on contacts/tags/lists scopes results.
--     Values are injected with format(%L/%I); the only client-supplied
--     identifiers reaching SQL are whitelisted column names.
--   - Marketing consent: `contacts.marketing_opt_out` is added here —
--     the backing field for the "Marketing Enabled / Opted Out" rules.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- MARKETING CONSENT — backing column for segment rules + campaign
-- exclusion. Default FALSE = opted in (marketing enabled).
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_contacts_marketing_opt_out
  ON contacts(account_id, marketing_opt_out);

-- ============================================================
-- SEGMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS segments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  description        TEXT,
  color              TEXT,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  rules              JSONB NOT NULL DEFAULT '{"combinator":"and","rules":[]}'::jsonb,
  -- Optional cached estimate so the list-of-segments page can show a
  -- count without re-evaluating every row. Refreshed opportunistically
  -- by the app after edits; NULL means "not computed yet".
  estimated_count    INTEGER,
  count_computed_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_account        ON segments(account_id);
CREATE INDEX IF NOT EXISTS idx_segments_account_status ON segments(account_id, status);

ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS segments_select ON segments;
CREATE POLICY segments_select ON segments FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS segments_insert ON segments;
CREATE POLICY segments_insert ON segments FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS segments_update ON segments;
CREATE POLICY segments_update ON segments FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS segments_delete ON segments;
CREATE POLICY segments_delete ON segments FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON segments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RULE COMPILER
--
-- `_segment_leaf_sql(rule)` → a SQL boolean expression for one leaf,
-- always referencing the contact alias `c`. Unknown field/op combos
-- compile to TRUE (a no-op) so a half-built rule never hard-excludes.
-- IMMUTABLE + no table access — pure string building.
-- ============================================================
CREATE OR REPLACE FUNCTION public._segment_leaf_sql(p_rule JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  f   TEXT := p_rule->>'field';
  op  TEXT := p_rule->>'op';
  val TEXT := p_rule->>'value';
  fid TEXT;
BEGIN
  IF f IS NULL OR op IS NULL THEN
    RETURN 'TRUE';
  END IF;

  -- ---- Contact text columns -------------------------------------------
  IF f IN ('name','phone','email','company','city','state','street','locality','pin_code') THEN
    RETURN CASE op
      WHEN 'equals'       THEN format('c.%I = %L', f, val)
      WHEN 'not_equals'   THEN format('c.%I IS DISTINCT FROM %L', f, val)
      WHEN 'contains'     THEN format('c.%I ILIKE %L', f, '%'||val||'%')
      WHEN 'not_contains' THEN format('(c.%I NOT ILIKE %L OR c.%I IS NULL)', f, '%'||val||'%', f)
      WHEN 'starts_with'  THEN format('c.%I ILIKE %L', f, val||'%')
      WHEN 'ends_with'    THEN format('c.%I ILIKE %L', f, '%'||val)
      WHEN 'is_set'       THEN format('(c.%I IS NOT NULL AND c.%I <> %L)', f, f, '')
      WHEN 'is_not_set'   THEN format('(c.%I IS NULL OR c.%I = %L)', f, f, '')
      ELSE 'TRUE'
    END;
  END IF;

  -- ---- Marketing consent (boolean over marketing_opt_out) --------------
  IF f = 'marketing_enabled' THEN
    RETURN CASE op
      WHEN 'is_true'  THEN 'c.marketing_opt_out IS NOT TRUE'
      WHEN 'is_false' THEN 'c.marketing_opt_out IS TRUE'
      ELSE 'TRUE'
    END;
  END IF;

  -- ---- Date columns ----------------------------------------------------
  IF f IN ('created_at','updated_at') THEN
    RETURN CASE op
      WHEN 'before'       THEN format('c.%I < %L::timestamptz', f, val)
      WHEN 'after'        THEN format('c.%I >= %L::timestamptz', f, val)
      WHEN 'today'        THEN format('c.%I >= date_trunc(''day'', now())', f)
      WHEN 'yesterday'    THEN format('(c.%I >= date_trunc(''day'', now()) - interval ''1 day'' AND c.%I < date_trunc(''day'', now()))', f, f)
      WHEN 'last_7_days'  THEN format('c.%I >= now() - interval ''7 days''', f)
      WHEN 'last_30_days' THEN format('c.%I >= now() - interval ''30 days''', f)
      WHEN 'this_month'   THEN format('date_trunc(''month'', c.%I) = date_trunc(''month'', now())', f)
      WHEN 'last_month'   THEN format('date_trunc(''month'', c.%I) = date_trunc(''month'', now()) - interval ''1 month''', f)
      ELSE 'TRUE'
    END;
  END IF;

  -- ---- Tags ------------------------------------------------------------
  IF f = 'tag' THEN
    IF op = 'has_tag' THEN
      RETURN format('EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id = %L::uuid)', val);
    ELSIF op = 'not_has_tag' THEN
      RETURN format('NOT EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id = %L::uuid)', val);
    END IF;
    RETURN 'TRUE';
  END IF;

  -- ---- Lists -----------------------------------------------------------
  IF f = 'list' THEN
    IF op = 'in_list' THEN
      RETURN format('EXISTS (SELECT 1 FROM contact_lists cl WHERE cl.contact_id = c.id AND cl.list_id = %L::uuid)', val);
    ELSIF op = 'not_in_list' THEN
      RETURN format('NOT EXISTS (SELECT 1 FROM contact_lists cl WHERE cl.contact_id = c.id AND cl.list_id = %L::uuid)', val);
    END IF;
    RETURN 'TRUE';
  END IF;

  -- ---- Custom fields (field encoded as 'custom:<field_uuid>') ----------
  IF f LIKE 'custom:%' THEN
    fid := split_part(f, ':', 2);
    RETURN CASE op
      WHEN 'equals'       THEN format('EXISTS (SELECT 1 FROM contact_custom_values v WHERE v.contact_id = c.id AND v.custom_field_id = %L::uuid AND v.value = %L)', fid, val)
      WHEN 'not_equals'   THEN format('NOT EXISTS (SELECT 1 FROM contact_custom_values v WHERE v.contact_id = c.id AND v.custom_field_id = %L::uuid AND v.value = %L)', fid, val)
      WHEN 'contains'     THEN format('EXISTS (SELECT 1 FROM contact_custom_values v WHERE v.contact_id = c.id AND v.custom_field_id = %L::uuid AND v.value ILIKE %L)', fid, '%'||val||'%')
      WHEN 'is_set'       THEN format('EXISTS (SELECT 1 FROM contact_custom_values v WHERE v.contact_id = c.id AND v.custom_field_id = %L::uuid AND v.value IS NOT NULL AND v.value <> %L)', fid, '')
      WHEN 'is_not_set'   THEN format('NOT EXISTS (SELECT 1 FROM contact_custom_values v WHERE v.contact_id = c.id AND v.custom_field_id = %L::uuid AND v.value IS NOT NULL AND v.value <> %L)', fid, '')
      ELSE 'TRUE'
    END;
  END IF;

  -- Unknown field: no-op so a partial rule can't hard-exclude everyone.
  RETURN 'TRUE';
END;
$$;

-- Recursively compile a rule node (group or leaf) into SQL. An empty
-- group compiles to TRUE (matches all) — the app requires ≥1 rule before
-- a segment can be saved / used in a campaign.
CREATE OR REPLACE FUNCTION public._segment_where(p_node JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  comb  TEXT;
  child JSONB;
  parts TEXT[] := '{}';
  frag  TEXT;
BEGIN
  IF p_node IS NULL OR jsonb_typeof(p_node) <> 'object' THEN
    RETURN 'TRUE';
  END IF;

  IF p_node ? 'rules' THEN
    comb := upper(COALESCE(p_node->>'combinator', 'and'));
    IF comb NOT IN ('AND','OR') THEN comb := 'AND'; END IF;

    FOR child IN SELECT * FROM jsonb_array_elements(p_node->'rules') LOOP
      frag := public._segment_where(child);
      IF frag IS NOT NULL AND frag <> '' THEN
        parts := array_append(parts, '(' || frag || ')');
      END IF;
    END LOOP;

    IF array_length(parts, 1) IS NULL THEN
      RETURN 'TRUE';
    END IF;
    RETURN array_to_string(parts, ' ' || comb || ' ');
  END IF;

  RETURN public._segment_leaf_sql(p_node);
END;
$$;

-- ============================================================
-- segment_count — live matching-contact count for a rule tree.
-- ============================================================
CREATE OR REPLACE FUNCTION public.segment_count(p_account_id UUID, p_rules JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  w TEXT := public._segment_where(p_rules);
  n BIGINT;
BEGIN
  EXECUTE 'SELECT count(*) FROM contacts c WHERE c.account_id = $1 AND (' || w || ')'
    INTO n USING p_account_id;
  RETURN n;
END;
$$;

ALTER FUNCTION public.segment_count(UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.segment_count(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.segment_count(UUID, JSONB) TO authenticated;

-- ============================================================
-- segment_contacts_page — search + sort + pagination for the preview
-- table and campaign send. Mirrors list_contacts_page (042) shape:
-- returns each contact row plus the pre-limit windowed total.
-- ============================================================
CREATE OR REPLACE FUNCTION public.segment_contacts_page(
  p_account_id UUID,
  p_rules      JSONB,
  p_search     TEXT DEFAULT NULL,
  p_sort       TEXT DEFAULT 'created_desc', -- 'created_desc'|'created_asc'|'name_asc'|'name_desc'
  p_limit      INT  DEFAULT 25,
  p_offset     INT  DEFAULT 0
)
RETURNS TABLE (contact contacts, total_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  w     TEXT := public._segment_where(p_rules);
  order_by TEXT;
BEGIN
  order_by := CASE p_sort
    WHEN 'created_asc' THEN 'c.created_at ASC'
    WHEN 'name_asc'    THEN 'c.name ASC NULLS LAST'
    WHEN 'name_desc'   THEN 'c.name DESC NULLS LAST'
    ELSE 'c.created_at DESC'
  END;

  RETURN QUERY EXECUTE
    'SELECT c::contacts AS contact, count(*) OVER() AS total_count
       FROM contacts c
      WHERE c.account_id = $1
        AND (' || w || ')
        AND ($2 IS NULL OR $2 = '''' OR c.name ILIKE ''%''||$2||''%''
             OR c.phone ILIKE ''%''||$2||''%'' OR c.email ILIKE ''%''||$2||''%'')
      ORDER BY ' || order_by || '
      LIMIT $3 OFFSET $4'
    USING p_account_id, p_search, p_limit, p_offset;
END;
$$;

ALTER FUNCTION public.segment_contacts_page(UUID, JSONB, TEXT, TEXT, INT, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.segment_contacts_page(UUID, JSONB, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.segment_contacts_page(UUID, JSONB, TEXT, TEXT, INT, INT) TO authenticated;


-- ------------------------------------------------------------
-- 044_contact_dob.sql
-- ------------------------------------------------------------
-- ============================================================
-- 044_contact_dob.sql — Date of birth on contacts
--
-- A first-class DATE column (not a custom field) so it can back the
-- contact Details form and, later, Segment birthday rules. Nullable;
-- additive and idempotent.
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;
