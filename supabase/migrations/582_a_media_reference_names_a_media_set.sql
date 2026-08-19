-- The media reference property, and the media source the page says it must have.
--
-- ── WHAT THE VALUE IS ────────────────────────────────────────────────────
-- `object-link-types/base-types` prints the shape:
--
--   {"mimeType": "image/png",
--    "reference": {"type": "mediaSetViewItem",
--                  "mediaSetViewItem": {"mediaSetRid": …, "mediaSetViewRid": …,
--                                       "mediaItemRid": …}}}
--
-- and names the two halves:
--
--   "**mimeType:** The file's media type."
--   "**reference:** A reference containing the media set RID, view RID, and
--    specific media item RID."
--
-- Three RIDs, not one: the set, the VIEW of the set, and the item. A reference
-- carrying only a media item would be a different mechanism.
--
-- ── AND THE TWO STRUCTURAL REQUIREMENTS ──────────────────────────────────
--   "Object types with media reference properties are backed by a dataset. The
--    backing dataset must include a media reference column, which will map to
--    the media reference property."
--
--   "Additionally, a media reference property must have a **media source**,
--    which can be configured in the **Capabilities** tab of the object type.
--    This media source should be the media set that the media references point
--    to."
--
-- The first already holds: `source = 'column'` requires a backing column, and
-- an object type's datasource is a dataset. The second is new.
--
-- ── AND IT IS NOT A CAPABILITY, DESPITE THE TAB ──────────────────────────
-- `media-reference-media-source.png` draws the panel, and its shape settles
-- this. Every row is a media reference PROPERTY carrying `+ Add media source`,
-- and beneath it the source itself — the dataset `images` on branch `master`.
--
-- `object_type_capabilities` (415) nominates a PROPERTY FOR A SLOT:
-- `geospatial.altitude`, `event.event_id`. That is the opposite direction, and
-- its unique key is (object type, capability, slot). A media source is
-- (property → dataset, branch), so it needs its own table. **"It is on the
-- Capabilities tab" is exactly the reasoning that would put it in the wrong
-- one.**
--
-- ── WHERE THE "MUST" IS ENFORCED ─────────────────────────────────────────
-- The page says a media reference property MUST have a media source. The panel
-- shows a property with an `+ Add media source` button, so the property exists
-- before its source does — the same incremental authoring the derived-property
-- chain has (576), where a trigger demanding completeness would make the
-- documented order impossible. So: a trigger keeps a source attached only to a
-- media reference property, and `ontology_violations()` reports a media
-- reference property that has none.
--
-- ── AND ONE THING ALREADY BUILT, CONFIRMED NOT CHANGED ───────────────────
-- Two pages disagree about arrays. `base-types` says "All base types may be
-- used in arrays to represent multiple values for a property, excluding the
-- `Vector` and `Time series` types" — which would permit an array of media
-- references. `media-sets-advanced-formats/media-in-ontology` is specific:
--
--   "Media reference lists are not supported as a property type on an object."
--
-- The specific page wins, 546 already built the stricter reading, and
-- `array_element_allowed` excludes all three. Checked rather than assumed.

BEGIN;

-- ── §0 a RID is well-formed, which nothing checked until now ────────────
-- 391 and 396 mint RIDs and 412 pulls a locator out of one; nothing ever asked
-- whether a string IS one. The media reference needs that, because its whole
-- payload is three of them.
--
-- The grammar is `ri.<service>.<instance>.<type>.<locator>` with the segment
-- rules described (not quoted) in `readings/materializations-links-media-and-rids`
-- §RIDs — the specification lives outside the mirror, so quoting it would put an
-- uncheckable citation in the schema.
CREATE OR REPLACE FUNCTION public.rid_valid(p_rid text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  -- instance is optionally empty, which is why the third segment may be blank.
  SELECT p_rid IS NOT NULL
     AND p_rid ~ '^ri\.[a-z][a-z0-9-]*\.([a-z0-9][a-z0-9-]*)?\.[a-z][a-z0-9-]*\.[a-zA-Z0-9._-]+$'
$fn$;
COMMENT ON FUNCTION public.rid_valid(text) IS
  'Is this string a resource identifier? ri.<service>.<instance>.<type>.<locator>, where the instance segment may be empty — the one segment that surprises people.';

-- ── §1 the value's shape ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.media_reference_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  SELECT p IS NOT NULL
     AND jsonb_typeof(p) = 'object'
     -- "mimeType: The file's media type."
     AND jsonb_typeof(p->'mimeType') = 'string'
     AND btrim(p->>'mimeType') <> ''
     AND jsonb_typeof(p->'reference') = 'object'
     AND p->'reference'->>'type' = 'mediaSetViewItem'
     AND jsonb_typeof(p->'reference'->'mediaSetViewItem') = 'object'
     -- "A reference containing the media set RID, view RID, and specific media
     --  item RID." Three, and each a RID.
     AND public.rid_valid(p->'reference'->'mediaSetViewItem'->>'mediaSetRid')
     AND public.rid_valid(p->'reference'->'mediaSetViewItem'->>'mediaSetViewRid')
     AND public.rid_valid(p->'reference'->'mediaSetViewItem'->>'mediaItemRid')
$fn$;
COMMENT ON FUNCTION public.media_reference_valid(jsonb) IS
  'The published media reference shape: a mimeType and a reference naming three RIDs — the media set, the view of it, and the item. A reference carrying only an item RID is a different mechanism.';

-- ── §2 the media source ──────────────────────────────────────────────────
CREATE TABLE public.object_type_media_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  -- The panel draws a dataset and a branch: `images` · `master`.
  dataset_id  uuid NOT NULL REFERENCES public.datasets(id) ON DELETE RESTRICT,
  branch_id   uuid NOT NULL REFERENCES public.dataset_branches(id) ON DELETE RESTRICT,
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, dataset_id, branch_id)
);
CREATE INDEX object_type_media_sources_property ON public.object_type_media_sources (property_id);
CREATE INDEX object_type_media_sources_dataset ON public.object_type_media_sources (dataset_id);
CREATE INDEX object_type_media_sources_branch ON public.object_type_media_sources (branch_id);

COMMENT ON TABLE public.object_type_media_sources IS
  'The media set a media reference property points into, as the Capabilities panel draws it — a dataset and a branch per property. NOT a row in object_type_capabilities: that table nominates a property for a slot, which is the opposite direction.';

CREATE OR REPLACE FUNCTION public.guard_media_source()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE bt text; owner uuid;
BEGIN
  SELECT base_type, object_type_id INTO bt, owner
    FROM public.object_type_properties WHERE id = NEW.property_id;
  IF bt IS DISTINCT FROM 'media_reference' THEN
    RAISE EXCEPTION 'Ontology:MediaSourceOnNonMediaProperty — only a media reference property has a media source, and % is %', NEW.property_id, coalesce(bt, 'missing');
  END IF;
  -- The branch has to be a branch OF that dataset, or the pair names nothing.
  IF NOT EXISTS (SELECT 1 FROM public.dataset_branches b
                  WHERE b.id = NEW.branch_id AND b.dataset_id = NEW.dataset_id) THEN
    RAISE EXCEPTION 'Ontology:MediaSourceBranchMismatch — that branch does not belong to that dataset';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER media_source_belongs_to_a_media_property
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

-- ── §3 the MUST, where a complete definition can be judged ───────────────
CREATE OR REPLACE FUNCTION public.media_property_problems()
RETURNS TABLE (object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  -- "a media reference property must have a media source"
  SELECT t.api_name, 'property', p.property_id,
         'Media reference property has no media source; it must name the media set its references point to'
    FROM public.object_type_properties p
    JOIN public.object_types t ON t.id = p.object_type_id
   WHERE p.base_type = 'media_reference'
     AND NOT EXISTS (SELECT 1 FROM public.object_type_media_sources m
                      WHERE m.property_id = p.id)
$fn$;
REVOKE ALL ON FUNCTION public.media_property_problems() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.media_property_problems() TO authenticated;

CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE (object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT * FROM public.ontology_violations_core()
  UNION ALL
  SELECT * FROM public.derived_property_problems()
  UNION ALL
  SELECT * FROM public.media_property_problems()
$fn$;

-- ── assertions ───────────────────────────────────────────────────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ot uuid; ds uuid; br uuid; ds2 uuid; br2 uuid;
  media uuid; plain uuid; n int; ok boolean; good jsonb;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe582') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe582') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe582', 'Probe582') RETURNING id INTO proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe582', 'Probe582', false) RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Photo', 'Photo') RETURNING id INTO ot;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, proj, 'images', 'images') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, proj, 'other', 'other') RETURNING id INTO ds2;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds2, 'master') RETURNING id INTO br2;

    -- ── the value's shape ────────────────────────────────────────────────
    good := jsonb_build_object(
      'mimeType', 'image/png',
      'reference', jsonb_build_object('type', 'mediaSetViewItem',
        'mediaSetViewItem', jsonb_build_object(
          'mediaSetRid', 'ri.mio.main.media-set.00000000-0000-0000-0000-000000000000',
          'mediaSetViewRid', 'ri.mio.main.view.00000000-0000-0000-0000-000000000000',
          'mediaItemRid', 'ri.mio.main.media-item.00000000-0000-0000-0000-000000000000')));
    IF NOT public.media_reference_valid(good) THEN
      RAISE EXCEPTION 'the published example did not validate';
    END IF;
    -- All three RIDs are required, not just the item.
    IF public.media_reference_valid(good #- '{reference,mediaSetViewItem,mediaSetViewRid}') THEN
      RAISE EXCEPTION 'a reference without the view RID validated';
    END IF;
    IF public.media_reference_valid(good - 'mimeType') THEN
      RAISE EXCEPTION 'a reference without a mimeType validated';
    END IF;
    IF public.media_reference_valid(jsonb_set(good, '{reference,type}', '"somethingElse"')) THEN
      RAISE EXCEPTION 'an unknown reference type validated';
    END IF;

    -- ── the property, and its source ─────────────────────────────────────
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (ot, 'image', 'image', 'Image', 'media_reference', 'image')
      RETURNING id INTO media;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (ot, 'caption', 'caption', 'Caption', 'string', 'caption')
      RETURNING id INTO plain;

    -- The MUST is a violation while it has none, not a refusal.
    SELECT count(*) INTO n FROM public.media_property_problems() WHERE subject = 'image';
    IF n <> 1 THEN RAISE EXCEPTION 'a sourceless media property drew % problems', n; END IF;

    -- The arm is wired into the linter. Asserted POSITIVELY — that the problem
    -- appears — rather than by counting rows for this subject after it is
    -- fixed: other arms report on the same property for their own reasons, so
    -- an absence check there would be testing them instead of this.
    SELECT count(*) INTO n FROM public.ontology_violations()
     WHERE subject = 'image' AND problem LIKE '%media source%';
    IF n <> 1 THEN RAISE EXCEPTION 'the media arm did not reach ontology_violations()'; END IF;

    INSERT INTO public.object_type_media_sources (property_id, dataset_id, branch_id)
      VALUES (media, ds, br);
    SELECT count(*) INTO n FROM public.media_property_problems() WHERE subject = 'image';
    IF n <> 0 THEN RAISE EXCEPTION 'a sourced media property still drew a problem'; END IF;
    SELECT count(*) INTO n FROM public.ontology_violations()
     WHERE subject = 'image' AND problem LIKE '%media source%';
    IF n <> 0 THEN RAISE EXCEPTION 'the resolved problem survived in the linter'; END IF;

    -- ── the two refusals ────────────────────────────────────────────────
    ok := false;
    BEGIN
      INSERT INTO public.object_type_media_sources (property_id, dataset_id, branch_id)
        VALUES (plain, ds, br);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%MediaSourceOnNonMediaProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a string property took a media source'; END IF;

    ok := false;
    BEGIN
      INSERT INTO public.object_type_media_sources (property_id, dataset_id, branch_id)
        VALUES (media, ds, br2);   -- br2 belongs to ds2
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%MediaSourceBranchMismatch%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a branch of another dataset was accepted'; END IF;

    -- ── and the array rule 546 built is untouched ───────────────────────
    ok := false;
    BEGIN
      INSERT INTO public.object_type_properties
        (object_type_id, property_id, api_name, display_name, base_type,
         array_element_type, backing_column)
        VALUES (ot, 'gallery', 'gallery', 'Gallery', 'array', 'media_reference', 'gallery');
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN
      RAISE EXCEPTION 'a media reference list was accepted, and the page forbids it';
    END IF;

    RAISE EXCEPTION 'probe582:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe582:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe582';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '582: a media reference names a media set';
END $do$;

COMMIT;
