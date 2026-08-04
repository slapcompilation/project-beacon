-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 325 — quicksearch reaches the ontology, and `visibility` finally
-- does something.
--
-- We already had a ⌘K palette. It searches nav entries, products, variants and
-- suppliers, all client-side over data the page had already loaded. So an
-- operator can find "tomatoes" and cannot find the "Maintenance Request" object
-- type they authored, the Workshop app someone built, or a document. The
-- ontology is the product and it was the one thing not searchable.
--
-- Foundry's `compass/quicksearch` splits this into jump-to (titles only,
-- keyboard, navigation) and full results (every field, filters, ranking). This
-- is the jump-to half: "Jump-to mode only searches on titles of apps, resources,
-- and objects."
--
-- THE RANKING RULE IS THEIRS AND IT IS LOAD-BEARING:
--
--   "Quicksearch is limited to search for instances on 250 object types,
--    prioritized by `Active` object types with `Prominent`, then `Normal`, and
--    then `Experimental` status (deprecated and hidden object types are not
--    searched on)."
--
-- Which is what migration 321's `visibility` column was FOR, and until now
-- nothing read it — a form wrote it and a trigger set it and no query ever asked.
-- It is now the thing that decides whether an object type is findable at all.
-- Same for status: `deprecated` drops out of search, which is most of what
-- deprecating something is supposed to accomplish.
--
-- SECURITY INVOKER, deliberately. "Quicksearch respects all existing permissions
-- in the platform... Users will not see content to which they do not have
-- access." Ours gets that from RLS by not being DEFINER — every table read here
-- is already policy-gated, so the search cannot become a way around them.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.quicksearch(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (kind text, id uuid, title text, subtitle text, icon text, rank integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH q AS (SELECT btrim(coalesce(p_query, '')) AS raw),
  -- Foundry's order, as a number: prominent first, then normal, then anything
  -- merely experimental. Deprecated and hidden never appear.
  searchable_types AS (
    SELECT o.id, o.api_name, o.label, o.icon, o.kind AS type_kind,
           CASE WHEN o.visibility = 'prominent' THEN 0
                WHEN o.visibility = 'normal' AND o.status IN ('active', 'promoted') THEN 1
                ELSE 2 END AS tier
    FROM object_types o
    WHERE o.status <> 'deprecated' AND o.visibility <> 'hidden'
    -- "limited to search for instances on 250 object types"
    ORDER BY tier, o.label
    LIMIT 250
  )
  SELECT * FROM (
    -- Objects — the types themselves.
    SELECT 'object_type'::text, t.id, t.label, 'Object type · ' || t.api_name, t.icon,
           t.tier * 10 + CASE WHEN lower(t.label) LIKE lower((SELECT raw FROM q)) || '%' THEN 0 ELSE 1 END
    FROM searchable_types t, q
    WHERE q.raw <> '' AND (t.label ILIKE '%' || q.raw || '%' OR t.api_name ILIKE '%' || q.raw || '%')

    UNION ALL
    -- Objects — instances, but only of types that are searchable at all.
    SELECT 'object_record'::text, r.id, r.title, t.label, t.icon,
           30 + t.tier
    FROM object_records r JOIN searchable_types t ON t.id = r.object_type_id, q
    WHERE q.raw <> '' AND r.title ILIKE '%' || q.raw || '%'

    UNION ALL
    -- Apps — "modules, workspaces, or other applications made from Palantir
    -- application-building interfaces".
    SELECT 'module'::text, m.id, m.title, 'Application · ' || m.api_name, m.icon, 15
    FROM modules m, q
    WHERE q.raw <> '' AND (m.title ILIKE '%' || q.raw || '%' OR m.api_name ILIKE '%' || q.raw || '%')

    UNION ALL
    -- Files.
    SELECT 'document'::text, d.id, d.title, 'Document', 'document', 40
    FROM documents d, q
    WHERE q.raw <> '' AND d.title ILIKE '%' || q.raw || '%'
  ) hits(kind, id, title, subtitle, icon, rank)
  ORDER BY rank, title
  LIMIT greatest(1, least(coalesce(p_limit, 20), 50));
$$;

COMMENT ON FUNCTION public.quicksearch(text, integer) IS
  'Jump-to search over object types, records, applications and documents. Titles only, per Foundry compass/quicksearch. Ranked prominent -> normal -> experimental; deprecated and hidden object types are not searched. SECURITY INVOKER so RLS is the permission model.';

REVOKE ALL ON FUNCTION public.quicksearch(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quicksearch(text, integer) TO authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_user uuid; v_vis uuid; v_dep uuid; v_hid uuid; n int; claims text;
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

    UPDATE object_types SET status = 'deprecated', deprecation_reason = 'probe',
           deprecation_deadline = current_date + 1 WHERE id = v_dep;
    UPDATE object_types SET visibility = 'hidden' WHERE id = v_hid;

    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO n FROM quicksearch('Probe Quicksearch', 50);
    IF n <> 1 THEN
      RAISE EXCEPTION 'Migration 325: expected only the visible probe type, got % result(s)', n;
    END IF;

    SELECT count(*) INTO n FROM quicksearch('Probe Quicksearch', 50) WHERE id = v_vis;
    IF n <> 1 THEN
      RAISE EXCEPTION 'Migration 325: the searchable probe type is missing from its own search';
    END IF;

    -- An empty query returns nothing rather than the whole ontology.
    SELECT count(*) INTO n FROM quicksearch('   ', 50);
    IF n <> 0 THEN
      RAISE EXCEPTION 'Migration 325: a blank query returned % row(s)', n;
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
