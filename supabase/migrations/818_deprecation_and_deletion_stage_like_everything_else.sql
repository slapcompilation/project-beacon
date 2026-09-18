-- Deprecation and deletion stage like everything else.
--
-- The Ontology Manager's contract is that nothing reaches the ontology until
-- you save it, and the Cleanup page says so for these two operations by name:
--
--   "Deprecation and deletion are staged the same way as normal Ontology modifications."
--   — ontology-manager/cleanup.md

-- `docs/foundry-reference/readings/ontology-cleanup.md` took that as its Decision 8 — staging is
-- reused, not rebuilt — and the code does not honour it. Two paths in the web
-- write live:
--
--   · deleteObjectType did `supabase.from('object_types').delete()`, where
--     every sibling kind goes through delete_ontology_resource and stages a
--     `deleted` operation. Fixed beside this migration; it needed no SQL,
--     because delete_ontology_resource is kind-agnostic and
--     ontology_resource_row already handles object_type.
--   · setObjectTypeStatus did `.update({status, visibility, deprecation_*})`,
--     and THAT one could not be routed through the save session, because
--     save_object_type does not carry any of those keys. This migration is
--     what makes it possible.
--
-- It matters beyond consistency: the save session is where the linter refuses,
-- so a live status change or delete was a change nothing could review.
--
-- WHILE HERE, A DROPPED KEY OF THE SAME SHAPE. `plural_label` is sent by the
-- web on every object type save and is absent from the staged payload, so it
-- has never reached the ontology through this path. That is the same defect
-- 815 fixed for an object-backed link's two edges, and the gap analysis
-- recorded it as 725 having patched the APPLIER and not the STAGER — the applier
-- has understood plural_label since 725 and the stager never learned it.
--
-- PRESENCE-GATED, every one of them, which is this function's own rule:
-- "Only what the caller actually said. An invented empty section is an
-- instruction to delete everything in it." A caller that does not mention
-- status leaves status alone, so the existing save path is unchanged.
--
-- PATCHED, NOT RETYPED: pg_get_functiondef's own output with one block added.

create or replace function public.save_object_type(p_object_type jsonb, p_properties jsonb, p_branch uuid DEFAULT NULL::uuid)
 returns uuid
 language plpgsql
 set search_path to 'public'
as $function$
DECLARE
  t      uuid := nullif(p_object_type->>'id', '')::uuid;
  exists_live boolean;
  v_fields jsonb;
  k text;
BEGIN
  exists_live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.object_types WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  v_fields := jsonb_strip_nulls(jsonb_build_object('project_id', p_object_type->>'project_id',
    'api_name',    p_object_type->>'api_name',
    'label',       p_object_type->>'label',
    'icon',        coalesce(p_object_type->>'icon', 'cube'),
    'description', coalesce(p_object_type->>'description', '')
  ));

  -- Only what the caller actually said. An invented empty section is an
  -- instruction to delete everything in it.
  IF p_properties IS NOT NULL THEN
    v_fields := v_fields || jsonb_build_object('properties', p_properties);
  END IF;
  IF p_object_type ? 'datasources' THEN
    v_fields := v_fields || jsonb_build_object('datasources', p_object_type->'datasources');
  END IF;

  -- The metadata the stager used to drop. Each is carried only when the caller
  -- names it, including when it is explicitly null: clearing a deprecation
  -- reason is a real edit, so `? key` is the test rather than a null check.
  FOREACH k IN ARRAY ARRAY[
    'plural_label', 'status', 'visibility',
    'deprecation_reason', 'deprecation_deadline', 'replaced_by'
  ] LOOP
    IF p_object_type ? k THEN
      v_fields := v_fields || jsonb_build_object(k, p_object_type->k);
    END IF;
  END LOOP;

  IF NOT exists_live THEN
    v_fields := v_fields || jsonb_build_object(
      'ontology_id', coalesce(nullif(p_object_type->>'ontology_id',''),
                              public.default_ontology()::text));
  END IF;

  PERFORM public.stage_change('object_type', t, v_fields, p_branch,
                              CASE WHEN exists_live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $function$;

-- PROVED BY DOING.
--
-- Each new key is staged when named and absent when not — both halves, because
-- a stager that carries everything unconditionally would wipe a status on every
-- ordinary save, which is a worse bug than the one being fixed.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_id uuid; v_fields jsonb; v_pending int; k text;
BEGIN
  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: % change(s) already staged', v_pending;
  END IF;

  SELECT id INTO v_user FROM public.users ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj FROM public.projects WHERE NOT auto_protect_new ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need a user, an ontology and an unprotected project';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  -- 1. Named: every key reaches the staged payload.
  SELECT public.save_object_type(jsonb_build_object(
    'ontology_id', v_ont::text, 'project_id', v_proj::text,
    'api_name', 'ZzProof818', 'label', 'Zz Proof 818',
    'plural_label', 'Zz Proof 818s',
    'status', 'deprecated', 'visibility', 'hidden',
    'deprecation_reason', 'proof', 'deprecation_deadline', '2099-01-01',
    'replaced_by', NULL
  ), NULL) INTO v_id;

  SELECT fields INTO v_fields FROM public.working_state_changes WHERE resource_id = v_id;
  IF v_fields IS NULL THEN RAISE EXCEPTION 'PROOF FAILED: nothing staged'; END IF;
  FOREACH k IN ARRAY ARRAY['plural_label','status','visibility',
                           'deprecation_reason','deprecation_deadline','replaced_by'] LOOP
    IF NOT (v_fields ? k) THEN
      RAISE EXCEPTION 'PROOF FAILED: the stager still drops %: %', k, v_fields;
    END IF;
  END LOOP;
  IF v_fields->>'status' <> 'deprecated' OR v_fields->>'plural_label' <> 'Zz Proof 818s' THEN
    RAISE EXCEPTION 'PROOF FAILED: a staged value is wrong: %', v_fields;
  END IF;
  RAISE NOTICE 'PROVED: all six keys stage when the caller names them';

  PERFORM public.discard_working_state('object_type', v_id, NULL);

  -- 2. Unnamed: none of them appears, so an ordinary save cannot blank a
  --    status it never mentioned.
  SELECT public.save_object_type(jsonb_build_object(
    'ontology_id', v_ont::text, 'project_id', v_proj::text,
    'api_name', 'ZzProof818b', 'label', 'Zz Proof 818 b'
  ), NULL) INTO v_id;
  SELECT fields INTO v_fields FROM public.working_state_changes WHERE resource_id = v_id;
  FOREACH k IN ARRAY ARRAY['plural_label','status','visibility',
                           'deprecation_reason','deprecation_deadline','replaced_by'] LOOP
    IF v_fields ? k THEN
      RAISE EXCEPTION 'PROOF FAILED: % was staged though the caller never named it: %', k, v_fields;
    END IF;
  END LOOP;
  RAISE NOTICE 'PROVED: an unnamed key stages nothing';

  PERFORM public.discard_working_state('object_type', v_id, NULL);
  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: % fixture change(s) left staged', v_pending;
  END IF;
  RAISE NOTICE 'PROVED: the working state is empty again';
END $$;
