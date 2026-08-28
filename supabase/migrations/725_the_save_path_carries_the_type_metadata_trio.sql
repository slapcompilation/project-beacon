-- 725 — the save path carries aliases, point of contact and contributors
-- (creation review, F6.7).
--
-- 415 added the three columns; MetadataCard has displayed them since — and
-- no save could write them: apply_object_type's type upsert named neither,
-- so they were writable nowhere. The absent-means-unchanged convention the
-- UPDATE arm already uses holds for all three: a payload that does not
-- speak leaves the stored values alone.
--
--   "Alternative names (synonyms) for the object type, usable as search terms. This field is only populated on the get-by-RID read paths (e.g. `getObjectTypeV2`); it is always empty on the `listObjectTypesV2` endpoint."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md

DO $patch$
DECLARE
  src text;
  n int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_object_type';

  -- The INSERT arm: three more columns, from the payload or their defaults.
  n := (length(src) - length(replace(src, 'api_name, label, plural_label, icon, description)', ''))) /
       length('api_name, label, plural_label, icon, description)');
  IF n <> 1 THEN RAISE EXCEPTION 'insert-columns anchor found % times', n; END IF;
  src := replace(src,
    'api_name, label, plural_label, icon, description)',
    'api_name, label, plural_label, icon, description, aliases, point_of_contact, contributors)');

  n := (length(src) - length(replace(src, 'coalesce(p_object_type->>''description'', ''''))', ''))) /
       length('coalesce(p_object_type->>''description'', ''''))');
  IF n <> 1 THEN RAISE EXCEPTION 'insert-values anchor found % times', n; END IF;
  src := replace(src,
    'coalesce(p_object_type->>''description'', ''''))',
    'coalesce(p_object_type->>''description'', ''''),
            coalesce(ARRAY(SELECT jsonb_array_elements_text(p_object_type->''aliases'')), ''{}''::text[]),
            nullif(p_object_type->>''point_of_contact'', '''')::uuid,
            coalesce(ARRAY(SELECT jsonb_array_elements_text(p_object_type->''contributors'')::uuid), ''{}''::uuid[]))');

  -- The UPDATE arm: absent means unchanged, like every field beside it.
  n := (length(src) - length(replace(src, 'description = coalesce(p_object_type->>''description'', description),', ''))) /
       length('description = coalesce(p_object_type->>''description'', description),');
  IF n <> 1 THEN RAISE EXCEPTION 'update-arm anchor found % times', n; END IF;
  src := replace(src,
    'description = coalesce(p_object_type->>''description'', description),',
    'description = coalesce(p_object_type->>''description'', description),
           aliases = CASE WHEN p_object_type ? ''aliases''
             THEN coalesce(ARRAY(SELECT jsonb_array_elements_text(p_object_type->''aliases'')), ''{}''::text[])
             ELSE aliases END,
           point_of_contact = CASE WHEN p_object_type ? ''point_of_contact''
             THEN nullif(p_object_type->>''point_of_contact'', '''')::uuid
             ELSE point_of_contact END,
           contributors = CASE WHEN p_object_type ? ''contributors''
             THEN coalesce(ARRAY(SELECT jsonb_array_elements_text(p_object_type->''contributors'')::uuid), ''{}''::uuid[])
             ELSE contributors END,');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the trio rides the save both ways, self-cleaning ──────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; other uuid; ot uuid; r record;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m725 probe') RETURNING id INTO org;
  usr := gen_random_uuid(); other := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  SELECT u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'm725-' || u || '@beacon.test' FROM unnest(ARRAY[usr, other]) AS u;
  INSERT INTO public.users (id, email, role, organization_id)
  SELECT u, 'm725-' || u || '@beacon.test', 'admin', org FROM unnest(ARRAY[usr, other]) AS u;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M725 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;

  -- Staged with the trio; the linter will refuse the datasource-less save,
  -- so the landing is probed at the apply the save runs.
  PERFORM public.apply_object_type(
    jsonb_build_object('api_name', 'M725Thing', 'label', 'M725 thing', 'ontology_id', ont,
      'aliases', jsonb_build_array('plane', 'bird'),
      'point_of_contact', usr,
      'contributors', jsonb_build_array(other)),
    '[]'::jsonb, NULL);
  SELECT id, aliases, point_of_contact, contributors INTO r
    FROM public.object_types WHERE api_name = 'M725Thing' AND ontology_id = ont;
  ot := r.id;
  IF r.aliases IS DISTINCT FROM ARRAY['plane','bird']::text[]
     OR r.point_of_contact IS DISTINCT FROM usr
     OR r.contributors IS DISTINCT FROM ARRAY[other]::uuid[] THEN
    RAISE EXCEPTION 'the trio did not land on create: % % %', r.aliases, r.point_of_contact, r.contributors;
  END IF;

  -- Absent means unchanged; spoken means replaced.
  PERFORM public.apply_object_type(
    jsonb_build_object('id', ot, 'label', 'M725 thing renamed'), '[]'::jsonb, NULL);
  SELECT aliases, point_of_contact INTO r FROM public.object_types WHERE id = ot;
  IF r.aliases IS DISTINCT FROM ARRAY['plane','bird']::text[] OR r.point_of_contact IS DISTINCT FROM usr THEN
    RAISE EXCEPTION 'an unspoken payload moved the trio';
  END IF;
  PERFORM public.apply_object_type(
    jsonb_build_object('id', ot, 'aliases', jsonb_build_array('kite')), '[]'::jsonb, NULL);
  SELECT aliases INTO r FROM public.object_types WHERE id = ot;
  IF r.aliases IS DISTINCT FROM ARRAY['kite']::text[] THEN
    RAISE EXCEPTION 'a spoken alias list did not replace';
  END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.object_types WHERE id = ot;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id IN (usr, other);
  DELETE FROM auth.users WHERE id IN (usr, other);
  DELETE FROM public.organizations WHERE id = org;
END $$;
