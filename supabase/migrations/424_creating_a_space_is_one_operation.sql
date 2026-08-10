-- Creating a space is one operation, because a space with no organization is
-- invisible to the person who just made it.
--
-- 397 gave `spaces` this SELECT policy:
--
--   CREATE POLICY "members read their spaces" ON public.spaces
--     FOR SELECT USING (EXISTS (
--       SELECT 1 FROM public.space_organizations so
--        WHERE so.space_id = spaces.id
--          AND so.organization_id IS NOT DISTINCT FROM public.auth_org_id()));
--
-- and 414 already established the consequence for the ontology inside it: "An
-- ontology's organization must be one the space actually serves. Without this an
-- ontology can be created in a space no one in that organization can see."
--
-- The surface hit it one level up. `insert into spaces … returning id` is two
-- statements to PostgREST — an INSERT, then a SELECT of what came back — and
-- Postgres applies the SELECT policy to a RETURNING clause. At that instant the
-- `space_organizations` row does not exist, so the policy matches nothing and
-- the caller gets its space back as zero rows. Then the follow-up insert into
-- `space_organizations` had no organization to name: the column is NOT NULL with
-- no default, unlike every other table's `auth_org_id()`.
--
-- Both disappear if the two writes are one call. This is the same answer 409
-- gave for an object type and its properties, for the same reason: a half-made
-- resource is not a state the surface should be able to observe.
--
-- No RETURNING anywhere: the id is generated first, so nothing is read back
-- through a policy that cannot yet be true.
--
-- SECURITY INVOKER — the caller's own policies decide. An admin may create a
-- space for their organization and nobody else's, which is what 397's
-- `admins write space organizations` WITH CHECK already says.

CREATE OR REPLACE FUNCTION public.create_space(
  p_name        text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_space uuid := gen_random_uuid();
  v_org   uuid := public.auth_org_id();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Compass:NoOrganization — a space is created for an organization and this session has none'
      USING HINT = 'The organizations a space serves are chosen when it is created; there is nothing to choose from without a session organization.';
  END IF;

  INSERT INTO public.spaces (id, name, description)
  VALUES (v_space, p_name, coalesce(p_description, ''));

  -- The access requirement, in the same statement's transaction. Membership of
  -- at least one organization is what grants access to the space at all.
  INSERT INTO public.space_organizations (space_id, organization_id)
  VALUES (v_space, v_org);

  RETURN v_space;
END $$;

COMMENT ON FUNCTION public.create_space(text, text) IS
  'Create a space and attach the caller''s organization to it, in one call. Separate writes leave a space no policy can see, because the spaces SELECT policy reads through space_organizations.';

REVOKE ALL ON FUNCTION public.create_space(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_space(text, text) TO authenticated;

-- ── the surface's own sequence, as the role the surface connects as ──────────
-- Run as `authenticated`, not as the owner. Connecting as the owner bypasses RLS
-- and this whole migration exists because that is where the bug hid.
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; before text; seen int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('space-424') RETURNING id INTO org;
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  -- 1. Create the space. The id must come back, and the space must be readable.
  sp := public.create_space('Production', 'The production space');
  IF sp IS NULL THEN
    RAISE EXCEPTION 'create_space returned nothing';
  END IF;

  SELECT count(*) INTO seen FROM public.spaces WHERE id = sp;
  IF seen <> 1 THEN
    RAISE EXCEPTION 'a freshly created space is not readable by its creator — the org attachment did not land';
  END IF;

  -- 2. The picker lists spaces that hold no ontology, and this one qualifies.
  SELECT count(*) INTO seen
    FROM public.spaces s
   WHERE s.id = sp AND NOT EXISTS (SELECT 1 FROM public.ontologies o WHERE o.space_id = s.id);
  IF seen <> 1 THEN
    RAISE EXCEPTION 'a space with no ontology is not offered as a place to put one';
  END IF;

  -- 3. The ontology goes in it, and reads back with its space.
  INSERT INTO public.ontologies (space_id, api_name, label)
  VALUES (sp, 'production', 'Production Ontology') RETURNING id INTO ont;

  SELECT count(*) INTO seen
    FROM public.ontologies o JOIN public.spaces s ON s.id = o.space_id
   WHERE o.id = ont AND s.path LIKE '/Production-%';
  IF seen <> 1 THEN
    RAISE EXCEPTION 'the ontology does not read back with the space it lives in — the picker would show a blank folder';
  END IF;

  -- 4. Which is now no longer free, because a space holds a single ontology.
  SELECT count(*) INTO seen
    FROM public.spaces s
   WHERE s.id = sp AND NOT EXISTS (SELECT 1 FROM public.ontologies o WHERE o.space_id = s.id);
  IF seen <> 0 THEN
    RAISE EXCEPTION 'a space that already holds an ontology is still being offered for another';
  END IF;

  -- 5. And an object type created in it lands there rather than by guess.
  IF (SELECT ontology_id FROM public.object_types
       WHERE id = public.save_object_type(
         jsonb_build_object('api_name','Flight','label','Flight','ontology_id', ont::text),
         '[]'::jsonb)) <> ont THEN
    RAISE EXCEPTION 'an object type created in a named ontology did not land in it';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '424: space, ontology and object type created end to end as authenticated';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
