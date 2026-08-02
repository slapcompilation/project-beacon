-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 312 — an org-wide question needs an org-wide reader.
--
-- 311 shipped get_module_adoption as SECURITY INVOKER, and it can never answer
-- the question it exists for: `hotels` is protected by
--
--     hotel_isolation: id = auth_hotel_id()
--
-- so an invoker-rights function reads exactly one hotel — its own. The adoption
-- panel rendered "Valinor · authored here" and simply omitted the sister
-- property, which looks like a property that has not adopted rather than a
-- property nobody can see. A wrong answer that reads as a real one.
--
-- get_chain_overview (migration 212, contract C13) already settled this shape
-- for org-wide reads: SECURITY DEFINER, an explicit owner/admin gate inside the
-- function, and org scoping by auth_org_id(). Copying it rather than inventing
-- a second pattern, and pinning search_path as security_invariants.sql requires.
--
-- Found by the W5 e2e: the panel listed one property in an org that has two.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.get_module_adoption(uuid);

CREATE FUNCTION public.get_module_adoption(p_module_id uuid)
RETURNS TABLE (
  hotel_id          uuid,
  hotel_name        text,
  installed         boolean,
  installed_version integer,
  source_version    integer,
  forked            boolean,
  is_author         boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT h.id, h.name,
         i.id IS NOT NULL,
         i.installed_version,
         m.version,
         i.forked_module_id IS NOT NULL,
         m.hotel_id = h.id
  FROM hotels h
  CROSS JOIN modules m
  LEFT JOIN module_installations i ON i.module_id = m.id AND i.hotel_id = h.id
  WHERE m.id = p_module_id
    -- Definer rights, so the gate is the function's own job: the caller's org,
    -- and only a role entitled to see across properties.
    AND auth_role() IN ('owner','admin')
    AND m.organization_id = auth_org_id()
    AND h.organization_id = auth_org_id()
  ORDER BY h.name;
$$;

REVOKE ALL ON FUNCTION public.get_module_adoption(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_module_adoption(uuid) TO authenticated;

DO $$
DECLARE v_kind char; v_cfg text[];
BEGIN
  SELECT p.prosecdef::int::char, p.proconfig INTO v_kind, v_cfg
  FROM pg_proc p WHERE p.proname = 'get_module_adoption';
  IF v_kind <> '1' THEN
    RAISE EXCEPTION 'Migration 312: get_module_adoption is not SECURITY DEFINER';
  END IF;
  IF NOT (v_cfg @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'Migration 312: search_path is not pinned — security_invariants would fail';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_routine_grants
             WHERE routine_name = 'get_module_adoption' AND grantee = 'anon') THEN
    RAISE EXCEPTION 'Migration 312: anon can execute a definer-rights org-wide read';
  END IF;
END $$;

COMMIT;
