-- A link side's API name obeys the rules the page prints.
--
-- `object-link-types/create-link-type.md` gives the link type names step three
-- numbered instructions, and the third is the one we never honoured:
--
--   "The API name will be automatically generated based on the display name, but you can modify it if needed."
--   — object-link-types/create-link-type.md

-- Our form does the first half and refuses the second: `toCamel(sourceSide)`
-- with no override, so a side's API name is whatever the display name produced.
-- That is the web half, fixed beside this migration.
--
-- THIS is the database half, and it is the part that has to exist first,
-- because the moment a field becomes typeable the rules stop being academic.
-- The page states four, and two of them are facts about one row:
--
--   "Begin with a lowercase character and consist of only alphanumeric characters."
--   — object-link-types/create-link-type.md

--   "Be between 1 and 100 characters long."
--   — object-link-types/create-link-type.md

-- `link_types` carries source_api_name and target_api_name and has never
-- constrained either: pg_constraint holds exactly one api_name constraint on
-- the table, UNIQUE (source_object_type_id, api_name), which is about the LINK's
-- own api_name and says nothing about a side's.
--
-- WHAT IS DELIBERATELY NOT HERE, because guessing it would be worse than
-- leaving it:
--
--   "Be unique across all link types associated with the same object type."
--   — object-link-types/create-link-type.md

-- A side's API name is the name you traverse BY from the other end — the page's
-- own example is that an `assignedAircraft` name on the Aircraft side makes
-- `Flight.assignedAircraft.get()` work. So "the same object type" is the type
-- you traverse FROM, and which of our two columns that is for each side is
-- exactly the thing readings/link-type-view.md leaves open. A unique index
-- built on the wrong column would refuse legal links and permit colliding ones,
-- which is worse than no index. Recorded as an open question there instead.
--
-- The two remaining rules — NFKC normalisation and the reserved-keyword list —
-- are also absent: we have no reserved-keyword list to check against, and
-- asserting NFKC in a CHECK needs a normalisation function Postgres does not
-- expose to SQL. Named here so their absence is a record rather than an
-- oversight.
--
-- NULL stays legal. A link type may name neither side, which is what every
-- existing row does; the constraint speaks only to rows that name one.

alter table public.link_types
  add constraint link_types_source_api_name_format
  check (source_api_name IS NULL
         OR (source_api_name ~ '^[a-z][a-zA-Z0-9]*$' AND length(source_api_name) <= 100));

alter table public.link_types
  add constraint link_types_target_api_name_format
  check (target_api_name IS NULL
         OR (target_api_name ~ '^[a-z][a-zA-Z0-9]*$' AND length(target_api_name) <= 100));

comment on constraint link_types_source_api_name_format on public.link_types is
  'From object-link-types/create-link-type: a link side API name begins with a lowercase character, consists of only alphanumeric characters, and is between 1 and 100 characters long. Not a value set — a format.';
comment on constraint link_types_target_api_name_format on public.link_types is
  'From object-link-types/create-link-type: a link side API name begins with a lowercase character, consists of only alphanumeric characters, and is between 1 and 100 characters long. Not a value set — a format.';

-- PROVED BY DOING: the constraint is exercised, not merely declared. 592 is the
-- migration that asserted a catalogue while the body was broken.
--
-- The fixture is a real link type staged and applied through the front door,
-- because a direct INSERT would prove the CHECK and not the path. It is removed
-- afterwards, and the block refuses to run if anything is already staged.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_a uuid; v_b uuid; v_id uuid; v_pending int; v_msg text;
  v_fired boolean; v_pk text; v_status text;
BEGIN
  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: % change(s) already staged', v_pending;
  END IF;

  SELECT id INTO v_user FROM public.users ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_a FROM public.object_types ORDER BY created_at LIMIT 1;
  v_b := v_a;
  IF v_user IS NULL OR v_ont IS NULL OR v_a IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need a user, an ontology and an object type';
  END IF;
  -- A many_to_one link joins on the TARGET's primary key column, which
  -- guard_link_key enforces by name. Read it rather than assume it: the first
  -- attempt guessed 'pk' and was refused with
  -- Ontology:LinkKeyIsNotAPrimaryKey.
  SELECT backing_column INTO v_pk FROM public.object_type_properties
   WHERE object_type_id = v_b AND is_primary_key LIMIT 1;
  IF v_pk IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the object type has no primary key column';
  END IF;
  -- And the link's status must agree with the types it joins —
  -- OntologyMetadata:ConflictBetweenLinkTypeStatusAndObjectTypeStatus. Read it
  -- too; the fixture exists to exercise a CHECK, not to argue with the linter.
  SELECT status INTO v_status FROM public.object_types WHERE id = v_b;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  -- 1. A legal side name lands.
  SELECT public.save_link_type(jsonb_build_object(
    'ontology_id', v_ont::text,
    'source_object_type_id', v_a::text, 'target_object_type_id', v_b::text,
    'api_name', 'zz_proof_816', 'label', 'Proof 816',
    'cardinality', 'many_to_one', 'backing_kind', 'foreign_key',
    'status', v_status,
    'backing_column', v_pk,
    'source_api_name', 'assignedAircraft', 'target_api_name', 'flights'
  )) INTO v_id;
  PERFORM public.save_working_state();
  IF (SELECT source_api_name FROM public.link_types WHERE id = v_id) <> 'assignedAircraft' THEN
    RAISE EXCEPTION 'PROOF FAILED: a legal side API name did not land';
  END IF;
  RAISE NOTICE 'PROVED: a legal side API name lands through the front door';

  -- 2. An illegal one is refused. Capitalised first character, which the page
  --    forbids in the same sentence as the alphanumeric rule.
  v_fired := false;
  BEGIN
    UPDATE public.link_types SET source_api_name = 'AssignedAircraft' WHERE id = v_id;
  EXCEPTION WHEN check_violation THEN
    v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: a side API name beginning with a capital was accepted';
  END IF;
  RAISE NOTICE 'PROVED: an illegal side API name is refused (%)', left(v_msg, 60);

  -- 3. And a name with a space, the other half of "only alphanumeric".
  v_fired := false;
  BEGIN
    UPDATE public.link_types SET target_api_name = 'has flights' WHERE id = v_id;
  EXCEPTION WHEN check_violation THEN v_fired := true;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: a side API name with a space was accepted';
  END IF;

  -- 4. NULL remains legal, which every existing row relies on.
  UPDATE public.link_types SET source_api_name = NULL, target_api_name = NULL WHERE id = v_id;
  RAISE NOTICE 'PROVED: a null side API name is still legal';

  DELETE FROM public.link_types WHERE id = v_id;
  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT count(*) INTO v_pending FROM public.working_state_changes;
  IF v_pending <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: % fixture change(s) left staged', v_pending;
  END IF;
  IF EXISTS (SELECT 1 FROM public.link_types WHERE api_name = 'zz_proof_816') THEN
    RAISE EXCEPTION 'PROOF FAILED: the fixture link type was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixture removed, working state empty';
END $$;
