-- 715 — object_state keys its state by property_id, the vocabulary its writer
-- and its reader already speak (creation review, F3).
--
-- The seam: apply_action writes object_edits.properties keyed by PROPERTY_ID
-- (its rule properties resolve prop_key = property_id), and index_object_type
-- builds columns named by PROPERTY_ID — its own comment declares dataset rows
-- become jsonb keyed by property_id, 'which is the shape object_state()
-- replays edits onto'. object_state broke that contract in two places: the
-- create arm's null scaffold aggregated on api_name, and the primary-key
-- reinjection looked the key property up by api_name. With property_id equal
-- to api_name nothing shows, which is every prior fixture; with them apart —
-- the normal result of mapping a dataset column to a prettier API name — an
-- action-created object merged into a bag with no key under the pk's
-- property_id, and the NOT NULL key column failed the type's ENTIRE index
-- build. Probed live 2026-08-28 (scripts/probes/f3-property-key-seam.mjs):
-- edit row {primary_key C, properties {}}, object_state returned the state
-- keyed by api_name, index job FAILED on a null pk.
--
-- The reinjection's own comment said why it exists — 'or a created object
-- reindexes into a null pk' — and the wrong key meant the intent never held
-- when the names differed.
--
-- Live-patched from pg_get_functiondef: the two api_name sites become
-- property_id, their comments follow, NOTHING ELSE MOVES. The both-ways
-- hedges downstream (index_object_type's required-property presence check,
-- apply_action's required check) stay — they are tolerant reads, not writers.

DO $patch$
DECLARE
  src text;
  n int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'object_state';
  IF src IS NULL THEN
    RAISE EXCEPTION 'object_state not found';
  END IF;

  -- Anchor 1: the create arm's scaffold.
  n := (length(src) - length(replace(src, 'jsonb_object_agg(p.api_name, ''null''::jsonb)', ''))) /
       length('jsonb_object_agg(p.api_name, ''null''::jsonb)');
  IF n <> 1 THEN
    RAISE EXCEPTION 'scaffold anchor found % times, expected 1', n;
  END IF;
  src := replace(src,
    'jsonb_object_agg(p.api_name, ''null''::jsonb)',
    'jsonb_object_agg(p.property_id, ''null''::jsonb)');

  -- Anchor 2: the primary-key reinjection lookup.
  n := (length(src) - length(replace(src, 'SELECT p.api_name INTO latest FROM public.object_type_properties p', ''))) /
       length('SELECT p.api_name INTO latest FROM public.object_type_properties p');
  IF n <> 1 THEN
    RAISE EXCEPTION 'reinjection anchor found % times, expected 1', n;
  END IF;
  src := replace(src,
    'SELECT p.api_name INTO latest FROM public.object_type_properties p',
    'SELECT p.property_id INTO latest FROM public.object_type_properties p');

  -- The scaffold comment names the shape; keep it truthful.
  src := replace(src,
    '-- Every declared property, null unless the create or a later modify set it.',
    '-- Every declared property, null unless the create or a later modify set it,
    -- keyed by property_id: the key apply_action writes and the index reads.');

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — the changed arms execute, against a fixture whose
--    property_id and api_name DIFFER, and the fixture removes itself. ───────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; ot uuid; st jsonb; del boolean;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m715 probe') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m715 probe') RETURNING id INTO space;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (space, org);
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (space, 'm715_probe', 'M715', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label, edits_enabled)
  VALUES (ont, 'M715Thing', 'M715 thing', true) RETURNING id INTO ot;
  -- The seam's shape: property_id and api_name deliberately apart.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true);

  -- A create edit the way apply_action writes one: pk in primary_key,
  -- properties empty, under the action flag 605 demands.
  PERFORM set_config('beacon.applying_action', 'on', true);
  INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
  VALUES (ot, 'C', 'create', '{}'::jsonb);
  PERFORM set_config('beacon.applying_action', '', true);

  SELECT s.properties, s.deleted INTO st, del
    FROM public.object_state(ot, 'C', NULL) s;
  IF del THEN
    RAISE EXCEPTION 'created object reported deleted';
  END IF;
  IF st ->> 'pk' IS DISTINCT FROM 'C' THEN
    RAISE EXCEPTION 'primary key not reinjected under property_id: %', st;
  END IF;
  IF st ? 'id' THEN
    RAISE EXCEPTION 'state still carries an api_name key: %', st;
  END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.object_edits WHERE object_type_id = ot;
  DELETE FROM public.object_types WHERE id = ot;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.organizations WHERE id = org;
END $$;
