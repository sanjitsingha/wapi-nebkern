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
