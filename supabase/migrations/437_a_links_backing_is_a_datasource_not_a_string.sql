-- A link type's backing is a datasource, not a table name in a text column.
--
-- Found by the first foundry-gap run. `link_types.backing_table` was free text
-- with DEFAULT 'object_links' — the first of the three universal tables
-- CLAUDE.md records as deleted. Every link created without explicit backing
-- landed claiming storage in a table that does not exist, and the old CHECK
-- required exactly that: `join_table` demanded `backing_table IS NOT NULL`, so
-- the lie was mandatory.
--
-- What Foundry actually registers is a dataset on a branch, and it says so
-- through its own error, which is about LINK types:
--
--   "If you receive the error `Phonograph2:DatasetAndBranchAlreadyRegistered`,
--    the datasource backing the link type you are trying to save is already
--    backing a different link type in the Ontology"
--                                       (object-link-types/create-link-type.md)
--
-- And the join methods are enumerated with their cardinalities:
--
--   "Object type foreign keys: Supports 'one-to-one' and 'many-to-one'
--    cardinality link types."
--   "Join table dataset: For 'many-to-many' cardinality link types."
--   "Backing object type: Object-backed link types expand on many-to-one
--    cardinality"                                        (create-link-type.md)
--
-- The many-to-many mapping needs one column PER SIDE:
--
--   "Select which columns in the link type's backing datasource map to the
--    primary keys of each of the linked object types"    (create-link-type.md)
--
-- ── DECISIONS, and which are inference ─────────────────────────────────────
-- · `backing_kind` becomes nullable with no default. A link whose backing is
--   not yet chosen is unconfigured, not silently join-table-backed. Requiring
--   backing at save is a wizard behaviour our surface cannot honour yet (it has
--   no backing picker), so "a link must have backing" belongs to
--   ontology_violations() when the surface can set one — recorded, not built.
-- · join_table ⇔ many_to_many, and foreign_key ⇒ NOT many_to_many. Enforced
--   exactly as far as the sentences go. foreign_key is not narrowed further:
--   our `cardinality` encodes direction (one_to_many vs many_to_one), and the
--   page's "one-to-one and many-to-one" does not say which side it is read
--   from. INFERENCE: treating the two directional spellings as one case.
-- · object_backed keeps only its existing shape. "Expand on many-to-one" is
--   not turned into a CHECK for the same directional reason.
-- · The uniqueness this error names is enforced here, on link types, where the
--   sentence actually puts it. The same-named guard on object_type_datasources
--   (405) borrowed this sentence for object types — that borrowing is
--   INFERENCE, and its comment now says so instead of citing this line as if
--   it covered them.

-- The CHECK references backing_table, so it must go first — dropping the
-- column would cascade it away and leave the later DROP CONSTRAINT nothing.
ALTER TABLE public.link_types DROP CONSTRAINT link_types_backing_check;
ALTER TABLE public.link_types DROP COLUMN backing_table;
ALTER TABLE public.link_types ALTER COLUMN backing_kind DROP DEFAULT;
ALTER TABLE public.link_types ALTER COLUMN backing_kind DROP NOT NULL;

-- The datasource: a dataset ON A BRANCH, exactly as object types bind theirs.
ALTER TABLE public.link_types
  ADD COLUMN dataset_id uuid REFERENCES public.datasets(id) ON DELETE RESTRICT,
  ADD COLUMN branch_id  uuid,
  ADD COLUMN source_key_column text,
  ADD COLUMN target_key_column text,
  ADD CONSTRAINT link_types_datasource_branch_fk
    FOREIGN KEY (branch_id, dataset_id)
    REFERENCES public.dataset_branches (id, dataset_id) ON DELETE CASCADE;

COMMENT ON COLUMN public.link_types.dataset_id IS
  'The join dataset backing a many-to-many link. A datasource is a dataset on a branch, and one may back only one link type — Phonograph2:DatasetAndBranchAlreadyRegistered.';
COMMENT ON COLUMN public.link_types.source_key_column IS
  'Which column of the join dataset maps to the source type''s primary key — "Select which columns in the link type''s backing datasource map to the primary keys of each of the linked object types".';

ALTER TABLE public.link_types ADD CONSTRAINT link_types_backing_check CHECK (
  backing_kind IS NULL
    AND dataset_id IS NULL AND branch_id IS NULL
    AND backing_column IS NULL AND source_key_column IS NULL AND target_key_column IS NULL
    AND backing_object_type_id IS NULL
  OR backing_kind = 'foreign_key'  AND backing_column IS NOT NULL AND dataset_id IS NULL
  OR backing_kind = 'join_table'   AND dataset_id IS NOT NULL AND branch_id IS NOT NULL
                                   AND source_key_column IS NOT NULL AND target_key_column IS NOT NULL
                                   AND backing_column IS NULL
  OR backing_kind = 'object_backed' AND backing_object_type_id IS NOT NULL AND dataset_id IS NULL
);

-- The stated cardinality rules, and only those.
ALTER TABLE public.link_types ADD CONSTRAINT link_types_backing_cardinality CHECK (
  backing_kind IS DISTINCT FROM 'join_table'  OR cardinality = 'many_to_many'
);
ALTER TABLE public.link_types ADD CONSTRAINT link_types_foreign_key_cardinality CHECK (
  backing_kind IS DISTINCT FROM 'foreign_key' OR cardinality <> 'many_to_many'
);

-- One datasource, one link type. The index is the race-safe rule; the trigger
-- is the named error the docs print.
CREATE UNIQUE INDEX link_types_one_link_per_datasource
  ON public.link_types (dataset_id, branch_id) WHERE dataset_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_link_type_datasource()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dataset_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.link_types l
     WHERE l.dataset_id = NEW.dataset_id AND l.branch_id = NEW.branch_id
       AND l.id <> NEW.id) THEN
    RAISE EXCEPTION 'Phonograph2:DatasetAndBranchAlreadyRegistered — the datasource backing the link type you are trying to save is already backing a different link type in the Ontology'
      USING HINT = 'Create a new dataset for this link, or reuse the existing link type.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_link_type_datasource
  BEFORE INSERT OR UPDATE ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_link_type_datasource();

-- The object-type twin borrowed this sentence; say so where it is read.
COMMENT ON FUNCTION public.guard_object_type_datasource() IS
  'One datasource backs one object type. The error name is borrowed from create-link-type.md, whose sentence is about LINK types — the object-type rule is our inference from the same registration model, not a quotation.';

-- The stager carries the new binding.
CREATE OR REPLACE FUNCTION public.save_link_type(p_link jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t      uuid := nullif(p_link->>'id', '')::uuid;
  live   boolean;
  fields jsonb;
BEGIN
  live := t IS NOT NULL AND EXISTS (SELECT 1 FROM public.link_types WHERE id = t);
  IF t IS NULL THEN t := gen_random_uuid(); END IF;

  fields := jsonb_strip_nulls(jsonb_build_object(
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

  PERFORM public.stage_change('link_type', t, fields, NULL,
                              CASE WHEN live THEN 'modified' ELSE 'created' END);
  RETURN t;
END $$;

REVOKE ALL ON FUNCTION public.save_link_type(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_link_type(jsonb) TO authenticated;

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; dsa uuid; bra uuid; dsj uuid; brj uuid;
  a uuid; b uuid; l1 uuid; l2 uuid; usr uuid := gen_random_uuid(); before text;
  props jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('link-437') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws437@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws437@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS437');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'ws437', 'WS 437') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws437', 'WS437') RETURNING id INTO proj;

  props := jsonb_build_array(jsonb_build_object('property_id','k','display_name','K',
    'api_name','k','base_type','string','source','column','backing_column','k',
    'is_primary_key',true,'is_title_key',true,'required',true));

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flights', 'flights') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa,'master') RETURNING id INTO bra;
  a := public.save_object_type(jsonb_build_object('api_name','Flight','label','Flight',
        'ontology_id', ont::text, 'datasources', jsonb_build_array(
          jsonb_build_object('dataset_id', dsa::text,'branch_id', bra::text))), props);
  PERFORM public.save_working_state();

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'alerts', 'alerts') RETURNING id INTO dsa;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsa,'master') RETURNING id INTO bra;
  b := public.save_object_type(jsonb_build_object('api_name','Alert','label','Alert',
        'ontology_id', ont::text, 'datasources', jsonb_build_array(
          jsonb_build_object('dataset_id', dsa::text,'branch_id', bra::text))), props);
  PERFORM public.save_working_state();

  -- The join dataset for the many-to-many link.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'flight_alerts', 'flight_alerts') RETURNING id INTO dsj;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (dsj,'master') RETURNING id INTO brj;

  -- 1. A bare link — no backing chosen yet — saves. The surface has no picker,
  --    and an unconfigured backing must not be a silent 'object_links'.
  l1 := public.save_link_type(jsonb_build_object(
    'source_object_type_id', a::text, 'target_object_type_id', b::text,
    'api_name','flightAlerts', 'label','Flight alerts', 'ontology_id', ont::text));
  PERFORM public.save_working_state();
  IF (SELECT backing_kind FROM public.link_types WHERE id = l1) IS NOT NULL THEN
    RAISE EXCEPTION 'an unconfigured link got a backing kind by default';
  END IF;

  -- 2. A join-dataset backing lands, with both key columns.
  PERFORM public.save_link_type(jsonb_build_object('id', l1::text,
    'backing_kind','join_table','cardinality','many_to_many',
    'dataset_id', dsj::text, 'branch_id', brj::text,
    'source_key_column','flight_id','target_key_column','alert_id'));
  PERFORM public.save_working_state();
  IF (SELECT dataset_id FROM public.link_types WHERE id = l1) IS DISTINCT FROM dsj THEN
    RAISE EXCEPTION 'the join dataset did not land';
  END IF;

  -- 3. The same datasource on a second link is the documented refusal.
  BEGIN
    INSERT INTO public.link_types (organization_id, ontology_id,
      source_object_type_id, target_object_type_id, api_name, label,
      backing_kind, cardinality, dataset_id, branch_id, source_key_column, target_key_column)
    VALUES (org, ont, b, a, 'alertFlights', 'Alert flights',
      'join_table', 'many_to_many', dsj, brj, 'alert_id', 'flight_id');
    RAISE EXCEPTION 'one datasource backed two link types';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%DatasetAndBranchAlreadyRegistered%' THEN RAISE; END IF;
  END;

  -- 4. A join dataset with any cardinality but many-to-many is refused.
  BEGIN
    UPDATE public.link_types SET cardinality = 'one_to_one' WHERE id = l1;
    RAISE EXCEPTION 'a join-dataset link accepted one_to_one';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 5. And a foreign key cannot claim many-to-many.
  BEGIN
    l2 := gen_random_uuid();
    INSERT INTO public.link_types (id, organization_id, ontology_id,
      source_object_type_id, target_object_type_id, api_name, label,
      backing_kind, backing_column, cardinality)
    VALUES (l2, org, ont, a, b, 'fkWrong', 'FK wrong',
      'foreign_key', 'flight_id', 'many_to_many');
    RAISE EXCEPTION 'a foreign key link accepted many_to_many';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '437: a link''s backing is a registered datasource, or nothing yet — never a string';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
