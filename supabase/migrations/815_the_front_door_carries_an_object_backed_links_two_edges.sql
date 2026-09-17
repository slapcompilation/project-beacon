-- The front door carries an object-backed link's two edges.
--
-- Found by the end-to-end ontology gap sweep, and it is the only HARD blocker
-- the sweep's adversaries left standing after demoting ten others: an
-- object-backed link type cannot be created by any sequence of UI actions.
--
-- The trail, each step verified rather than argued:
--
--   · 765 added `source_edge_link_type_id` and `target_edge_link_type_id` to
--     link_types, with `link_types_object_backed_edges` making both mandatory
--     exactly when backing_kind = 'object_backed'.
--   · `save_link_type` — the only front door, which stages a link into the
--     working state — builds its `fields` payload from twenty-one named keys
--     and NEITHER EDGE IS AMONG THEM. It was last rewritten in 437 and touched
--     at 454 and 471, all before 765 existed, and 765 never taught it.
--   · the surface does its half correctly: ObjectTypesPage collects the backing
--     type and both edges and gates its Save button on all three
--     (`backingComplete`), and features/objectTypes/api.ts sends
--     source_edge_link_type_id and target_edge_link_type_id in the payload.
--
-- So the two ids are dropped on the floor between the form and the staging
-- table, the row is staged with backing_kind = 'object_backed' and two NULL
-- edges, and the save then dies on a raw Postgres CHECK violation — not even a
-- namespaced error, because the CHECK is the last line of defence rather than
-- the intended one. `select count(*) from link_types where
-- backing_object_type_id is not null` returns 0: no object-backed link type has
-- ever existed here.
--
-- AND WHY NOTHING CAUGHT IT. packages/platform/src/linkRelationship.test.ts
-- opens by declaring itself front-door-only: links stage through
-- save_link_type and land through save_working_state, the way the surface
-- drives them. It then proves
-- that for the undeclared kind and for join_table — and tests the third kind
-- with a DIRECT `insert into public.link_types`, asserting a different
-- constraint fires. The one kind that goes through no front door in the test is
-- the one kind whose front door is broken. That is CLAUDE.md's own rule, from
-- the other side: an assertion that never calls the thing proves it exists, not
-- that it works. The test is repaired in the same change as this migration.
--
-- PATCHED, NOT RETYPED: this is pg_get_functiondef's own output with two keys
-- added to the jsonb_build_object and nothing else moved. jsonb_strip_nulls
-- still drops them for the other two backing kinds, so a join_table or
-- undeclared link stages exactly as before.

create or replace function public.save_link_type(p_link jsonb, p_branch uuid DEFAULT NULL::uuid)
 returns uuid
 language plpgsql
 set search_path to 'public'
as $function$
DECLARE
  t      uuid := nullif(p_link->>'id', '')::uuid;
  live   boolean;
  fields jsonb;
BEGIN
  live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.link_types WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  fields := jsonb_strip_nulls(jsonb_build_object('project_id', p_link->>'project_id',
    'source_object_type_id', p_link->>'source_object_type_id',
    'target_object_type_id', p_link->>'target_object_type_id',
    'api_name',              p_link->>'api_name',
    'label',                 p_link->>'label',
    'source_api_name',       p_link->>'source_api_name',
    'target_api_name',       p_link->>'target_api_name',
    'source_label',          p_link->>'source_label',
    'target_label',          p_link->>'target_label',
    'source_visibility',     p_link->>'source_visibility',
    'target_visibility',     p_link->>'target_visibility',
    'cardinality',           p_link->>'cardinality',
    'backing_kind',          p_link->>'backing_kind',
    'backing_column',        p_link->>'backing_column',
    'backing_object_type_id',p_link->>'backing_object_type_id',
    -- 765's two edges: the link type names both of them. Without them a
    -- staged object_backed link cannot satisfy
    -- link_types_object_backed_edges, and the save dies on the CHECK.
    'source_edge_link_type_id', p_link->>'source_edge_link_type_id',
    'target_edge_link_type_id', p_link->>'target_edge_link_type_id',
    'dataset_id',            p_link->>'dataset_id',
    'branch_id',             p_link->>'branch_id',
    'source_key_column',     p_link->>'source_key_column',
    'target_key_column',     p_link->>'target_key_column',
    'status',                p_link->>'status',
    'visibility',            p_link->>'visibility'));

  IF NOT live THEN
    fields := fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_link->>'ontology_id',''), public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('link_type', t, fields, p_branch,
                              CASE WHEN live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $function$;

-- PROVED BY DOING, and in both directions.
--
-- The assertion is on what the FUNCTION stages, because that is the half this
-- migration changes: the CHECK and save_working_state were always correct, and
-- the payload was always the thing being dropped. The platform suite proves the
-- rest of the path end to end — that is the repair this change makes to
-- linkRelationship.test.ts, which stages a valid object-backed link through the
-- front door and requires it to LAND with both edges.
--
-- Nothing is staged when this runs (working_state_changes is empty, checked),
-- and the fixture is discarded before the block ends.
DO $$
DECLARE
  v_id uuid; v_fields jsonb; v_pending int; v_ont uuid; v_user uuid;
BEGIN
  -- Staging records who staged it: working_state_changes.user_id is NOT NULL
  -- and defaults to auth.uid(), which a migration does not have. The proof
  -- borrows a real identity for the duration, the way 808 and 810 do.
  SELECT id INTO v_user FROM public.users ORDER BY id LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no users'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  -- Named explicitly: save_link_type falls back to default_ontology(), which
  -- resolves through auth_org_id() and raises Ontology:NoOntology for a
  -- migration, which has no session organization.
  SELECT id INTO v_ont FROM public.ontologies ORDER BY created_at LIMIT 1;
  IF v_ont IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no ontologies'; END IF;

  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: % change(s) already staged — this would apply or discard someone else''s work', v_pending;
  END IF;

  SELECT public.save_link_type(jsonb_build_object(
    'source_object_type_id', gen_random_uuid()::text,
    'target_object_type_id', gen_random_uuid()::text,
    'ontology_id', v_ont::text,
    'api_name', 'zz_proof_815', 'label', 'Proof 815',
    'cardinality', 'many_to_one', 'backing_kind', 'object_backed',
    'backing_object_type_id', gen_random_uuid()::text,
    'source_edge_link_type_id', gen_random_uuid()::text,
    'target_edge_link_type_id', gen_random_uuid()::text
  )) INTO v_id;

  SELECT fields INTO v_fields FROM public.working_state_changes
   WHERE resource_id = v_id;

  IF v_fields IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: nothing staged for %', v_id;
  END IF;
  IF NOT (v_fields ? 'source_edge_link_type_id') THEN
    RAISE EXCEPTION 'PROOF FAILED: the staged payload still drops source_edge_link_type_id: %', v_fields;
  END IF;
  IF NOT (v_fields ? 'target_edge_link_type_id') THEN
    RAISE EXCEPTION 'PROOF FAILED: the staged payload still drops target_edge_link_type_id: %', v_fields;
  END IF;
  RAISE NOTICE 'PROVED: an object-backed link stages with both of its edges';

  -- And the other direction: a link that names no edges must still stage
  -- without them, or jsonb_strip_nulls has stopped doing its job and every
  -- join_table link would carry two nulls into the CHECK.
  PERFORM public.discard_working_state('link_type', v_id, NULL);

  SELECT public.save_link_type(jsonb_build_object(
    'source_object_type_id', gen_random_uuid()::text,
    'target_object_type_id', gen_random_uuid()::text,
    'ontology_id', v_ont::text,
    'api_name', 'zz_proof_815b', 'label', 'Proof 815b',
    'cardinality', 'many_to_many', 'backing_kind', 'join_table'
  )) INTO v_id;
  SELECT fields INTO v_fields FROM public.working_state_changes WHERE resource_id = v_id;
  IF (v_fields ? 'source_edge_link_type_id') OR (v_fields ? 'target_edge_link_type_id') THEN
    RAISE EXCEPTION 'PROOF FAILED: a join_table link staged edge keys it does not have: %', v_fields;
  END IF;
  RAISE NOTICE 'PROVED: a join_table link stages without edge keys';

  PERFORM public.discard_working_state('link_type', v_id, NULL);

  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: % fixture change(s) left staged', v_pending;
  END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'PROVED: the working state is empty again';
END $$;
