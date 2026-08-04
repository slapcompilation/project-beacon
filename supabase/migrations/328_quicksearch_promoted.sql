-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 328 — promotion earns its three effects.
--
-- 327 moved `promoted` onto its own axis. A promotion that changes nothing is
-- the dead column again, so this is where the three effects Compass names
-- actually happen:
--
--   "Search visibility: Promoted resources are boosted in search results across
--    the platform for all users."
--     -> rank - 5, applied to EVERY kind, not just object types.
--
--   "Visual indicator: Promoted resources are marked with a checkmark icon,
--    allowing users to quickly identify high-value content."
--     -> a `promoted` boolean on every row, so the palette can mark it.
--
--   "Quick filters: Promoted resources appear in the Promoted items quick
--    filter... providing a curated catalog of the most useful projects, folders,
--    and files."
--     -> AN EMPTY QUERY NOW RETURNS THE PROMOTED ITEMS. Opening the palette with
--        nothing typed is the curated catalog; 325 returned nothing there, which
--        is a blank panel where Foundry has its most useful content.
--
-- The boost is deliberately small. Promotion should lift a resource above its
-- peers, not above an exact title match — a curator's opinion is a tiebreak, not
-- an override.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.quicksearch(text, integer);

CREATE FUNCTION public.quicksearch(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (kind text, id uuid, slug text, title text, subtitle text, icon text,
               promoted boolean, rank integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH q AS (SELECT btrim(coalesce(p_query, '')) AS raw),
  promo AS (SELECT resource_kind, resource_id FROM resource_status WHERE status = 'promoted'),
  searchable_types AS (
    SELECT o.id, o.api_name, o.label, o.icon,
           CASE WHEN o.visibility = 'prominent' THEN 0
                WHEN o.visibility = 'normal' AND o.status = 'active' THEN 1
                ELSE 2 END AS tier
    FROM object_types o
    WHERE o.status <> 'deprecated' AND o.visibility <> 'hidden'
    ORDER BY tier, o.label
    LIMIT 250
  ),
  hits AS (
    SELECT 'object_type'::text AS kind, t.id, t.api_name AS slug, t.label AS title,
           'Object type · ' || t.api_name AS subtitle, t.icon,
           t.tier * 10 + CASE WHEN lower(t.label) LIKE lower(q.raw) || '%' THEN 0 ELSE 1 END AS rank
    FROM searchable_types t, q
    WHERE q.raw <> '' AND (t.label ILIKE '%' || q.raw || '%' OR t.api_name ILIKE '%' || q.raw || '%')

    UNION ALL
    SELECT 'object_record', r.id, t.api_name, r.title, t.label, t.icon, 30 + t.tier
    FROM object_records r JOIN searchable_types t ON t.id = r.object_type_id, q
    WHERE q.raw <> '' AND r.title ILIKE '%' || q.raw || '%'

    UNION ALL
    SELECT 'module', m.id, m.api_name, m.title, 'Application · ' || m.api_name, m.icon, 15
    FROM modules m, q
    WHERE q.raw <> '' AND (m.title ILIKE '%' || q.raw || '%' OR m.api_name ILIKE '%' || q.raw || '%')

    UNION ALL
    SELECT 'document', d.id, ''::text, d.title, 'Document', 'document', 40
    FROM documents d, q
    WHERE q.raw <> '' AND d.title ILIKE '%' || q.raw || '%'

    -- The curated catalog: what an empty palette shows.
    UNION ALL
    SELECT 'object_type', t.id, t.api_name, t.label, 'Object type · ' || t.api_name, t.icon, 0
    FROM searchable_types t JOIN promo p ON p.resource_kind = 'object_type' AND p.resource_id = t.id, q
    WHERE q.raw = ''

    UNION ALL
    SELECT 'module', m.id, m.api_name, m.title, 'Application · ' || m.api_name, m.icon, 1
    FROM modules m JOIN promo p ON p.resource_kind = 'module' AND p.resource_id = m.id, q
    WHERE q.raw = ''

    UNION ALL
    SELECT 'document', d.id, ''::text, d.title, 'Document', 'document', 2
    FROM documents d JOIN promo p ON p.resource_kind = 'document' AND p.resource_id = d.id, q
    WHERE q.raw = ''
  )
  SELECT h.kind, h.id, h.slug, h.title, h.subtitle, h.icon,
         p.resource_id IS NOT NULL AS promoted,
         h.rank - CASE WHEN p.resource_id IS NOT NULL THEN 5 ELSE 0 END AS rank
  FROM hits h
  LEFT JOIN promo p ON p.resource_kind = h.kind AND p.resource_id = h.id
  ORDER BY 8, h.title
  LIMIT greatest(1, least(coalesce(p_limit, 20), 50));
$$;

COMMENT ON FUNCTION public.quicksearch(text, integer) IS
  'Jump-to search over object types, records, applications and documents. Titles only, per Foundry compass/quicksearch. Ranked prominent -> normal -> experimental, with promoted resources boosted; deprecated and hidden object types are not searched. An empty query returns the promoted-items catalog. SECURITY INVOKER so RLS is the permission model.';

REVOKE ALL ON FUNCTION public.quicksearch(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quicksearch(text, integer) TO authenticated;

DO $$
DECLARE v_org uuid; v_user uuid; v_a uuid; v_b uuid; n int; v_first text; claims text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;
  claims := json_build_object('sub', v_user,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'admin'))::text;

  BEGIN
    -- Two types that both match, so ordering is the only difference between them.
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_boost_aaa', 'Probe Boost Aaa', v_user) RETURNING id INTO v_a;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_boost_bbb', 'Probe Boost Bbb', v_user) RETURNING id INTO v_b;
    UPDATE object_types SET status = 'active' WHERE id IN (v_a, v_b);

    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;

    -- Alphabetical without a promotion.
    SELECT title INTO v_first FROM quicksearch('Probe Boost', 10) LIMIT 1;
    IF v_first <> 'Probe Boost Aaa' THEN
      RAISE EXCEPTION 'Migration 328: expected alphabetical order first, got %', v_first;
    END IF;

    -- Promoting the second lifts it above the first.
    INSERT INTO resource_status (resource_kind, resource_id, organization_id)
    VALUES ('object_type', v_b, v_org);
    SELECT title INTO v_first FROM quicksearch('Probe Boost', 10) LIMIT 1;
    IF v_first <> 'Probe Boost Bbb' THEN
      RAISE EXCEPTION 'Migration 328: promotion did not boost the result — first was %', v_first;
    END IF;

    -- And it is marked.
    SELECT count(*) INTO n FROM quicksearch('Probe Boost', 10) WHERE promoted;
    IF n <> 1 THEN
      RAISE EXCEPTION 'Migration 328: expected exactly one marked result, got %', n;
    END IF;

    -- An empty query is the curated catalog, not a blank panel.
    SELECT count(*) INTO n FROM quicksearch('', 50) WHERE id = v_b;
    IF n <> 1 THEN
      RAISE EXCEPTION 'Migration 328: the promoted type is missing from the empty-query catalog';
    END IF;
    SELECT count(*) INTO n FROM quicksearch('', 50) WHERE id = v_a;
    IF n <> 0 THEN
      RAISE EXCEPTION 'Migration 328: an unpromoted type appeared in the catalog';
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
