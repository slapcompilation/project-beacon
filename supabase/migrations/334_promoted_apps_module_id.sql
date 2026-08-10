-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 334 — get_promoted_apps returns the module id.
--
-- resource_status keys on (resource_kind, resource_id), and the portal card had
-- only `module_api_name`. So the one surface where a curator decides an
-- application is worth everyone's attention could not promote it — the toggle
-- had nothing to promote.
--
-- Two names that look alike and are not: `promotion_id` is the row in
-- app_promotions (published to the portal, pinned to a version); `module_id` is
-- what a Compass promotion attaches to. Publishing and curating are different
-- decisions and this function now carries both.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.get_promoted_apps();

CREATE FUNCTION public.get_promoted_apps()
RETURNS TABLE (
  collection_api_name text, collection_title text, collection_position integer,
  promotion_id uuid, module_id uuid, module_api_name text, module_version integer,
  published_version integer, name text, icon text, description text,
  thumbnail_url text, tags text[], owner_email text, hotel_id uuid
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT c.api_name, c.title, c.position,
         p.id, m.id, m.api_name, m.version,
         p.module_version, p.name, p.icon, p.description,
         p.thumbnail_url, p.tags, u.email, p.hotel_id
  FROM app_promotions p
  JOIN app_collections c ON c.id = p.collection_id
  JOIN modules m ON m.id = p.module_id
  LEFT JOIN users u ON u.id = p.owner_user_id
  ORDER BY c.position, p.name
$$;

REVOKE ALL ON FUNCTION public.get_promoted_apps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_promoted_apps() TO authenticated;

DO $$
DECLARE cols text;
BEGIN
  SELECT pg_get_function_result(oid) INTO cols FROM pg_proc WHERE proname = 'get_promoted_apps';
  IF cols NOT LIKE '%module_id uuid%' THEN
    RAISE EXCEPTION 'Migration 334: get_promoted_apps still does not return module_id';
  END IF;
END $$;

COMMIT;
