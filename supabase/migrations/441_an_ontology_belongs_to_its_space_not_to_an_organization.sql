-- An ontology belongs to its space, and the space names the organizations.
--
-- The gate item, taken with the operator's yes. Three sentences settle it:
--
--   "A space is a high-level container of projects, with one common ontology…
--    Spaces are restricted by an organization (or set of organizations), and
--    that restriction will apply to the projects in the space as well as the
--    associated ontology."                        (security/orgs-and-spaces)
--
--   "The scope of information protected by organizations includes spaces,
--    ontologies, projects, users, groups… However, individual resources cannot
--    be tied to an organization."                 (security/orgs-and-spaces)
--
--   "Access requirements: Users need permission from at least one organization
--    to access this space. Projects in this space can only be visible by
--    organizations in this list."     (platform-security-management/manage-orgs-and-spaces)
--
-- A LIST, applied at the space and inherited. Ours pinned every ontology — and,
-- through denormalized copies, every resource in it — to exactly one member of
-- that list, which made `shared-ontologies.md`'s "allows multiple organizations
-- to collaborate" inexpressible. Migration 412 built the scalar to hang a
-- composite FK off; 414 constrained it to the space's list; this removes it and
-- resolves organizations where the pages put them.
--
-- WHY NOW: uniqueness scope, the gate's own category. Zero object types exist.
--
-- ── THE TWO PREDICATES ─────────────────────────────────────────────────────
--   auth_in_ontology(ont)        my orgs (member OR guest) ∩ the space's list
--                                ≠ ∅ — "member or guest member of at least one
--                                organization applied". Reads.
--   auth_member_of_ontology(ont) my PRIMARY org is in the list. Writes — 435's
--                                rule that guests read and members write,
--                                restated against the list.
--
-- ── DECISIONS, and which are inference ─────────────────────────────────────
-- · `ontologies.api_name` becomes UNIQUE globally. The old scope was
--   per-organization, which no longer exists as a column. The database is one
--   enrollment ("An enrollment represents an instance of the Foundry
--   platform"), so enrollment-wide is the honest scope. INFERENCE.
-- · Organizations in the space's list may WRITE, not only read — that is what
--   "collaborate" means in shared-ontologies.md, and role checks still apply.
-- · 414's constraint dissolves rather than moves: with no scalar there is
--   nothing to pin to the list; membership of the list IS the access rule.
-- · `object_sets` finally gets its `ontology_id` — it was the one resource
--   scoped per-organization while every sibling moved per-ontology in 412.

-- ── the predicates, first, because every policy below composes them ────────
CREATE OR REPLACE FUNCTION public.auth_in_ontology(p_ontology uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ontologies o
    JOIN public.space_organizations so ON so.space_id = o.space_id
   WHERE o.id = p_ontology AND public.auth_in_org(so.organization_id))
$$;

COMMENT ON FUNCTION public.auth_in_ontology(uuid) IS
  'May this session SEE the ontology: some organization I am a member or guest of is in its space''s list. "Users need permission from at least one organization to access this space."';

CREATE OR REPLACE FUNCTION public.auth_member_of_ontology(p_ontology uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ontologies o
    JOIN public.space_organizations so ON so.space_id = o.space_id
   WHERE o.id = p_ontology AND so.organization_id = public.auth_org_id())
$$;

COMMENT ON FUNCTION public.auth_member_of_ontology(uuid) IS
  'May this session WRITE in the ontology (role checks apply on top): my primary organization is in its space''s list. Guests read; members write.';

REVOKE ALL ON FUNCTION public.auth_in_ontology(uuid), public.auth_member_of_ontology(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_in_ontology(uuid), public.auth_member_of_ontology(uuid) TO authenticated;

-- ── the columns go, and their dependents with them ─────────────────────────
-- CASCADE takes each column's FK, the composite FKs into ontologies, and every
-- policy whose expression names it. Every dropped policy is recreated below,
-- and the final assertion refuses to finish if any table is left unreadable.
ALTER TABLE public.object_types           DROP COLUMN organization_id CASCADE;
ALTER TABLE public.link_types             DROP COLUMN organization_id CASCADE;
ALTER TABLE public.shared_properties      DROP COLUMN organization_id CASCADE;
ALTER TABLE public.ontology_interfaces    DROP COLUMN organization_id CASCADE;
ALTER TABLE public.action_types           DROP COLUMN organization_id CASCADE;
ALTER TABLE public.type_groups            DROP COLUMN organization_id CASCADE;
ALTER TABLE public.ontology_branches      DROP COLUMN organization_id CASCADE;
ALTER TABLE public.object_type_interfaces DROP COLUMN organization_id CASCADE;

-- Three steps, not one: ADD COLUMN evaluates a volatile default once even on
-- an empty table, and default_ontology() rightly raises with no ontology to
-- name. Column first, then the default for future inserts, then NOT NULL —
-- which validates instantly against zero rows.
ALTER TABLE public.object_sets
  ADD COLUMN ontology_id uuid REFERENCES public.ontologies(id) ON DELETE CASCADE;
ALTER TABLE public.object_sets ALTER COLUMN ontology_id SET DEFAULT public.default_ontology();
ALTER TABLE public.object_sets ALTER COLUMN ontology_id SET NOT NULL;
ALTER TABLE public.object_sets DROP COLUMN organization_id CASCADE;
ALTER TABLE public.object_sets ADD CONSTRAINT object_sets_api_name_per_ontology
  UNIQUE (ontology_id, api_name);
CREATE INDEX object_sets_ontology_idx ON public.object_sets (ontology_id);

ALTER TABLE public.ontologies DROP COLUMN organization_id CASCADE;
ALTER TABLE public.ontologies ADD CONSTRAINT ontologies_api_name_unique UNIQUE (api_name);

-- ── ontologies: the space's list is the whole rule ─────────────────────────
CREATE POLICY "read ontologies in scope" ON public.ontologies
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.space_organizations so
     WHERE so.space_id = ontologies.space_id AND public.auth_in_org(so.organization_id)));

CREATE POLICY "admins author ontologies" ON public.ontologies
  FOR INSERT WITH CHECK (
    public.auth_role() = ANY (ARRAY['owner','admin'])
    AND EXISTS (SELECT 1 FROM public.space_organizations so
                 WHERE so.space_id = ontologies.space_id
                   AND so.organization_id = public.auth_org_id()));

CREATE POLICY "admins update ontologies" ON public.ontologies
  FOR UPDATE USING (
    public.auth_role() = ANY (ARRAY['owner','admin'])
    AND EXISTS (SELECT 1 FROM public.space_organizations so
                 WHERE so.space_id = ontologies.space_id
                   AND so.organization_id = public.auth_org_id()));

CREATE POLICY "admins delete ontologies" ON public.ontologies
  FOR DELETE USING (
    public.auth_role() = ANY (ARRAY['owner','admin'])
    AND EXISTS (SELECT 1 FROM public.space_organizations so
                 WHERE so.space_id = ontologies.space_id
                   AND so.organization_id = public.auth_org_id()));

-- ── the resources, each policy a faithful translation of the one it replaces ─
CREATE POLICY "read object types in scope" ON public.object_types
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "admins author object types" ON public.object_types
  FOR INSERT WITH CHECK (
    public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id)
    AND created_by_user_id = auth.uid());
CREATE POLICY "admins update object types" ON public.object_types
  FOR UPDATE USING (public.auth_member_of_ontology(ontology_id)
    AND (public.auth_role() = ANY (ARRAY['owner','admin'])
         OR public.has_resource_role('object_type', id, 'editor')));
CREATE POLICY "admins delete object types" ON public.object_types
  FOR DELETE USING (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id));

CREATE POLICY "read link types in scope" ON public.link_types
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "admins author link types" ON public.link_types
  FOR INSERT WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id) AND created_by_user_id = auth.uid());
CREATE POLICY "admins update link types" ON public.link_types
  FOR UPDATE USING (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id));
CREATE POLICY "admins delete link types" ON public.link_types
  FOR DELETE USING (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id));

CREATE POLICY "members read shared properties" ON public.shared_properties
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "admins author shared properties" ON public.shared_properties
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id));

CREATE POLICY "members read interfaces in scope" ON public.ontology_interfaces
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "admins author interfaces in scope" ON public.ontology_interfaces
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id));

CREATE POLICY "read action types in scope" ON public.action_types
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "admins author action types" ON public.action_types
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id));

CREATE POLICY "read groups in visible projects" ON public.type_groups
  FOR SELECT USING (public.auth_in_ontology(ontology_id)
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "editors write groups" ON public.type_groups
  FOR ALL USING (public.auth_member_of_ontology(ontology_id)
    AND (public.auth_role() = ANY (ARRAY['owner','admin'])
         OR public.project_role(project_id) = ANY (ARRAY['owner','editor'])))
  WITH CHECK (public.auth_member_of_ontology(ontology_id)
    AND (public.auth_role() = ANY (ARRAY['owner','admin'])
         OR public.project_role(project_id) = ANY (ARRAY['owner','editor'])));

CREATE POLICY "read branches in scope" ON public.ontology_branches
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "members create branches" ON public.ontology_branches
  FOR INSERT WITH CHECK (public.auth_member_of_ontology(ontology_id));

CREATE POLICY "members read implementations in scope" ON public.object_type_interfaces
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = object_type_interfaces.interface_id
       AND public.auth_in_ontology(i.ontology_id)));
CREATE POLICY "admins manage implementations in scope" ON public.object_type_interfaces
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = object_type_interfaces.interface_id
       AND public.auth_member_of_ontology(i.ontology_id)))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.ontology_interfaces i
     WHERE i.id = object_type_interfaces.interface_id
       AND public.auth_member_of_ontology(i.ontology_id)));

CREATE POLICY "members read object sets in scope" ON public.object_sets
  FOR SELECT USING (public.auth_in_ontology(ontology_id));
CREATE POLICY "admins author object sets in scope" ON public.object_sets
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id))
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin'])
    AND public.auth_member_of_ontology(ontology_id)
    AND (subject_type_id IS NULL OR EXISTS (
          SELECT 1 FROM public.object_types t
           WHERE t.id = object_sets.subject_type_id AND public.auth_in_ontology(t.ontology_id)))
    AND (subject_interface_id IS NULL OR EXISTS (
          SELECT 1 FROM public.ontology_interfaces i
           WHERE i.id = object_sets.subject_interface_id AND public.auth_in_ontology(i.ontology_id))));

-- The five that reach their ontology through the object type they hang off.
CREATE POLICY "read properties of visible object types" ON public.object_type_properties
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_properties.object_type_id AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "authors write properties" ON public.object_type_properties
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_properties.object_type_id
       AND public.auth_member_of_ontology(t.ontology_id)
       AND (public.auth_role() = ANY (ARRAY['owner','admin'])
            OR public.has_resource_role('object_type', t.id, 'editor'))));

CREATE POLICY "read capabilities of visible object types" ON public.object_type_capabilities
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_capabilities.object_type_id AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "authors write capabilities" ON public.object_type_capabilities
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_capabilities.object_type_id
       AND public.auth_member_of_ontology(t.ontology_id)
       AND (public.auth_role() = ANY (ARRAY['owner','admin'])
            OR public.has_resource_role('object_type', t.id, 'editor'))));

CREATE POLICY "read datasources of visible object types" ON public.object_type_datasources
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_datasources.object_type_id AND public.auth_in_ontology(t.ontology_id)));

CREATE POLICY "members read time series props" ON public.time_series_properties
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = time_series_properties.object_type_id AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "admins author time series props" ON public.time_series_properties
  FOR ALL USING (public.auth_role() = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = time_series_properties.object_type_id
       AND public.auth_member_of_ontology(t.ontology_id)));

CREATE POLICY "read edits of visible object types" ON public.object_edits
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_edits.object_type_id AND public.auth_in_ontology(t.ontology_id)));
CREATE POLICY "members write edits where edits are enabled" ON public.object_edits
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_edits.object_type_id
       AND public.auth_member_of_ontology(t.ontology_id) AND t.edits_enabled));

-- ── the four functions that compared organizations ─────────────────────────
CREATE OR REPLACE FUNCTION public.default_ontology()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int; result uuid;
BEGIN
  -- The ontologies of the spaces my primary organization is in. Writes name
  -- their ontology through this, so guest visibility does not widen it.
  SELECT count(*), (array_agg(o.id))[1] INTO n, result
    FROM public.ontologies o
   WHERE EXISTS (SELECT 1 FROM public.space_organizations so
                  WHERE so.space_id = o.space_id
                    AND so.organization_id = public.auth_org_id());
  IF n = 0 THEN
    RAISE EXCEPTION 'Ontology:NoOntology — no space of this organization holds an ontology yet'
      USING HINT = 'Create one, or name the ontology explicitly.';
  END IF;
  IF n > 1 THEN
    RAISE EXCEPTION 'Ontology:AmbiguousOntology — this organization reaches % ontologies; name the one you mean', n
      USING HINT = 'Pass ontology_id explicitly. A silent guess would write to the wrong one.';
  END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.can_see_branch(p_branch uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ontology_branches b
                  WHERE b.id = p_branch AND public.auth_in_ontology(b.ontology_id))
$$;

CREATE OR REPLACE FUNCTION public.enforce_shared_property_type()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE sp record; ot_ont uuid;
BEGIN
  IF NEW.shared_property_id IS NULL THEN RETURN NEW; END IF;
  SELECT api_name, base_type, ontology_id INTO sp
    FROM public.shared_properties WHERE id = NEW.shared_property_id;
  SELECT ontology_id INTO ot_ont FROM public.object_types WHERE id = NEW.object_type_id;
  -- Same ontology, which is what the composite FK used to guarantee through
  -- the organization it no longer carries.
  IF sp.ontology_id IS DISTINCT FROM ot_ont THEN
    RAISE EXCEPTION 'Ontology:SharedPropertyInAnotherOntology — "%" belongs to a different ontology', sp.api_name;
  END IF;
  IF NEW.base_type IS DISTINCT FROM sp.base_type THEN
    RAISE EXCEPTION 'Ontology:SharedPropertyTypeMismatch — property "%" is % but shared property "%" is %. A shared property can only be applied where the base type matches.',
      NEW.property_id, NEW.base_type, sp.api_name, sp.base_type;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_object_type_datasource()
RETURNS trigger LANGUAGE plpgsql
AS $$
DECLARE
  n int; holder uuid; bad text; ds_org uuid; ot_ont uuid;
BEGIN
  SELECT organization_id INTO ds_org FROM public.datasets WHERE id = NEW.dataset_id;
  SELECT ontology_id INTO ot_ont FROM public.object_types WHERE id = NEW.object_type_id;
  -- The dataset's organization must be one the ontology's space serves — the
  -- from-space restatement of the old same-organization rule.
  IF NOT EXISTS (
    SELECT 1 FROM public.ontologies o
    JOIN public.space_organizations so ON so.space_id = o.space_id
   WHERE o.id = ot_ont AND so.organization_id = ds_org) THEN
    RAISE EXCEPTION 'Ontology:DatasourceInAnotherOrganization — the dataset''s organization is not in this ontology''s space';
  END IF;

  SELECT object_type_id INTO holder FROM public.object_type_datasources
   WHERE dataset_id = NEW.dataset_id AND branch_id = NEW.branch_id
     AND id IS DISTINCT FROM NEW.id;
  IF holder IS NOT NULL THEN
    RAISE EXCEPTION 'Phonograph2:DatasetAndBranchAlreadyRegistered — this datasource is already backing a different object type and cannot be used again'
      USING HINT = 'Pick another dataset, or another branch of this one.';
  END IF;

  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = NEW.object_type_id AND id IS DISTINCT FROM NEW.id;
  IF n >= 70 THEN
    RAISE EXCEPTION 'Ontology:TooManyDatasources — an object type is limited to 70 datasources, and this one already has %', n;
  END IF;

  SELECT string_agg(f ->> 'name', ', ') INTO bad
    FROM jsonb_array_elements(coalesce(public.dataset_branch_schema(NEW.branch_id), '[]'::jsonb)) f
   WHERE f ->> 'type' = 'MAP';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:UnsupportedColumnType — a backing datasource may not contain MAP columns (%)', bad
      USING HINT = 'Map is not a property base type; there is nothing a MAP column could back.';
  END IF;

  RETURN NEW;
END $$;

-- ── assertions: the shared-space matrix, as authenticated ──────────────────
DO $$
DECLARE
  orga uuid; orgb uuid; orgc uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  before text; n int; bad text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('a-441') RETURNING id INTO orga;
  INSERT INTO public.organizations (name) VALUES ('b-441') RETURNING id INTO orgb;
  INSERT INTO public.organizations (name) VALUES ('c-441') RETURNING id INTO orgc;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a441@beacon.test'),
    (ub,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b441@beacon.test'),
    (uc,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c441@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (ua,'a441@beacon.test','admin',orga), (ub,'b441@beacon.test','admin',orgb),
    (uc,'c441@beacon.test','admin',orgc);

  -- A makes the space and its ontology; B attaches itself to the space.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', ua::text, 'app_metadata',
      json_build_object('role','admin','org_id',orga))::text, true);
  SET LOCAL ROLE authenticated;
  sp := public.create_space('Shared441');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'shared441', 'Shared 441') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (orga, sp, 's441', 'S441') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (orga, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','k','display_name','K','api_name','k',
      'base_type','string','source','column','backing_column','k',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();

  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', ub::text, 'app_metadata',
      json_build_object('role','admin','org_id',orgb))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, orgb);

  -- 1. B is in the list: the shared ontology and its types are visible…
  IF (SELECT count(*) FROM public.ontologies WHERE id = ont) <> 1 THEN
    RAISE EXCEPTION 'an organization in the space list cannot see the ontology';
  END IF;
  IF (SELECT count(*) FROM public.object_types WHERE id = t) <> 1 THEN
    RAISE EXCEPTION 'an organization in the space list cannot see the object types';
  END IF;
  IF (SELECT count(*) FROM public.object_type_properties WHERE object_type_id = t) <> 1 THEN
    RAISE EXCEPTION 'the properties do not reach through for a listed organization';
  END IF;

  -- 2. …and writable: "allows multiple organizations to collaborate".
  UPDATE public.object_types SET description = 'B was here' WHERE id = t;
  IF (SELECT description FROM public.object_types WHERE id = t) <> 'B was here' THEN
    RAISE EXCEPTION 'a listed organization cannot collaborate';
  END IF;

  -- 3. C is not in the list and sees nothing.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uc::text, 'app_metadata',
      json_build_object('role','admin','org_id',orgc))::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.ontologies WHERE id = ont) <> 0 THEN
    RAISE EXCEPTION 'an organization outside the space list can see the ontology';
  END IF;

  -- 4. A guest of A reads and cannot write — 435's rule, against the list.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uc::text, 'app_metadata',
      jsonb_build_object('role','admin','org_id',orgc,
                         'guest_org_ids', jsonb_build_array(orga::text)))::text, true);
  IF (SELECT count(*) FROM public.object_types WHERE id = t) <> 1 THEN
    RAISE EXCEPTION 'a guest of a listed organization cannot read';
  END IF;
  UPDATE public.object_types SET description = 'guest wrote this' WHERE id = t;
  IF (SELECT description FROM public.object_types WHERE id = t) = 'guest wrote this' THEN
    RAISE EXCEPTION 'a guest wrote to the shared ontology';
  END IF;

  -- 5. The api name is enrollment-unique now.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uc::text, 'app_metadata',
      json_build_object('role','admin','org_id',orgc))::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.create_space('Other441');
    INSERT INTO public.ontologies (space_id, api_name, label)
    SELECT s.id, 'shared441', 'Impostor' FROM public.spaces s WHERE s.name = 'Other441';
    RAISE EXCEPTION 'two ontologies share an api name';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 6. No affected table was left unreadable by the CASCADE.
  RESET ROLE;
  SELECT string_agg(c.relname, ', ') INTO bad
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relrowsecurity
     AND c.relname IN ('ontologies','object_types','link_types','shared_properties',
                       'ontology_interfaces','object_type_interfaces','object_sets',
                       'ontology_branches','action_types','type_groups',
                       'object_type_properties','object_type_datasources',
                       'object_type_capabilities','time_series_properties','object_edits')
     AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polcmd IN ('r','*'));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'CASCADE left these tables with no read policy: %', bad;
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '441: the space''s list is the rule — listed orgs collaborate, outsiders see nothing, guests read';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
