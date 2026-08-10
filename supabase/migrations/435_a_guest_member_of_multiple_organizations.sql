-- Organization membership is a set, and we had collapsed it to a scalar.
--
--   "Every user is a member of only one organization, but can be a **guest
--    member of multiple organizations**. To meet access requirements, users must
--    be a member **or guest member of at least one** organization applied to a
--    Project."                                        (security/orgs-and-spaces)
--
-- `auth_org_id()` returns one uuid and every policy compares equality against
-- it, so a guest member sees nothing anywhere. The singular half is right and
-- stays — one primary organization per user is Foundry's rule, and
-- `configure-workshop` calls it "their primary Organization". What was missing
-- is the plural half beside it.
--
-- ── WHY NOW, WITH NOTHING IN THE ONTOLOGY ──────────────────────────────────
-- This is a uniqueness-scope change, which the build map's irreversibility gate
-- names as one of the six expensive kinds: "API names moved from
-- per-organization to per-ontology while empty. Once populated, the same move
-- means resolving collisions in someone's data." The ontology holds zero object
-- types and there is one organization. It will never be cheaper.
--
-- ── GUESTS READ; WRITING IS STILL THE PRIMARY ORGANIZATION'S ───────────────
-- The published rule is about *access requirements* — being able to see a thing
-- at all. What a user may then DO is roles, which we model separately in
-- `project_role_grants`. So the 14 ontology SELECT policies compose against the
-- set; every write policy is left comparing against `auth_org_id()`. A guest
-- who should also be able to write gets a role, not a wider claim.
--
-- ── WHAT THIS DELIBERATELY DOES NOT TOUCH, AND WHY IT IS A QUESTION ────────
-- `users`, `projects`, `spaces`, `scoped_sessions`, `scoped_session_markings`
-- and `organizations` are org-scoped too. Whether a guest of an organization
-- should see its *user list* is not something these pages settle —
-- `orgs-and-spaces` says organizations protect "spaces, ontologies, projects,
-- users, groups, tag categories, and collections" without saying what a guest
-- gets. Silently broadening a security boundary on a guess is the failure this
-- repository is organised against, so those policies are unchanged and the
-- question goes to the operator.

CREATE TABLE public.organization_guests (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (organization_id, user_id)
);

COMMENT ON TABLE public.organization_guests IS
  'Guest membership. "Every user is a member of only one organization, but can be a guest member of multiple organizations." The primary membership is public.users.organization_id; this is the plural half beside it.';

CREATE INDEX organization_guests_user_idx ON public.organization_guests (user_id);

-- Guest of the organization you are already a member of is not a thing; it
-- would double-count in the claim and read as a wider grant than it is.
CREATE OR REPLACE FUNCTION public.guard_guest_is_not_a_member()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users u
              WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Compass:AlreadyAMember — % is a member of this organization, not a guest of it', NEW.user_id
      USING HINT = 'Primary membership is public.users.organization_id.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_guest_is_not_a_member
  BEFORE INSERT OR UPDATE ON public.organization_guests
  FOR EACH ROW EXECUTE FUNCTION public.guard_guest_is_not_a_member();

ALTER TABLE public.organization_guests ENABLE ROW LEVEL SECURITY;

-- You can see your own guest grants, and an admin can see the ones into their
-- own organization. Deliberately not "any organization you guest in can see all
-- its guests" — that is the same unanswered question as the user list.
CREATE POLICY "see my own guest grants" ON public.organization_guests
  FOR SELECT USING (user_id = auth.uid()
                    OR (public.auth_role() = ANY (ARRAY['owner','admin'])
                        AND organization_id = public.auth_org_id()));

CREATE POLICY "admins grant guests into their own organization" ON public.organization_guests
  FOR ALL
  USING (public.auth_role() = ANY (ARRAY['owner','admin'])
         AND organization_id = public.auth_org_id())
  WITH CHECK (public.auth_role() = ANY (ARRAY['owner','admin'])
              AND organization_id = public.auth_org_id());

GRANT SELECT, INSERT, DELETE ON public.organization_guests TO authenticated;

-- ── the set, and the predicate that reads it ───────────────────────────────
-- From the token, not from a query: a claim is what a policy can trust, and
-- reading `organization_guests` inside a policy that guards a table joined to it
-- is how two infinite recursions once sat in production.
CREATE OR REPLACE FUNCTION public.auth_org_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_remove(
    array_agg(DISTINCT o) FILTER (WHERE o IS NOT NULL), NULL)
    FROM (
      SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid AS o
      UNION
      SELECT (jsonb_array_elements_text(
                coalesce(auth.jwt() -> 'app_metadata' -> 'guest_org_ids', '[]'::jsonb)))::uuid
    ) x
$$;

COMMENT ON FUNCTION public.auth_org_ids() IS
  'Every organization this session can meet an access requirement with: the one primary membership plus any guest memberships. Read from the token — the access token hook derives both from the database at issue.';

REVOKE ALL ON FUNCTION public.auth_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_org_ids() TO authenticated;

-- One predicate, composed by every policy. Restating it fourteen times is how
-- thirteen of them stay right and one drifts.
CREATE OR REPLACE FUNCTION public.auth_in_org(p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_org IS NOT NULL AND p_org = ANY (coalesce(public.auth_org_ids(), ARRAY[]::uuid[]))
$$;

COMMENT ON FUNCTION public.auth_in_org(uuid) IS
  '"users must be a member or guest member of at least one organization applied to a Project" — this is that sentence. Note it is false for a NULL organization, where the old IS NOT DISTINCT FROM comparison was true for a session that had none.';

REVOKE ALL ON FUNCTION public.auth_in_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_in_org(uuid) TO authenticated;

-- ── the hook emits the set ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  u      record;
  guests jsonb;
BEGIN
  claims := coalesce(event->'claims', '{}'::jsonb);
  IF jsonb_typeof(claims->'app_metadata') IS DISTINCT FROM 'object' THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb, true);
  END IF;

  SELECT organization_id, role INTO u
    FROM public.users WHERE id = (event->>'user_id')::uuid;

  IF NOT FOUND THEN
    RETURN event;
  END IF;

  IF u.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, org_id}', to_jsonb(u.organization_id::text), true);
  END IF;
  claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(u.role), true);

  SELECT coalesce(jsonb_agg(g.organization_id::text), '[]'::jsonb) INTO guests
    FROM public.organization_guests g WHERE g.user_id = (event->>'user_id')::uuid;
  claims := jsonb_set(claims, '{app_metadata, guest_org_ids}', guests, true);

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  RETURN event;
END $$;

-- ── the fourteen ontology reads, composed against the set ──────────────────
DROP POLICY "read ontologies in scope" ON public.ontologies;
CREATE POLICY "read ontologies in scope" ON public.ontologies
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "read object types in scope" ON public.object_types;
CREATE POLICY "read object types in scope" ON public.object_types
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "read link types in scope" ON public.link_types;
CREATE POLICY "read link types in scope" ON public.link_types
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "members read shared properties" ON public.shared_properties;
CREATE POLICY "members read shared properties" ON public.shared_properties
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "members read interfaces in scope" ON public.ontology_interfaces;
CREATE POLICY "members read interfaces in scope" ON public.ontology_interfaces
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "members read implementations in scope" ON public.object_type_interfaces;
CREATE POLICY "members read implementations in scope" ON public.object_type_interfaces
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "members read object sets in scope" ON public.object_sets;
CREATE POLICY "members read object sets in scope" ON public.object_sets
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "read branches in scope" ON public.ontology_branches;
CREATE POLICY "read branches in scope" ON public.ontology_branches
  FOR SELECT USING (public.auth_in_org(organization_id));

DROP POLICY "read groups in visible projects" ON public.type_groups;
CREATE POLICY "read groups in visible projects" ON public.type_groups
  FOR SELECT USING (public.auth_in_org(organization_id)
                    AND public.project_role(project_id) IS NOT NULL);

-- The five that reach their organization through the object type they hang off.
DROP POLICY "read properties of visible object types" ON public.object_type_properties;
CREATE POLICY "read properties of visible object types" ON public.object_type_properties
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_properties.object_type_id
       AND public.auth_in_org(t.organization_id)));

DROP POLICY "read datasources of visible object types" ON public.object_type_datasources;
CREATE POLICY "read datasources of visible object types" ON public.object_type_datasources
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_datasources.object_type_id
       AND public.auth_in_org(t.organization_id)));

DROP POLICY "read capabilities of visible object types" ON public.object_type_capabilities;
CREATE POLICY "read capabilities of visible object types" ON public.object_type_capabilities
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_type_capabilities.object_type_id
       AND public.auth_in_org(t.organization_id)));

DROP POLICY "members read time series props" ON public.time_series_properties;
CREATE POLICY "members read time series props" ON public.time_series_properties
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = time_series_properties.object_type_id
       AND public.auth_in_org(t.organization_id)));

DROP POLICY "read edits of visible object types" ON public.object_edits;
CREATE POLICY "read edits of visible object types" ON public.object_edits
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t
     WHERE t.id = object_edits.object_type_id
       AND public.auth_in_org(t.organization_id)));

-- ── assertions, as the role the surface connects as ────────────────────────
DO $$
DECLARE
  host uuid; other uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; t uuid;
  hostu uuid := gen_random_uuid(); guest uuid := gen_random_uuid();
  before text; n int; claims jsonb;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('host-435')  RETURNING id INTO host;
  INSERT INTO public.organizations (name) VALUES ('other-435') RETURNING id INTO other;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (hostu, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','host435@beacon.test'),
    (guest, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','guest435@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (hostu, 'host435@beacon.test', 'admin', host),
    (guest, 'guest435@beacon.test', 'admin', other);

  -- The host builds an ontology with one object type.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', hostu::text,
      'app_metadata', json_build_object('role','admin','org_id',host))::text, true);
  SET LOCAL ROLE authenticated;

  sp := public.create_space('Host435');
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'host435', 'Host 435') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (host, sp, 'h435', 'H435') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (host, proj, 'flights', 'flights') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds,'master') RETURNING id INTO br;
  t := public.save_object_type(
    jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds::text,'branch_id', br::text))),
    jsonb_build_array(jsonb_build_object('property_id','k','display_name','K','api_name','k',
      'base_type','string','source','column','backing_column','k',
      'is_primary_key',true,'is_title_key',true,'required',true)));
  PERFORM public.save_working_state();

  -- 1. A member of another organization sees nothing. Unchanged behaviour.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', guest::text,
      'app_metadata', json_build_object('role','admin','org_id',other))::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.object_types WHERE id = t;
  IF n <> 0 THEN RAISE EXCEPTION 'another organization could already see the ontology'; END IF;

  -- 2. Grant guest membership, as the host admin.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', hostu::text,
      'app_metadata', json_build_object('role','admin','org_id',host))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.organization_guests (organization_id, user_id) VALUES (host, guest);

  -- 3. The hook now emits it, which is how the claim reaches a policy at all.
  RESET ROLE;
  claims := public.custom_access_token_hook(jsonb_build_object(
    'user_id', guest::text, 'claims', '{}'::jsonb)) -> 'claims';
  IF NOT (claims->'app_metadata'->'guest_org_ids' @> to_jsonb(ARRAY[host::text])) THEN
    RAISE EXCEPTION 'the token does not carry the guest organization: %', claims->'app_metadata';
  END IF;

  -- 4. And with that token the guest can read the host's ontology.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', guest::text, 'app_metadata',
      jsonb_build_object('role','admin','org_id',other,
                         'guest_org_ids', jsonb_build_array(host::text)))::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.object_types WHERE id = t) <> 1 THEN
    RAISE EXCEPTION 'a guest member still cannot see the ontology';
  END IF;
  IF (SELECT count(*) FROM public.object_type_properties WHERE object_type_id = t) <> 1 THEN
    RAISE EXCEPTION 'a guest sees the type but not the properties that reach through it';
  END IF;
  IF (SELECT count(*) FROM public.ontologies WHERE id = ont) <> 1 THEN
    RAISE EXCEPTION 'a guest cannot see the ontology itself';
  END IF;

  -- 5. Reading is not writing. A guest is not an author.
  BEGIN
    UPDATE public.object_types SET label = 'Guest wrote this' WHERE id = t;
    IF FOUND THEN RAISE EXCEPTION 'a guest wrote to the host organization'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT label FROM public.object_types WHERE id = t) <> 'Flight' THEN
    RAISE EXCEPTION 'a guest changed a host resource';
  END IF;

  -- 6. A session with no organization matches nothing, where the old
  --    IS NOT DISTINCT FROM comparison matched a NULL organization_id.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', guest::text, 'app_metadata', json_build_object('role','admin'))::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.object_types) <> 0 THEN
    RAISE EXCEPTION 'a session with no organization saw object types';
  END IF;

  -- 7. Guest of your own organization is membership, not guesthood.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', hostu::text,
      'app_metadata', json_build_object('role','admin','org_id',host))::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.organization_guests (organization_id, user_id) VALUES (host, hostu);
    RAISE EXCEPTION 'a member was recorded as a guest of their own organization';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%AlreadyAMember%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '435: a guest member reads the host ontology and cannot write to it';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
