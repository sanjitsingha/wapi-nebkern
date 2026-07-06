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
