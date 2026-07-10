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
