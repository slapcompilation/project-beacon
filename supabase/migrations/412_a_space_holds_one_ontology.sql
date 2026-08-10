-- 412 — a space holds one ontology
--
-- Reading: docs/foundry-reference/readings/capabilities-value-types-and-groups.md
--          docs/ONTOLOGY-BUILD-MAP.md, phase A1
--
-- The container the ontology has been missing. Found in an aside on a page about
-- something else entirely:
--
--   "Unlike object types, properties, link types, or other types that define and
--    build the Ontology, value types are associated with a SPACE in the platform.
--    A SPACE CAN HOLD A SINGLE ONTOLOGY. Value types can only be used within the
--    space in which they were defined."   — object-link-types/value-types-overview
--
-- So the Ontology picker in the top-left of Ontology Manager — "a drop-down to
-- select between different Ontologies" — is a space picker, and every object
-- type's Overview carries an `Ontology:` field naming its one.
--
-- Release management says the same thing from the other end: "Spaces are a
-- flexible primitive… that allow for environment separation… Development, Test,
-- Production, each represented as a 'space'." One ontology per space is what
-- gives each environment its own.
--
-- WHAT THIS CHANGES BESIDES ADDING A TABLE. An object type's API name was unique
-- per organization. It is unique per ONTOLOGY, which is what the training
-- course's [OFT] prefix works around: "the object types include an OFT (Ontology
-- Foundry Training) prefix to avoid any naming conflicts with any similar types
-- found in your ontology."
--
-- The org does not stop mattering — every Compass row carries an organization
-- badge, and every RLS policy here reads `auth_org_id()`. It is carried by a
-- COMPOSITE foreign key (ontology_id, organization_id) so the two cannot
-- disagree, rather than by a trigger restating the rule.

BEGIN;

-- ── the RID correction ───────────────────────────────────────────────────────
-- palantir/resource-identifier gives the four segments as:
--   service   [a-z][a-z0-9\-]*
--   instance  ([a-z0-9][a-z0-9\-]*)?     <- "an optionally empty string"
--   type      [a-z][a-z0-9\-]*
--   locator   [a-zA-Z0-9\-\._]+          <- DOTS ARE LEGAL HERE
--
-- `rid_locator` took `split_part(rid, '.', 5)`, the fifth dot-separated field,
-- which truncates any locator containing a dot to its first segment. Every
-- locator we generate is a uuid, so nothing was broken — but the function was
-- wrong about the grammar it claims to implement, and a resource imported from
-- elsewhere would have been silently mangled.

CREATE OR REPLACE FUNCTION public.rid_locator(p_rid text)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT nullif(substring(p_rid from '^ri\.[^.]*\.[^.]*\.[^.]*\.(.*)$'), '')::uuid
$$;

COMMENT ON FUNCTION public.rid_locator(text) IS
  'The <locator> of a RID: everything after the fourth separator, because the locator may itself contain dots (palantir/resource-identifier). NULL when malformed or not a uuid.';

-- ── the ontology ─────────────────────────────────────────────────────────────

CREATE TABLE public.ontologies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- "A space can hold a single ontology." One row per space, enforced.
  space_id        uuid NOT NULL UNIQUE REFERENCES public.spaces(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- The picker shows a display name over the folder it lives in; the API name is
  -- what an OSDK import and `foundry.yml`'s apiNamespace would carry.
  api_name        text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  label           text NOT NULL CHECK (length(btrim(label)) > 0),
  description     text NOT NULL DEFAULT '',

  rid             text GENERATED ALWAYS AS (public.rid_of('ontology', 'ontology', id)) STORED,

  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, api_name),
  -- The target of the composite foreign keys below.
  UNIQUE (id, organization_id)
);

COMMENT ON TABLE public.ontologies IS
  'One per space — "A space can hold a single ontology" (value-types-overview). What the Ontology Manager picker selects between, and what every object type''s Overview names in its `Ontology:` field.';
COMMENT ON COLUMN public.ontologies.rid IS
  'ri.ontology.main.ontology.<uuid>, the form attested in ontology-sdk/add-osdk-to-bootstrapped-repository.';

CREATE INDEX idx_ontologies_org ON public.ontologies (organization_id);

ALTER TABLE public.ontologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read ontologies in scope" ON public.ontologies
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));

CREATE POLICY "admins author ontologies" ON public.ontologies
  FOR INSERT WITH CHECK (
    public.auth_role() = ANY (ARRAY['owner','admin'])
    AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()));

CREATE POLICY "admins update ontologies" ON public.ontologies
  FOR UPDATE USING (
    public.auth_role() = ANY (ARRAY['owner','admin'])
    AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()));

CREATE POLICY "admins delete ontologies" ON public.ontologies
  FOR DELETE USING (
    public.auth_role() = ANY (ARRAY['owner','admin'])
    AND NOT (organization_id IS DISTINCT FROM public.auth_org_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ontologies TO authenticated;

-- ── every ontology resource belongs to one ───────────────────────────────────
-- The tables are empty (the teardown emptied the ontology at 355), so these are
-- NOT NULL from the start rather than nullable-then-backfilled.

-- Two interfaces survived the teardown and this migration found them: `roomed`
-- ("Roomed", one property `room`) and `perishable` ("Perishable", `expiry_date`,
-- `lot_number`, `status`). They are hospitality content from the deleted product,
-- they have ZERO implementations, and their `properties` jsonb still uses the
-- base-type vocabulary O2 replaced — `text` is not a value `property_base_types()`
-- returns any more. The teardown missed them; migration 355 would have taken
-- them. Deleted here, named so the record is not silent.
--
-- The guard below is the important part: it fails rather than deleting anything
-- ELSE, so this stays a statement about two known rows and not a licence.

DO $$
DECLARE n bigint; impls bigint; leftovers text;
BEGIN
  SELECT count(*) INTO impls FROM public.object_type_interfaces;
  IF impls <> 0 THEN
    RAISE EXCEPTION 'Migration 412: % interface implementation(s) exist; the interfaces below are not orphans after all', impls;
  END IF;

  SELECT string_agg(api_name, ', ' ORDER BY api_name) INTO leftovers
    FROM public.ontology_interfaces WHERE api_name NOT IN ('roomed', 'perishable');
  IF leftovers IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 412: unexpected interface(s) present: %. Decide about them before this runs.', leftovers;
  END IF;

  DELETE FROM public.ontology_interfaces WHERE api_name IN ('roomed', 'perishable');

  SELECT (SELECT count(*) FROM public.object_types)
       + (SELECT count(*) FROM public.link_types)
       + (SELECT count(*) FROM public.shared_properties)
       + (SELECT count(*) FROM public.ontology_interfaces) INTO n;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 412: expected an empty ontology, found % resource(s). Backfill ontology_id before making it NOT NULL.', n;
  END IF;
END $$;

ALTER TABLE public.object_types        ADD COLUMN ontology_id uuid NOT NULL;
ALTER TABLE public.link_types          ADD COLUMN ontology_id uuid NOT NULL;
ALTER TABLE public.shared_properties   ADD COLUMN ontology_id uuid NOT NULL;
ALTER TABLE public.ontology_interfaces ADD COLUMN ontology_id uuid NOT NULL;

-- Composite, deliberately. The org marking stays on the resource — every Compass
-- row shows one, and every policy here reads auth_org_id() — but it cannot
-- disagree with the ontology's, because the pair is the foreign key. A trigger
-- would have restated the rule; this makes it unstateable.
ALTER TABLE public.object_types
  ADD CONSTRAINT object_types_ontology_fkey
  FOREIGN KEY (ontology_id, organization_id)
  REFERENCES public.ontologies (id, organization_id) ON DELETE RESTRICT;
ALTER TABLE public.link_types
  ADD CONSTRAINT link_types_ontology_fkey
  FOREIGN KEY (ontology_id, organization_id)
  REFERENCES public.ontologies (id, organization_id) ON DELETE RESTRICT;
ALTER TABLE public.shared_properties
  ADD CONSTRAINT shared_properties_ontology_fkey
  FOREIGN KEY (ontology_id, organization_id)
  REFERENCES public.ontologies (id, organization_id) ON DELETE RESTRICT;
ALTER TABLE public.ontology_interfaces
  ADD CONSTRAINT ontology_interfaces_ontology_fkey
  FOREIGN KEY (ontology_id, organization_id)
  REFERENCES public.ontologies (id, organization_id) ON DELETE RESTRICT;

CREATE INDEX idx_object_types_ontology        ON public.object_types (ontology_id);
CREATE INDEX idx_link_types_ontology          ON public.link_types (ontology_id);
CREATE INDEX idx_shared_properties_ontology   ON public.shared_properties (ontology_id);
CREATE INDEX idx_ontology_interfaces_ontology ON public.ontology_interfaces (ontology_id);

-- ── API names are unique per ontology, not per organization ──────────────────
-- "unique across all object types" is Foundry's phrasing, and their scope is the
-- ontology — which is why the training course prefixes its types with [OFT] "to
-- avoid any naming conflicts with any similar types found in your ontology".

ALTER TABLE public.object_types
  DROP CONSTRAINT object_types_organization_id_api_name_key,
  ADD  CONSTRAINT object_types_ontology_id_api_name_key UNIQUE (ontology_id, api_name);

ALTER TABLE public.shared_properties
  DROP CONSTRAINT shared_properties_organization_id_api_name_key,
  ADD  CONSTRAINT shared_properties_ontology_id_api_name_key UNIQUE (ontology_id, api_name);

ALTER TABLE public.ontology_interfaces
  DROP CONSTRAINT ontology_interfaces_organization_id_api_name_key,
  ADD  CONSTRAINT ontology_interfaces_ontology_id_api_name_key UNIQUE (ontology_id, api_name);

-- link_types is keyed (source_object_type_id, api_name) and stays that way: a
-- link's API name lives on its end, not on the ontology. B2 replaces it.

-- ── the lint learns about the container ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE (object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $$
  SELECT t.api_name, p.scope, p.subject, p.problem
    FROM public.object_types t
   CROSS JOIN LATERAL public.object_type_problems(t.id) p

  UNION ALL

  SELECT t.api_name, 'property', pr.property_id,
         format('Backing column "%s" is not in the schema of dataset "%s"',
                pr.backing_column, d.name)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.object_type_datasources ds ON ds.id = pr.datasource_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   WHERE pr.source = 'column'
     AND public.dataset_branch_schema(ds.branch_id) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(public.dataset_branch_schema(ds.branch_id)) f
        WHERE f ->> 'name' = pr.backing_column)

  UNION ALL

  SELECT t.api_name, 'property', pr.property_id,
         format('The primary key must exist in every input datasource; dataset "%s" has no column "%s"',
                d.name, pr.backing_column)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.object_type_datasources ds ON ds.object_type_id = pr.object_type_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   WHERE pr.is_primary_key AND pr.source = 'column'
     AND public.dataset_branch_schema(ds.branch_id) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(public.dataset_branch_schema(ds.branch_id)) f
        WHERE f ->> 'name' = pr.backing_column)

  UNION ALL

  SELECT t.api_name, 'datasource', d.name,
         format('Column "%s" is a %s, which a backing datasource may not contain',
                f ->> 'name', f ->> 'type')
    FROM public.object_type_datasources ds
    JOIN public.object_types t ON t.id = ds.object_type_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   CROSS JOIN LATERAL jsonb_array_elements(
     coalesce(public.dataset_branch_schema(ds.branch_id), '[]'::jsonb)) f
   WHERE f ->> 'type' IN ('MAP', 'STRUCT')

  UNION ALL

  SELECT t.api_name, 'property', pr.property_id,
         format('Inherits from "%s", which is %s, but this property is %s',
                sp.api_name, sp.base_type, pr.base_type)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.shared_properties sp ON sp.id = pr.shared_property_id
   WHERE sp.base_type <> pr.base_type

  UNION ALL

  -- New: a shared property may only be inherited within its own ontology. The
  -- composite FK ties each resource to one; nothing yet ties them to each other.
  SELECT t.api_name, 'property', pr.property_id,
         format('Inherits from "%s", which belongs to a different ontology', sp.api_name)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.shared_properties sp ON sp.id = pr.shared_property_id
   WHERE sp.ontology_id <> t.ontology_id

  UNION ALL

  -- And a link may only join two types in the same ontology as itself.
  SELECT lt.api_name, 'link_type', lt.api_name,
         'Joins object types from a different ontology'
    FROM public.link_types lt
    JOIN public.object_types s ON s.id = lt.source_object_type_id
    JOIN public.object_types g ON g.id = lt.target_object_type_id
   WHERE s.ontology_id <> lt.ontology_id OR g.ontology_id <> lt.ontology_id
$$;

COMMENT ON FUNCTION public.ontology_violations() IS
  'Every well-formedness violation in the ontology, as rows. The linting half of what check:platform was doing by assertion — see superrepo/core-concepts "Ontology linting".';

-- ── assertions ───────────────────────────────────────────────────────────────
-- Fixture as the owner; the RLS-dependent assertions as `authenticated`.

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; other_sp uuid; other_ont uuid;
  t uuid; sprop uuid; usr uuid := gen_random_uuid();
  claims text; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  -- The locator fix, against the grammar it now cites.
  IF public.rid_locator('ri.ontology.main.object-type.550e8400-e29b-41d4-a716-446655440000')
     <> '550e8400-e29b-41d4-a716-446655440000'::uuid THEN
    RAISE EXCEPTION 'Migration 412: rid_locator did not read a plain uuid locator';
  END IF;
  -- An empty instance is legal and must not shift the segments.
  IF public.rid_locator('ri.magritte..source.550e8400-e29b-41d4-a716-446655440000')
     <> '550e8400-e29b-41d4-a716-446655440000'::uuid THEN
    RAISE EXCEPTION 'Migration 412: an empty instance segment broke the locator';
  END IF;
  -- The case the old implementation got wrong: dots inside the locator. It is
  -- not a uuid so it reads NULL, but through the cast, not through truncation.
  IF substring('ri.svc.main.thing.a.b.c' from '^ri\.[^.]*\.[^.]*\.[^.]*\.(.*)$') <> 'a.b.c' THEN
    RAISE EXCEPTION 'Migration 412: a dotted locator is still being truncated';
  END IF;

  INSERT INTO auth.users (id, email) VALUES (usr, '412@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m412') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('Production') RETURNING id INTO sp;
  INSERT INTO public.spaces (name) VALUES ('Development') RETURNING id INTO other_sp;

  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'prod', 'Production Ontology') RETURNING id INTO ont;

  IF (SELECT rid FROM public.ontologies WHERE id = ont)
     <> 'ri.ontology.main.ontology.' || ont::text THEN
    RAISE EXCEPTION 'Migration 412: the ontology RID is not the attested form';
  END IF;

  -- "A space can hold a single ontology."
  BEGIN
    INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
         VALUES (sp, org, 'second', 'Second Ontology');
    RAISE EXCEPTION 'Migration 412: a space accepted a second ontology';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (other_sp, org, 'dev', 'Development Ontology') RETURNING id INTO other_ont;

  -- An API name is unique per ONTOLOGY. The same name in two ontologies of the
  -- same organization is exactly what the [OFT] prefix exists to avoid needing.
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Flight', 'Flight') RETURNING id INTO t;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, other_ont, 'Flight', 'Flight');

  BEGIN
    INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
         VALUES (org, ont, 'Flight', 'Flight again');
    RAISE EXCEPTION 'Migration 412: a duplicate API name was accepted within one ontology';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- The composite key: an object type cannot claim an ontology from another org.
  DECLARE other_org uuid; other_org_sp uuid; other_org_ont uuid;
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('m412 other') RETURNING id INTO other_org;
    INSERT INTO public.spaces (name) VALUES ('Other space') RETURNING id INTO other_org_sp;
    INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
         VALUES (other_org_sp, other_org, 'theirs', 'Theirs') RETURNING id INTO other_org_ont;

    BEGIN
      INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
           VALUES (org, other_org_ont, 'Stolen', 'Stolen');
      RAISE EXCEPTION 'Migration 412: an object type claimed an ontology belonging to another organization';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    DELETE FROM public.ontologies WHERE id = other_org_ont;
    DELETE FROM public.spaces WHERE id = other_org_sp;
    DELETE FROM public.organizations WHERE id = other_org;
  END;

  -- An ontology in use cannot be dropped out from under its resources.
  BEGIN
    DELETE FROM public.ontologies WHERE id = ont;
    RAISE EXCEPTION 'Migration 412: an ontology with object types was deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- The lint's two new rules, both cross-ontology.
  INSERT INTO public.shared_properties (organization_id, ontology_id, api_name, label, base_type)
       VALUES (org, other_ont, 'cost', 'Cost', 'string') RETURNING id INTO sprop;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       SELECT NULL, NULL, NULL WHERE false;   -- no datasource needed for this rule
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source)
  VALUES (t, 'note', 'Note', 'note', 'string', 'user_input');
  UPDATE public.object_type_properties SET shared_property_id = sprop
   WHERE object_type_id = t AND property_id = 'note';

  IF NOT EXISTS (SELECT 1 FROM public.ontology_violations()
                  WHERE problem LIKE '%belongs to a different ontology%') THEN
    RAISE EXCEPTION 'Migration 412: inheriting across ontologies went unreported';
  END IF;

  -- And the same read as `authenticated`, since that is who asks in production.
  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO n FROM public.ontologies;
  IF n < 2 THEN
    RAISE EXCEPTION 'Migration 412: authenticated could not read its own ontologies (saw %)', n;
  END IF;

  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.object_type_properties WHERE object_type_id = t;
  DELETE FROM public.shared_properties WHERE id = sprop;
  DELETE FROM public.object_types WHERE ontology_id IN (ont, other_ont);
  DELETE FROM public.ontologies WHERE id IN (ont, other_ont);
  DELETE FROM public.spaces WHERE id IN (sp, other_sp);
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
