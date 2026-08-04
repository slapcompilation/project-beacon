-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 326 — quicksearch returns what a hit is addressed by.
--
-- 325 returned an id, and only documents are routed by id here. Object types
-- and modules are addressed by `api_name`, and a RECORD needs its parent type's
-- api_name as well as its own id — /objects/:type/:recordId. Reconstructing
-- that in TypeScript would mean a second round-trip per hit, or guessing.
--
-- So the row carries `slug`: the api_name for a type or a module, the PARENT
-- type's api_name for a record, and empty for a document. The web builds the
-- path from it — routing stays the web's business, addressing stays the
-- database's.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.quicksearch(text, integer);

CREATE FUNCTION public.quicksearch(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (kind text, id uuid, slug text, title text, subtitle text, icon text, rank integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH q AS (SELECT btrim(coalesce(p_query, '')) AS raw),
  -- Foundry's order, as a number: prominent first, then normal, then anything
  -- merely experimental. Deprecated and hidden never appear.
  searchable_types AS (
    SELECT o.id, o.api_name, o.label, o.icon,
           CASE WHEN o.visibility = 'prominent' THEN 0
                WHEN o.visibility = 'normal' AND o.status IN ('active', 'promoted') THEN 1
                ELSE 2 END AS tier
    FROM object_types o
    WHERE o.status <> 'deprecated' AND o.visibility <> 'hidden'
    ORDER BY tier, o.label
    LIMIT 250
  )
  SELECT * FROM (
    SELECT 'object_type'::text, t.id, t.api_name, t.label, 'Object type · ' || t.api_name, t.icon,
           t.tier * 10 + CASE WHEN lower(t.label) LIKE lower((SELECT raw FROM q)) || '%' THEN 0 ELSE 1 END
    FROM searchable_types t, q
    WHERE q.raw <> '' AND (t.label ILIKE '%' || q.raw || '%' OR t.api_name ILIKE '%' || q.raw || '%')

    UNION ALL
    SELECT 'object_record'::text, r.id, t.api_name, r.title, t.label, t.icon, 30 + t.tier
    FROM object_records r JOIN searchable_types t ON t.id = r.object_type_id, q
    WHERE q.raw <> '' AND r.title ILIKE '%' || q.raw || '%'

    UNION ALL
    SELECT 'module'::text, m.id, m.api_name, m.title, 'Application · ' || m.api_name, m.icon, 15
    FROM modules m, q
    WHERE q.raw <> '' AND (m.title ILIKE '%' || q.raw || '%' OR m.api_name ILIKE '%' || q.raw || '%')

    UNION ALL
    SELECT 'document'::text, d.id, ''::text, d.title, 'Document', 'document', 40
    FROM documents d, q
    WHERE q.raw <> '' AND d.title ILIKE '%' || q.raw || '%'
  ) hits(kind, id, slug, title, subtitle, icon, rank)
  ORDER BY rank, title
  LIMIT greatest(1, least(coalesce(p_limit, 20), 50));
$$;

COMMENT ON FUNCTION public.quicksearch(text, integer) IS
  'Jump-to search over object types, records, applications and documents. Titles only, per Foundry compass/quicksearch. Ranked prominent -> normal -> experimental; deprecated and hidden object types are not searched. `slug` is what the hit is addressed by. SECURITY INVOKER so RLS is the permission model.';

REVOKE ALL ON FUNCTION public.quicksearch(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quicksearch(text, integer) TO authenticated;

DO $$
DECLARE v_org uuid; v_user uuid; v_vis uuid; v_dep uuid; v_hid uuid; v_rec uuid;
        n int; v_slug text; claims text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;
  claims := json_build_object('sub', v_user,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'admin'))::text;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_qs_visible', 'Probe Quicksearch Visible', v_user) RETURNING id INTO v_vis;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_qs_gone', 'Probe Quicksearch Gone', v_user) RETURNING id INTO v_dep;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_qs_quiet', 'Probe Quicksearch Quiet', v_user) RETURNING id INTO v_hid;
    INSERT INTO object_records (object_type_id, organization_id, title, created_by_user_id)
    VALUES (v_vis, v_org, 'Probe Quicksearch Record', v_user) RETURNING id INTO v_rec;

    UPDATE object_types SET status = 'deprecated', deprecation_reason = 'probe',
           deprecation_deadline = current_date + 1 WHERE id = v_dep;
    UPDATE object_types SET visibility = 'hidden' WHERE id = v_hid;

    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;

    -- The deprecated and hidden types are not searched on; the visible one is.
    SELECT count(*) INTO n FROM quicksearch('Probe Quicksearch', 50);
    IF n <> 2 THEN
      RAISE EXCEPTION 'Migration 326: expected the visible type + its record, got % row(s)', n;
    END IF;

    -- A record is addressed by its PARENT type's api_name.
    SELECT slug INTO v_slug FROM quicksearch('Probe Quicksearch Record', 50) WHERE id = v_rec;
    IF v_slug <> 'probe_qs_visible' THEN
      RAISE EXCEPTION 'Migration 326: a record''s slug was "%", not its parent type', v_slug;
    END IF;

    -- Hiding the parent takes its records out of search with it.
    RESET ROLE;
    UPDATE object_types SET visibility = 'hidden' WHERE id = v_vis;
    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM quicksearch('Probe Quicksearch', 50);
    IF n <> 0 THEN
      RAISE EXCEPTION 'Migration 326: hiding a type left % of its rows searchable', n;
    END IF;

    RESET ROLE;
    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
