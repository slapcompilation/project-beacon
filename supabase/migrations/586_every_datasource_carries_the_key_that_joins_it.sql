-- An object type may be backed by more than one datasource, and the thing that
-- makes that a single object type rather than two is a shared key.
--
--   "The Map primary key helper will appear and prompt you for a column with
--    values matching the primary key of the object type. Once you choose a
--    column, multiple backing datasets will appear under the Backing datasource
--    section."
--
--   "This means that a specific property of an object type must come from
--    one—and only one—of the input datasources (except for the primary key
--    property, which must exist in every input datasource to join all
--    datasources)."
--
--   — object-permissioning/multi-datasource-objects.md
--
-- The parenthesis is the whole rule. Every other property belongs to one
-- datasource; the primary key belongs to all of them, so it is not a property
-- attribute — it is one column name per datasource.
--
-- The helper appears when a SECOND datasource is added. The first one's key is
-- already known: the primary key property names its own backing column. So the
-- column added here is nullable and the question the linter asks is whether a
-- key is DERIVABLE, not whether one was typed.
--
-- Two more things this migration carries, both from the same reading
-- (readings/object-type-datasources.md):
--
--  · the 70-datasource limit counts the wrong rows since 585, and
--  · the API says an object type's icon has a colour, and ours has none.

-- ── §1 the icon is a union, and its one member has two required halves ─────
--
--   "A union currently only consisting of the BlueprintIcon (more icon types
--    may be added in the future)."
--
-- whose `blueprint` member carries `color` · string · required — "A hexadecimal
-- color code" — and `name` · string · required, "the name of the Blueprint icon
-- ... used to specify the Blueprint icon to represent the object type in a
-- React app" (api/v2/ontologies-v2-resources/object-types-get-object-type).
--
-- No discriminator column: the union has one member today and the page names no
-- second, so a `kind` column would have one legal value and no reader.
ALTER TABLE public.object_types
  ADD COLUMN icon_color text NOT NULL DEFAULT '#2D72D2';

ALTER TABLE public.object_types
  ADD CONSTRAINT object_types_icon_color_is_hex
  CHECK (icon_color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN public.object_types.icon_color IS
  'A hexadecimal color code — the other required half of the API''s BlueprintIcon. '
  'INFERENCE: the default #2D72D2 is Blueprint''s blue3 and its primary intent '
  'colour, matching the blue cube in every object type screenshot in the mirror. '
  'No page states a default.';

-- ── §2 the join key, one per datasource ───────────────────────────────────
-- Null on a media set view: it binds properties directly through
-- object_type_media_sources and has nothing to join.
ALTER TABLE public.object_type_datasources
  ADD COLUMN primary_key_column text;

ALTER TABLE public.object_type_datasources
  ADD CONSTRAINT object_type_datasources_media_has_no_join_key
  CHECK (media_set_rid IS NULL OR primary_key_column IS NULL);

COMMENT ON COLUMN public.object_type_datasources.primary_key_column IS
  'The column in this datasource whose values match the object type''s primary '
  'key. Left null on the datasource the primary key property itself points at, '
  'where the key is already known.';

-- ── §3 the limit counts what object storage syncs ─────────────────────────
--
--   "Object types are limited to a maximum of 70 datasources. Only datasources
--    that are synced to object storage count towards this limit, so it does not
--    include media sets or time series syncs."
--
-- 585 added the media set view as a third backing kind and this counter kept
-- counting every row. It is the third rule in this function written when there
-- was only one kind — the organization check and the MAP-column check needed
-- the same treatment there. So the distinction gets a name, `synced`, and when
-- a time series sync datasource arrives it is one line.
CREATE OR REPLACE FUNCTION public.guard_object_type_datasource()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  n int; holder uuid; bad text; ds_org uuid; ot_ont uuid; eff_ds uuid; fields jsonb;
  synced boolean;
BEGIN
  -- Synced to object storage: a dataset or a restricted view. Not a media set,
  -- and not a time series sync when there is one.
  synced := NEW.media_set_rid IS NULL;

  eff_ds := COALESCE(NEW.dataset_id,
    (SELECT v.input_dataset_id FROM public.restricted_views v WHERE v.id = NEW.restricted_view_id));
  SELECT ontology_id INTO ot_ont FROM public.object_types WHERE id = NEW.object_type_id;

  -- A media set view is not a dataset in this space; the organization rule has
  -- nothing to compare and is skipped rather than failed.
  IF synced THEN
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

  IF synced THEN
    SELECT count(*) INTO n FROM public.object_type_datasources
     WHERE object_type_id = NEW.object_type_id AND id IS DISTINCT FROM NEW.id
       AND media_set_rid IS NULL;
    IF n >= 70 THEN
      RAISE EXCEPTION 'Ontology:TooManyDatasources — an object type is limited to 70 datasources synced to object storage, and this one already has %', n;
    END IF;
  END IF;

  -- The MAP-column check reads a dataset's schema. A media set has none.
  IF synced THEN
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

-- ── §4 an unfinished datasource is reported, not refused ──────────────────
-- The two screenshots on the page say this and the prose does not: with one
-- backing datasource the object type carries a green tick; with two, the same
-- dot is a red error and the save session's header shows a problem count. The
-- edit stands. So this belongs in the linter, beside the derived-property and
-- media-property problems, and not in a constraint.
CREATE OR REPLACE FUNCTION public.datasource_mapping_problems()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  -- No key to join on. Either the datasource names its own column, or it holds
  -- the primary key property, which names one.
  SELECT t.api_name, 'datasource', d.id::text,
         'Backing datasource has no primary key column; map the column whose values match the object type''s primary key'
    FROM public.object_type_datasources d
    JOIN public.object_types t ON t.id = d.object_type_id
   WHERE d.media_set_rid IS NULL
     AND d.primary_key_column IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.object_type_properties p
                      WHERE p.datasource_id = d.id AND p.is_primary_key)

  UNION ALL

  -- A named column that the datasource does not have. This is the one that goes
  -- stale on its own: nobody edited the ontology, the dataset's schema moved.
  SELECT t.api_name, 'datasource', d.id::text,
         format('Primary key column %L is not in the backing datasource''s schema', d.primary_key_column)
    FROM public.object_type_datasources d
    JOIN public.object_types t ON t.id = d.object_type_id
   WHERE d.primary_key_column IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(coalesce(
         CASE WHEN d.dataset_id IS NOT NULL THEN public.dataset_branch_schema(d.branch_id)
              ELSE public.dataset_current_fields(
                (SELECT v.input_dataset_id FROM public.restricted_views v
                  WHERE v.id = d.restricted_view_id)) END, '[]'::jsonb)) f
        WHERE f ->> 'name' = d.primary_key_column)

  UNION ALL

  -- "Navigate to the Properties metadata section from the left sidebar to add
  -- new fields to the newly added dataset." Until that happens the datasource
  -- backs nothing, which is the state the second screenshot is in.
  SELECT t.api_name, 'datasource', d.id::text,
         'Backing datasource maps no properties; add fields from it in the Properties section'
    FROM public.object_type_datasources d
    JOIN public.object_types t ON t.id = d.object_type_id
   WHERE NOT EXISTS (SELECT 1 FROM public.object_type_properties p WHERE p.datasource_id = d.id)
     AND NOT EXISTS (SELECT 1 FROM public.object_type_media_sources m WHERE m.datasource_id = d.id)
$fn$;

CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT * FROM public.ontology_violations_core()
  UNION ALL
  SELECT * FROM public.derived_property_problems()
  UNION ALL
  SELECT * FROM public.media_property_problems()
  UNION ALL
  SELECT * FROM public.datasource_mapping_problems()
$fn$;

-- ── §5 what this migration claims, checked at the moment it lands ─────────
DO $$
DECLARE n int;
BEGIN
  -- The icon default is a legal hex code and every existing type now has one.
  SELECT count(*) INTO n FROM public.object_types WHERE icon_color !~ '^#[0-9A-Fa-f]{6}$';
  IF n > 0 THEN RAISE EXCEPTION 'icon_color is not a hex code on % object type(s)', n; END IF;

  -- The linter composes: four arms, and the new one is reachable.
  PERFORM 1 FROM public.ontology_violations() LIMIT 1;
  PERFORM 1 FROM public.datasource_mapping_problems() LIMIT 1;
END $$;
