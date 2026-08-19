-- 582 modelled the media source as a per-property dataset and branch. The api
-- says it is an object type DATASOURCE of a media set view, bound to a list of
-- properties — the same direction the vector property was wrong in, and for the
-- same reason.
--
-- ── WHAT THE API SAYS ────────────────────────────────────────────────────
-- `api/v2/ontologies-v2-resources/object-types-get-object-type` defines
-- `datasources` as a list whose `definition` is a union of Foundry resource
-- kinds — `timeSeries`, `restrictedView`, `direct`, `unsupported`, and:
--
--   `mediaSetView` · object
--     "An object type datasource backed by a Foundry media set view, providing
--      media for media reference properties."
--     - `mediaSetRid` · string · required
--       "The Resource Identifier (RID) of a Media Set in Foundry."
--     - `mediaSetViewRid` · string · required
--       "The Resource Identifier (RID) of a single View of a Media Set. A Media
--        Set View is an independent collection of Media Items."
--     - `properties` · list
--       "The set of properties that are bound to the media view."
--
-- ── THREE WAYS 582 WAS WRONG ────────────────────────────────────────────
--
-- 1. **A media source is a DATASOURCE, not a per-property row.** Foundry hangs
--    it off the object type and binds a LIST of properties to it, so two media
--    reference properties reading the same media set share one source. 582 gave
--    each property its own row and could not express that.
--
-- 2. **It names a media set AND a view of it, not a dataset and a branch.** I
--    read `media-reference-media-source.png` as "the dataset `images` on branch
--    `master`" because a dataset and a branch is what we already had. The api
--    names the actual resource kinds: a Media Set, and "a single View of a
--    Media Set" which is "an independent collection of Media Items". The value
--    stored in the column carries all three — set, view, item — and 582's own
--    validator already required the view RID, so the schema disagreed with the
--    validator it shipped alongside.
--
-- 3. **The kind belongs in the datasource union.** `one_backing` admitted a
--    dataset+branch or a restricted view. A third arm is the shape the api
--    publishes, and it keeps every backing for an object type in one place
--    rather than in a table only media knows about.
--
-- ── WHAT 582 GOT RIGHT ──────────────────────────────────────────────────
-- That a media reference property needs BOTH: the dataset whose media reference
-- column it reads, and the media source the references point into. The prose
-- says both and the api agrees — they are two datasources on one object type,
-- which is exactly why the media source could never be a column on the
-- property.
--
-- Nothing to migrate: zero media reference properties and zero media sources
-- exist.

BEGIN;

-- ── §1 the third arm of the datasource union ─────────────────────────────
ALTER TABLE public.object_type_datasources
  ADD COLUMN media_set_rid text,
  ADD COLUMN media_set_view_rid text;

ALTER TABLE public.object_type_datasources
  DROP CONSTRAINT object_type_datasources_one_backing,
  ADD CONSTRAINT object_type_datasources_one_backing CHECK (
    (dataset_id IS NOT NULL AND branch_id IS NOT NULL
       AND restricted_view_id IS NULL AND media_set_rid IS NULL)
    OR (restricted_view_id IS NOT NULL AND dataset_id IS NULL
       AND branch_id IS NULL AND media_set_rid IS NULL)
    -- "providing media for media reference properties": a media set and a
    -- single view of it, both required.
    OR (media_set_rid IS NOT NULL AND media_set_view_rid IS NOT NULL
       AND dataset_id IS NULL AND branch_id IS NULL AND restricted_view_id IS NULL));

ALTER TABLE public.object_type_datasources
  ADD CONSTRAINT media_set_rids_are_rids CHECK (
    (media_set_rid IS NULL OR public.rid_valid(media_set_rid))
    AND (media_set_view_rid IS NULL OR public.rid_valid(media_set_view_rid)));

COMMENT ON COLUMN public.object_type_datasources.media_set_rid IS
  'The Media Set this datasource provides media from. Paired with a view RID, because a media reference names a set, a view of it, and an item.';
COMMENT ON COLUMN public.object_type_datasources.media_set_view_rid IS
  'A single View of a Media Set — "an independent collection of Media Items". Required alongside the set: the reference value carries both.';

-- ── §1b the guard predates the third kind ───────────────────────────────
-- `guard_object_type_datasource` derives an organization from the datasource's
-- dataset — directly, or through a restricted view's input — and refuses a
-- datasource whose organization the ontology's space does not serve. A media
-- set view has no local dataset, so `eff_ds` is null, the org lookup finds
-- nothing and every media datasource is refused as foreign.
--
-- The org rule is about a Foundry DATASET being reachable from this space. A
-- media set RID is not one, so the rule does not apply rather than passing
-- vacuously — and the same is true of the schema check below it, which reads a
-- dataset's fields looking for MAP columns.
CREATE OR REPLACE FUNCTION public.guard_object_type_datasource()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  n int; holder uuid; bad text; ds_org uuid; ot_ont uuid; eff_ds uuid; fields jsonb;
BEGIN
  eff_ds := COALESCE(NEW.dataset_id,
    (SELECT v.input_dataset_id FROM public.restricted_views v WHERE v.id = NEW.restricted_view_id));
  SELECT ontology_id INTO ot_ont FROM public.object_types WHERE id = NEW.object_type_id;

  -- A media set view is not a dataset in this space; the organization rule has
  -- nothing to compare and is skipped rather than failed.
  IF NEW.media_set_rid IS NULL THEN
    SELECT organization_id INTO ds_org FROM public.datasets WHERE id = eff_ds;
    IF NOT EXISTS (
      SELECT 1 FROM public.ontologies o
      JOIN public.space_organizations so ON so.space_id = o.space_id
     WHERE o.id = ot_ont AND so.organization_id = ds_org) THEN
      RAISE EXCEPTION 'Ontology:DatasourceInAnotherOrganization — the dataset''s organization is not in this ontology''s space';
    END IF;
  END IF;

  IF NEW.dataset_id IS NOT NULL THEN
    SELECT object_type_id INTO holder FROM public.object_type_datasources
     WHERE dataset_id = NEW.dataset_id AND branch_id = NEW.branch_id
       AND id IS DISTINCT FROM NEW.id;
  ELSIF NEW.restricted_view_id IS NOT NULL THEN
    SELECT object_type_id INTO holder FROM public.object_type_datasources
     WHERE restricted_view_id = NEW.restricted_view_id
       AND id IS DISTINCT FROM NEW.id;
  ELSE
    -- A media set VIEW is "an independent collection of Media Items", so the
    -- pair identifies it and two object types may not both claim one.
    SELECT object_type_id INTO holder FROM public.object_type_datasources
     WHERE media_set_view_rid = NEW.media_set_view_rid
       AND id IS DISTINCT FROM NEW.id;
  END IF;
  IF holder IS NOT NULL THEN
    RAISE EXCEPTION 'Phonograph2:DatasetAndBranchAlreadyRegistered — this datasource is already backing a different object type and cannot be used again'
      USING HINT = 'Pick another dataset, or another branch of this one.';
  END IF;

  SELECT count(*) INTO n FROM public.object_type_datasources
   WHERE object_type_id = NEW.object_type_id AND id IS DISTINCT FROM NEW.id;
  IF n >= 70 THEN
    RAISE EXCEPTION 'Ontology:TooManyDatasources — an object type is limited to 70 datasources, and this one already has %', n;
  END IF;

  -- The MAP-column check reads a dataset's schema. A media set has none.
  IF NEW.media_set_rid IS NULL THEN
    fields := CASE WHEN NEW.dataset_id IS NOT NULL
      THEN public.dataset_branch_schema(NEW.branch_id)
      ELSE public.dataset_current_fields(eff_ds) END;
    SELECT string_agg(f ->> 'name', ', ') INTO bad
      FROM jsonb_array_elements(coalesce(fields, '[]'::jsonb)) f
     WHERE f ->> 'type' = 'MAP';
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'Ontology:UnsupportedColumnType — a backing datasource may not contain MAP columns (%)', bad
        USING HINT = 'Map is not a property base type; there is nothing a MAP column could back.';
    END IF;
  END IF;

  RETURN NEW;
END $fn$;

-- ── §2 the properties bound to it ────────────────────────────────────────
-- 582's table pointed a property at a dataset. This points it at the media
-- datasource, which is the direction "The set of properties that are bound to
-- the media view" describes.
DROP TABLE public.object_type_media_sources;

CREATE TABLE public.object_type_media_sources (
  datasource_id uuid NOT NULL REFERENCES public.object_type_datasources(id) ON DELETE CASCADE,
  property_id   uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  PRIMARY KEY (datasource_id, property_id)
);
CREATE INDEX object_type_media_sources_property ON public.object_type_media_sources (property_id);

COMMENT ON TABLE public.object_type_media_sources IS
  'Which media reference properties a media set view datasource provides media for — the api''s "properties" list on a mediaSetView datasource. One source, many properties: two properties reading the same media set share it.';

CREATE OR REPLACE FUNCTION public.guard_media_source()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE bt text; prop_owner uuid; ds record;
BEGIN
  SELECT base_type, object_type_id INTO bt, prop_owner
    FROM public.object_type_properties WHERE id = NEW.property_id;
  IF bt IS DISTINCT FROM 'media_reference' THEN
    RAISE EXCEPTION 'Ontology:MediaSourceOnNonMediaProperty — a media source provides media for media reference properties, and % is %', NEW.property_id, coalesce(bt, 'missing');
  END IF;

  SELECT * INTO ds FROM public.object_type_datasources WHERE id = NEW.datasource_id;
  IF ds.media_set_rid IS NULL THEN
    RAISE EXCEPTION 'Ontology:NotAMediaDatasource — that datasource is not backed by a media set view';
  END IF;
  -- A property is bound to a datasource of its OWN object type.
  IF ds.object_type_id IS DISTINCT FROM prop_owner THEN
    RAISE EXCEPTION 'Ontology:MediaSourceCrossesObjectTypes — a datasource backs its own object type''s properties';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER media_source_binds_a_media_property
  BEFORE INSERT OR UPDATE ON public.object_type_media_sources
  FOR EACH ROW EXECUTE FUNCTION public.guard_media_source();

ALTER TABLE public.object_type_media_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read media sources in scope" ON public.object_type_media_sources
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = object_type_media_sources.property_id
       AND (select public.auth_in_ontology(t.ontology_id))));
CREATE POLICY "admins author media sources" ON public.object_type_media_sources
  FOR ALL USING ((select public.auth_role()) = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = object_type_media_sources.property_id
       AND (select public.auth_member_of_ontology(t.ontology_id))))
  WITH CHECK ((select public.auth_role()) = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_type_media_sources TO authenticated;

-- The linter's question is unchanged: a media reference property must have a
-- media source. Only the join moved.
CREATE OR REPLACE FUNCTION public.media_property_problems()
RETURNS TABLE (object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT t.api_name, 'property', p.property_id,
         'Media reference property has no media source; it must name the media set view its references point into'
    FROM public.object_type_properties p
    JOIN public.object_types t ON t.id = p.object_type_id
   WHERE p.base_type = 'media_reference'
     AND NOT EXISTS (SELECT 1 FROM public.object_type_media_sources m
                      WHERE m.property_id = p.id)
$fn$;

-- ── assertions ───────────────────────────────────────────────────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ot uuid; other uuid;
  ds uuid; br uuid; ds2 uuid; br2 uuid; media_ds uuid; p1 uuid; p2 uuid; plain uuid; n int; ok boolean;
  SET_RID text := 'ri.mio.main.media-set.00000000-0000-0000-0000-000000000000';
  VIEW_RID text := 'ri.mio.main.view.00000000-0000-0000-0000-000000000000';
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe585') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe585') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe585', 'Probe585') RETURNING id INTO proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe585', 'Probe585', false) RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Photo', 'Photo') RETURNING id INTO ot;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Elsewhere', 'Elsewhere') RETURNING id INTO other;

    -- The dataset half: a media reference property still reads a column.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, proj, 'photos', 'photos') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (ot, ds, br);

    -- The media half: a second datasource, of a media set view.
    INSERT INTO public.object_type_datasources (object_type_id, media_set_rid, media_set_view_rid)
      VALUES (ot, SET_RID, VIEW_RID) RETURNING id INTO media_ds;

    -- Both RIDs are required together.
    ok := false;
    BEGIN
      INSERT INTO public.object_type_datasources (object_type_id, media_set_rid)
        VALUES (ot, SET_RID);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a media set was accepted without a view'; END IF;

    -- Two object types may not claim the same media set view.
    ok := false;
    BEGIN
      INSERT INTO public.object_type_datasources (object_type_id, media_set_rid, media_set_view_rid)
        VALUES (other, SET_RID, VIEW_RID);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%AlreadyRegistered%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'two object types claimed one media set view'; END IF;

    -- And a media datasource may not also be a dataset. A FRESH dataset,
    -- because the BEFORE trigger's already-registered check runs ahead of the
    -- CHECK and would raise first on the one already in use.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, proj, 'spare', 'spare') RETURNING id INTO ds2;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;
    ok := false;
    BEGIN
      INSERT INTO public.object_type_datasources
        (object_type_id, dataset_id, branch_id, media_set_rid, media_set_view_rid)
        VALUES (ot, ds2, br2, SET_RID, VIEW_RID);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'one datasource claimed two backings'; END IF;

    -- ── one source, many properties: the thing 582 could not express ─────
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (ot, 'front', 'front', 'Front', 'media_reference', 'front') RETURNING id INTO p1;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (ot, 'back', 'back', 'Back', 'media_reference', 'back') RETURNING id INTO p2;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (ot, 'caption', 'caption', 'Caption', 'string', 'caption') RETURNING id INTO plain;

    SELECT count(*) INTO n FROM public.media_property_problems() WHERE object_type = 'Photo';
    IF n <> 2 THEN RAISE EXCEPTION 'expected both media properties unsourced, got %', n; END IF;

    INSERT INTO public.object_type_media_sources (datasource_id, property_id)
      VALUES (media_ds, p1), (media_ds, p2);
    SELECT count(*) INTO n FROM public.media_property_problems() WHERE object_type = 'Photo';
    IF n <> 0 THEN RAISE EXCEPTION 'two properties could not share one media source'; END IF;

    -- ── the three refusals ───────────────────────────────────────────────
    ok := false;
    BEGIN
      INSERT INTO public.object_type_media_sources (datasource_id, property_id)
        VALUES (media_ds, plain);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%MediaSourceOnNonMediaProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a string property was bound to a media source'; END IF;

    ok := false;
    BEGIN
      INSERT INTO public.object_type_media_sources (datasource_id, property_id)
        SELECT id, p1 FROM public.object_type_datasources
         WHERE object_type_id = ot AND dataset_id IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%NotAMediaDatasource%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a dataset datasource was used as a media source'; END IF;

    -- A datasource backs its own object type's properties.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (other, 'shot', 'shot', 'Shot', 'media_reference', 'shot');
    ok := false;
    BEGIN
      INSERT INTO public.object_type_media_sources (datasource_id, property_id)
        SELECT media_ds, id FROM public.object_type_properties
         WHERE object_type_id = other AND property_id = 'shot';
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%MediaSourceCrossesObjectTypes%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a media source reached another object type'; END IF;

    RAISE EXCEPTION 'probe585:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe585:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe585';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '585: a media source is a datasource of a media set view';
END $do$;

COMMIT;
