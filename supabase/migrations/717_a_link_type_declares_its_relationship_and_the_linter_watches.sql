-- 717 — a link type declares its relationship type, and the linter finally
-- watches links (creation review, F2 + the engine half of F7).
--
-- The first choice of Foundry's creation helper is the relationship:
--
--   "In the first step of the **Create a new link type** dialog, select the
--    relationship type for the link."
--   — object-link-types/create-link-type.md
--
-- with three kinds — object type foreign keys ("Supports \"one-to-one\" and
-- \"many-to-one\" cardinality link types"), join table dataset ("For
-- \"many-to-many\" cardinality link types"), backing object type. Ours let a
-- link be born with NO declared relationship and a silently defaulted
-- cardinality: apply_one_change inserts only staged keys, so the leftover
-- column DEFAULT 'many_to_many' stamped every UI-created link — against
-- 437's own decision that an unconfigured link is unconfigured, not silently
-- backed. And ontology_violations() had no link arm at all, so nothing ever
-- said so. Probed 2026-08-28: a link landed with backing_kind NULL,
-- cardinality many_to_many, zero violations.
--
-- Three changes:
-- 1. The cardinality DEFAULT is dropped. The column stays NOT NULL: the
--    creation surface now collects the choice (the wizard's own step), and a
--    payload without one fails loudly instead of silently defaulting.
-- 2. link_type_problems() — the linter's link arm, composed into
--    ontology_violations() the way every problem family is. Three checks:
--    an undeclared relationship; a join-table key column the dataset no
--    longer carries (this rung exactly: a fact that goes stale when the
--    dataset schema moves); and the join-table type-match rule:
--
--   "If the type of the primary key property of the object type is not the
--    same as the type of the column it is being mapped to in the link
--    type's backing datasource, an error will prevent you from saving."
--   — object-link-types/edit-link-types.md
--
-- 3. One more join rule from the creation helper, checked in the same arm:
--
--   "Select a dataset that contains columns matching the primary keys for
--    both selected object types. A column can only be mapped to one primary
--    key."
--   — object-link-types/create-link-type.md
--
-- Errors, not warnings: the helper cannot produce an unbacked link at all,
-- the type-match sentence says refused, and the surface shipping with this
-- migration always collects the choices — so the arm blocks nothing a
-- documented flow asks for. Zero link_types rows exist live, so no standing
-- state is newly blocked.

-- The column was NULLABLE with a default — the worst pairing: never null in
-- practice, only because the default stamped it. Explicit both ways now.
ALTER TABLE public.link_types ALTER COLUMN cardinality DROP DEFAULT;
ALTER TABLE public.link_types ALTER COLUMN cardinality SET NOT NULL;

-- The third backing kind gets the pairing rule the other two already had:
-- "Object-backed link types expand on many-to-one cardinality link types"
-- (create-link-type's relationship-type step). Direction-aware like 437's
-- arms — our storage is directed source→target, so the page's many-to-one
-- read from the other end is one_to_many, and both spell the same
-- relationship. The foreign_key and join_table half-rules (437) already
-- carry their sentences and stay untouched.
ALTER TABLE public.link_types ADD CONSTRAINT link_types_object_backed_cardinality CHECK (
  backing_kind IS DISTINCT FROM 'object_backed'
  OR cardinality IN ('many_to_one', 'one_to_many')
);
COMMENT ON CONSTRAINT link_types_object_backed_cardinality ON public.link_types IS
  'Object-backed links expand on many-to-one (create-link-type) — held in both readings of our directed pair, the way 437''s foreign-key and join-table arms are. A composite rule, not a value set.';

CREATE FUNCTION public.link_type_problems()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  -- An undeclared relationship: none of the three backing arms is chosen.
  SELECT st.api_name, 'link_type', lt.api_name,
         'A link type must declare its relationship type: object type foreign keys, a join table dataset, or a backing object type'
    FROM public.link_types lt
    JOIN public.object_types st ON st.id = lt.source_object_type_id
   WHERE lt.backing_kind IS NULL

  UNION ALL

  -- One join column may serve one primary key.
  SELECT st.api_name, 'link_type', lt.api_name,
         'The join table maps one column to both primary keys — a column can only be mapped to one primary key'
    FROM public.link_types lt
    JOIN public.object_types st ON st.id = lt.source_object_type_id
   WHERE lt.backing_kind = 'join_table'
     AND lt.source_key_column = lt.target_key_column

  UNION ALL

  -- Each end's mapped column must exist in the join dataset's current
  -- schema, with the same type as that end's primary key property.
  SELECT st.api_name, 'link_type', lt.api_name,
         CASE WHEN fld.value IS NULL THEN
           format('The join table no longer carries the column "%s" mapped to %s''s primary key',
                  ends.key_column, ends.end_api)
         ELSE
           format('The join table column "%s" is %s while %s''s primary key is %s — the types must be the same',
                  ends.key_column, lower(fld.value ->> 'type'), ends.end_api, pk.base_type)
         END
    FROM public.link_types lt
    JOIN public.object_types st ON st.id = lt.source_object_type_id
   CROSS JOIN LATERAL (VALUES
      (lt.source_object_type_id, lt.source_key_column),
      (lt.target_object_type_id, lt.target_key_column)
    ) AS ends_raw(end_type, key_column)
    JOIN public.object_types et ON et.id = ends_raw.end_type
   CROSS JOIN LATERAL (SELECT ends_raw.end_type, ends_raw.key_column, et.api_name AS end_api) ends
    JOIN public.object_type_properties pk
      ON pk.object_type_id = ends.end_type AND pk.is_primary_key
    LEFT JOIN LATERAL (
      SELECT value FROM jsonb_array_elements(public.dataset_current_fields(lt.dataset_id))
       WHERE value ->> 'name' = ends.key_column
    ) fld ON true
   WHERE lt.backing_kind = 'join_table'
     AND (fld.value IS NULL OR lower(fld.value ->> 'type') IS DISTINCT FROM pk.base_type)
$fn$;

COMMENT ON FUNCTION public.link_type_problems() IS
  'The linter''s link arm (717). An undeclared relationship, a join column the dataset dropped, a column serving both keys, and the type-match rule edit-link-types says prevents a save. Filed under the source type''s api_name, the side our surface creates from.';

CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT * FROM public.ontology_violations_core()
  UNION ALL
  SELECT * FROM public.derived_property_problems()
  UNION ALL
  SELECT * FROM public.media_property_problems()
  UNION ALL
  SELECT * FROM public.datasource_mapping_problems()
  UNION ALL
  SELECT * FROM public.struct_property_problems()
  UNION ALL
  SELECT * FROM public.link_type_problems()
$fn$;

-- ── PROVED BY DOING — each arm fires, then is satisfied, self-cleaning ──────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; a uuid; b uuid; lt uuid;
  proj uuid; ds uuid; br uuid; txn uuid; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m717 probe') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m717 probe') RETURNING id INTO space;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (space, org);
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'm717_probe', 'm717 probe') RETURNING id INTO proj;
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (space, 'm717_probe', 'M717', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'M717A', 'M717 A') RETURNING id INTO a;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'M717B', 'M717 B') RETURNING id INTO b;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (a, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true),
         (b, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true);

  -- The DEFAULT is gone: an insert without a cardinality is refused loudly.
  BEGIN
    INSERT INTO public.link_types (ontology_id, source_object_type_id, target_object_type_id, api_name, label)
    VALUES (ont, a, b, 'no_card', 'No card');
    RAISE EXCEPTION 'a cardinality-less link was accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;

  -- Arm 1: an undeclared relationship is a violation.
  INSERT INTO public.link_types (ontology_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality)
  VALUES (ont, a, b, 'm717_link', 'M717 link', 'many_to_many') RETURNING id INTO lt;
  SELECT count(*) INTO n FROM public.link_type_problems() p
   WHERE p.subject = 'm717_link' AND p.problem LIKE '%must declare its relationship type%';
  IF n <> 1 THEN RAISE EXCEPTION 'unbacked-link arm did not fire (%)', n; END IF;
  SELECT count(*) INTO n FROM public.ontology_violations() v WHERE v.subject = 'm717_link';
  IF n < 1 THEN RAISE EXCEPTION 'the link arm is not composed into ontology_violations'; END IF;

  -- A join dataset whose columns exist but mismatch one end's key type.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm717_join', 'm717_join') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"a_id","type":"STRING"},{"name":"b_id","type":"INTEGER"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  UPDATE public.link_types
     SET backing_kind = 'join_table', dataset_id = ds, branch_id = br,
         source_key_column = 'a_id', target_key_column = 'b_id'
   WHERE id = lt;

  -- Arm 3 fires on the INTEGER column against the string key…
  SELECT count(*) INTO n FROM public.link_type_problems() p
   WHERE p.subject = 'm717_link' AND p.problem LIKE '%the types must be the same%';
  IF n <> 1 THEN RAISE EXCEPTION 'type-match arm did not fire (%)', n; END IF;
  -- …and the undeclared arm stopped firing.
  SELECT count(*) INTO n FROM public.link_type_problems() p
   WHERE p.subject = 'm717_link' AND p.problem LIKE '%must declare its relationship type%';
  IF n <> 0 THEN RAISE EXCEPTION 'unbacked arm still fires on a backed link'; END IF;

  -- Arm 2: one column serving both keys.
  UPDATE public.link_types SET target_key_column = 'a_id' WHERE id = lt;
  SELECT count(*) INTO n FROM public.link_type_problems() p
   WHERE p.subject = 'm717_link' AND p.problem LIKE '%one primary key%';
  IF n <> 1 THEN RAISE EXCEPTION 'one-column-one-key arm did not fire (%)', n; END IF;

  -- Satisfied whole: both columns present, both types matching.
  UPDATE public.object_type_properties SET base_type = 'integer'
   WHERE object_type_id = b AND property_id = 'pk';
  UPDATE public.link_types SET target_key_column = 'b_id' WHERE id = lt;
  SELECT count(*) INTO n FROM public.link_type_problems() p WHERE p.subject = 'm717_link';
  IF n <> 0 THEN RAISE EXCEPTION 'a satisfied link still reports % problem(s)', n; END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.link_types WHERE id = lt;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.object_types WHERE id IN (a, b);
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.organizations WHERE id = org;
END $$;
