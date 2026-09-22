-- A datasource can apply the most recent value, and now something does it.
--
-- `object_type_datasources.conflict_resolution` has admitted
-- `apply_most_recent_value` since it was created. `guard_conflict_resolution`
-- refuses the value without a timestamp property, and refuses a `date` one.
-- `timestamp_property_id` is there. The CHECK is there.
--
-- AND NOTHING EVER READ ANY OF IT. `object_state` — the one function that
-- resolves an object from its datasource row and its edit log — does not
-- mention `conflict_resolution`, so a datasource set to
-- `apply_most_recent_value` has behaved exactly like one set to
-- `apply_user_edits`. A settable value that changes nothing is worse than an
-- absent one, because the surface can offer it and the guard can defend it
-- while the engine ignores it. The census filed this as "an engine nothing
-- reaches"; measured, it is the other way round — the vocabulary reaches
-- nothing.
--
-- THE RULE, from the page that owns it:
--
--   "With this strategy, user edits are conditionally applied; that is, user edits are only applied if the timestamp of the user edit is more recent than the timestamp value coming from the datasource for the given object."
--   — object-edits/how-edits-applied.md
--
--   "The user edit is applied if the value of the timestamp property in the backing datasource is older than the timestamp associated with the user edit, otherwise the edit is ignored."
--   — object-edits/how-edits-applied.md
--
-- PER DATASOURCE, AND THEREFORE PER PROPERTY:
--
--   "Each datasource of the object type can have different resolution strategies."
--   — object-edits/how-edits-applied.md
--
--   "If an edit updates properties across multiple datasources, then whether those edits will be conditionally applied or always applied will be determined by the resolution strategy of the datasource that backs the property."
--   — object-edits/how-edits-applied.md
--
-- So the decision is taken once per property of each edit, not once per edit.
-- Every property names its datasource already, so no argument had to be added
-- to `object_state` and no call site moves.
--
-- THE THREE ESCAPES, each of which the page states and each of which is built:
--
--   "For edit-only properties, user edits will always apply regardless of the timestamp on the input datasource."
--   — object-edits/how-edits-applied.md
--
--   "For the ticket with Ticket ID of 102, there is no value for the timestamp property in the backing datasource, so all three conditional edits are applied, regardless of their associated timestamps."
--   — object-edits/how-edits-applied.md
--
--   "For user edits to those properties applied *after* the conflict resolution strategy was changed, they will be conditionally applied based on the timestamp of the action submission that resulted in that edit, and any *existing* edits to those properties will be conditionally applied based on the timestamp of the conflict resolution strategy change."
--   — object-edits/how-edits-applied.md
--
-- That last one is why this migration adds a column: an edit made before the
-- strategy was switched on is compared against the SWITCH, not against itself,
-- and nothing here recorded when the switch happened. `greatest(edit_at,
-- changed_at)` is exactly the sentence.
--
-- AND THE COMPARISON IS AGAINST THE INPUT DATASOURCE ONLY:
--
--   "Even if users change the timestamp property via user edits, the conditional comparison will only happen between the timestamp from the input datasource and the user edit application time."
--   — object-edits/how-edits-applied.md
--
-- The helper reads `p_datasource_row`, which is the unedited row, so this falls
-- out of where the value is read from rather than needing a rule of its own.
--
-- THE CREATE PATH HAS ITS OWN TIMESTAMP TEST, and the prose never says so.
-- The most-recent chart carries seven decision diamonds where the default
-- strategy's chart has four, and the extra pair sit on the create path. Read
-- off the image at 2079x1169, a full view and not a crop, opened for this
-- migration:
--
--   "Is the object present in the datasource?"
--   "Does the timestamp on datasource occur before the time the create instruction happens?"
--   "Object is visible. Edits from the create instruction are ignored. The object instance will only contain datasource data."
--   — object-edits/images/object-edits-visibility-flowchart-most-recent-strategy.png
--
-- That last outcome exists nowhere in the prose, and without the image a create
-- would have kept winning unconditionally.
--
-- WHAT DOES NOT MOVE: the delete path. "Deletions are not considered an edit.
-- Once a deletion is applied, the object is no longer visible regardless of
-- datasource state" — the same first diamond in both charts, and already built.

-- ── when the strategy last changed ─────────────────────────────────────────
ALTER TABLE public.object_type_datasources
  ADD COLUMN conflict_resolution_changed_at timestamptz;

COMMENT ON COLUMN public.object_type_datasources.conflict_resolution_changed_at IS
  'When this datasource''s conflict resolution strategy last changed. Edits older than this are compared against it rather than against themselves (object-edits/how-edits-applied).';

-- Stamped by the guard that already runs BEFORE INSERT OR UPDATE on this table,
-- rather than by a second trigger competing with it for the same row.
CREATE OR REPLACE FUNCTION public.guard_conflict_resolution()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE t text;
BEGIN
  IF NEW.conflict_resolution = 'apply_most_recent_value' THEN
    IF NEW.timestamp_property_id IS NULL THEN
      RAISE EXCEPTION 'Ontology:MostRecentValueNeedsATimestamp — this strategy requires a timestamp property on the datasource';
    END IF;
    SELECT base_type INTO t FROM public.object_type_properties
     WHERE id = NEW.timestamp_property_id;
    -- "the DATE property type will not work for this option"
    IF t <> 'timestamp' THEN
      RAISE EXCEPTION 'Ontology:MostRecentValueNeedsATimestamp — the property is %, and the date property type will not work for this option', t
        USING HINT = 'The timestamp property must be in Coordinated Universal Time (UTC).';
    END IF;
  END IF;

  -- The switch is what pre-existing edits are measured against, so it is
  -- recorded when it happens and never recomputed.
  IF TG_OP = 'INSERT' THEN
    NEW.conflict_resolution_changed_at := clock_timestamp();
  ELSIF NEW.conflict_resolution IS DISTINCT FROM OLD.conflict_resolution THEN
    NEW.conflict_resolution_changed_at := clock_timestamp();
  ELSE
    NEW.conflict_resolution_changed_at := OLD.conflict_resolution_changed_at;
  END IF;

  RETURN NEW;
END $function$;

-- Existing rows predate the column. They are all `apply_user_edits`, which
-- never consults it, so backfilling from `added_at` states the truth: nothing
-- has changed since the datasource was added.
UPDATE public.object_type_datasources
   SET conflict_resolution_changed_at = added_at
 WHERE conflict_resolution_changed_at IS NULL;

-- ── the one decision ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.conditional_edit_applies(
  p_datasource uuid, p_at timestamptz, p_datasource_row jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT d.id IS NULL
      -- "Apply user edits (default)": the edit always wins.
      OR d.conflict_resolution <> 'apply_most_recent_value'
      -- Ticket 102: no timestamp in the datasource, so every edit applies.
      OR ts.v IS NULL
      -- Ticket 101: the datasource value is older than the edit, so it applies.
      OR ts.v < greatest(p_at, d.conflict_resolution_changed_at)
    FROM (SELECT 1) _
    LEFT JOIN public.object_type_datasources d ON d.id = p_datasource
    LEFT JOIN LATERAL (
      SELECT (p_datasource_row ->> tp.property_id)::timestamptz AS v
        FROM public.object_type_properties tp WHERE tp.id = d.timestamp_property_id
    ) ts ON true
$$;

COMMENT ON FUNCTION public.conditional_edit_applies(uuid, timestamptz, jsonb) IS
  'Whether an edit made at p_at survives this datasource''s conflict resolution strategy, given the unedited datasource row. True for apply_user_edits, for a null datasource timestamp, and when that timestamp is older than the edit (object-edits/how-edits-applied).';

GRANT EXECUTE ON FUNCTION public.conditional_edit_applies(uuid, timestamptz, jsonb) TO authenticated, service_role;

-- ── which properties of one edit survive ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.edit_properties_that_apply(
  p_object_type uuid, p_edit jsonb, p_at timestamptz, p_datasource_row jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(jsonb_object_agg(k.key, k.value), '{}'::jsonb)
    FROM jsonb_each(p_edit) k
    LEFT JOIN public.object_type_properties p
      ON p.object_type_id = p_object_type AND p.property_id = k.key
   WHERE
     -- "For edit-only properties, user edits will always apply regardless of
     --  the timestamp on the input datasource."
     p.source = 'user_input'
     -- A key naming no declared property, or a property bound to no
     -- datasource, has no strategy to consult. It applies, which is the
     -- default and what every caller saw before this migration.
     OR p.property_id IS NULL
     OR p.datasource_id IS NULL
     OR public.conditional_edit_applies(p.datasource_id, p_at, p_datasource_row)
$$;

COMMENT ON FUNCTION public.edit_properties_that_apply(uuid, jsonb, timestamptz, jsonb) IS
  'The subset of one edit''s properties that survive conflict resolution, decided per property by the datasource that backs it (object-edits/how-edits-applied).';

GRANT EXECUTE ON FUNCTION public.edit_properties_that_apply(uuid, jsonb, timestamptz, jsonb) TO authenticated, service_role;

-- ── object_state asks, per property and on the create path ─────────────────
-- Patched from the live definition, never retyped. Three replaces, each
-- asserted, and the signature does not move — every one of the four callers
-- and the platform suite's own three-argument call keep working unchanged.
DO $patch$
DECLARE src text; out text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'object_state';
  IF src IS NULL THEN RAISE EXCEPTION 'PATCH FAILED: object_state is not there'; END IF;

  -- 1. Two more locals: when the create happened, and the row's datasource.
  out := replace(src,
    '  latest text; create_seq bigint; state jsonb; e record;',
    '  latest text; create_seq bigint; state jsonb; e record;' || E'\n' ||
    '  create_at timestamptz; row_ds uuid;');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the declare block did not match'; END IF;
  src := out;

  -- 2. The create path's own timestamp test, which only the flowchart states.
  out := replace(src,
$old$  IF create_seq IS NOT NULL THEN
$old$,
$new$  IF create_seq IS NOT NULL THEN
    -- The extra diamond the most-recent chart adds: does the timestamp on the
    -- datasource occur before the time the create instruction happens? Its NO
    -- arm leaves the object visible with the create's edits ignored, holding
    -- datasource data only. Cited from the image in this migration's header.
    SELECT i.applied_at INTO create_at FROM public.object_edits i
     WHERE i.object_type_id = p_object_type AND i.primary_key = p_primary_key
       AND i.seq = create_seq;
    SELECT pr.datasource_id INTO row_ds FROM public.object_type_properties pr
     WHERE pr.object_type_id = p_object_type AND pr.datasource_id IS NOT NULL
       AND p_datasource_row ? pr.property_id
     LIMIT 1;
    IF p_datasource_row IS NOT NULL AND row_ds IS NOT NULL
       AND NOT public.conditional_edit_applies(row_ds, create_at, p_datasource_row) THEN
      RETURN QUERY SELECT p_datasource_row, false; RETURN;
    END IF;

$new$);
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the create branch did not match'; END IF;
  src := out;

  -- 3. The modification merge, now decided per property.
  out := replace(src,
$old$  state := p_datasource_row;
  FOR e IN SELECT i.properties FROM public.object_edits i
            WHERE i.object_type_id = p_object_type AND i.primary_key = p_primary_key
            ORDER BY i.seq
  LOOP
    state := state || e.properties;
  END LOOP;
$old$,
$new$  state := p_datasource_row;
  FOR e IN SELECT i.properties, i.applied_at FROM public.object_edits i
            WHERE i.object_type_id = p_object_type AND i.primary_key = p_primary_key
            ORDER BY i.seq
  LOOP
    -- "determined by the resolution strategy of the datasource that backs the
    -- property" — so one edit can half apply.
    state := state || public.edit_properties_that_apply(
                        p_object_type, e.properties, e.applied_at, p_datasource_row);
  END LOOP;
$new$);
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the modification merge did not match'; END IF;
  src := out;

  EXECUTE src;
END $patch$;

COMMENT ON FUNCTION public.object_state(uuid, text, jsonb) IS
  'Resolves one object from its datasource row and its edit log, following both conflict resolution strategies in object-edits/how-edits-applied — the default four-step decision, and the most-recent-value chart''s seven. Checked against that page''s T0-T14 table and its Ticket example in @beacon/platform.';

-- PROVED BY DOING, against the page's OWN printed answer. The Ticket example
-- states the resolved state of two objects after three actions, and that table
-- is the assertion: 101 keeps its datasource title because the edit predates
-- the datasource timestamp, while 102 takes all three edits because its
-- timestamp is null.
DO $proof$
DECLARE
  v_org uuid; v_space uuid; v_proj uuid; v_ds uuid; v_branch uuid; v_phys text;
  v_ont uuid; v_type uuid; v_otds uuid; v_user uuid; v_txn uuid; v_file uuid;
  v_ts_prop uuid; v_row jsonb; v_state jsonb; v_del boolean; v_n int; v_switch timestamptz;
  v_unwound boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('zz842') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('zz842') RETURNING id INTO v_space;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_space, v_org);
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz842', 'zz842') RETURNING id INTO v_proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz842_ds', 'zz842_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;

    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'zz842@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz842@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_user, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_space, 'zz842', 'Zz842', false) RETURNING id INTO v_ont;
    -- The fixture writes edits directly, so it turns off the toggle the guard
    -- names in its own hint rather than pretending to be inside an action.
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, only_edits_via_actions)
      VALUES (v_ont, v_proj, 'Zz842Ticket', 'Zz842 ticket', false) RETURNING id INTO v_type;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_type, v_ds, v_branch) RETURNING id INTO v_otds;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       backing_column, is_primary_key, is_title_key, required, datasource_id)
    VALUES (v_type, 'ticket_id', 'ticketId', 'Ticket ID', 'string', 'column', 'ticket_id', true, true, true, null),
           (v_type, 'title', 'title', 'Title', 'string', 'column', 'title', false, false, false, v_otds),
           (v_type, 'priority', 'priority', 'Priority', 'string', 'column', 'priority', false, false, false, v_otds),
           (v_type, 'ts', 'ts', 'Timestamp', 'timestamp', 'column', 'ts', false, false, false, v_otds);
    -- One edit-only property, to prove the escape the header cites: such edits
    -- always apply regardless of the timestamp on the input datasource.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       backing_column, is_primary_key, is_title_key, required, datasource_id)
    VALUES (v_type, 'team', 'team', 'Team', 'string', 'user_input', NULL, false, false, false, v_otds);
    SELECT id INTO v_ts_prop FROM public.object_type_properties
     WHERE object_type_id = v_type AND property_id = 'ts';

    -- The datasource switches to the conditional strategy BEFORE the edits, so
    -- each edit is measured against its own submission time rather than against
    -- the switch.
    UPDATE public.object_type_datasources
       SET conflict_resolution = 'apply_most_recent_value', timestamp_property_id = v_ts_prop
     WHERE id = v_otds;
    SELECT conflict_resolution_changed_at INTO v_switch
      FROM public.object_type_datasources WHERE id = v_otds;

    -- THE TIMELINE IS THE PAGE'S, SHIFTED TO SIT AFTER THE SWITCH. The example
    -- prints absolute times in 2010, but the answer it prints depends only on
    -- the ORDER: the title edit, then the datasource timestamp, then the
    -- priority edit, all while the strategy is in force. Writing 2010 literally
    -- would put every edit BEFORE the switch, where the page's other rule takes
    -- over and measures them against the switch instead. That rule is real and
    -- is asserted separately below; it is not what this example is about.
    --   both titles set to Ticket, at 8:30 AM   -> switch + 1m
    --   the datasource timestamp, 9:00 AM        -> switch + 2m
    --   both priorities set to P0, at 9:30 AM    -> switch + 3m
    FOR v_n IN 1..2 LOOP
      INSERT INTO public.object_edits
        (object_type_id, primary_key, instruction, properties, applied_at, applied_by_user_id)
      VALUES (v_type, (100 + v_n)::text, 'modify', '{"title":"Ticket"}'::jsonb,
              v_switch + interval '1 minute', v_user),
             (v_type, (100 + v_n)::text, 'modify', '{"priority":"P0"}'::jsonb,
              v_switch + interval '3 minutes', v_user);
    END LOOP;

    -- Ticket 101: the datasource carries 9:00 AM.
    v_row := jsonb_build_object('ticket_id', '101', 'title', 'Ticket One',
                                'priority', 'P1', 'ts', to_char(v_switch + interval '2 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.USOF'));
    SELECT properties, deleted INTO v_state, v_del
      FROM public.object_state(v_type, '101', v_row);
    IF v_state ->> 'title' <> 'Ticket One' THEN
      RAISE EXCEPTION 'PROOF FAILED: 101 title is "%", and the page says the 8:30 edit predates the 9:00 datasource timestamp so it is ignored',
        v_state ->> 'title';
    END IF;
    IF v_state ->> 'priority' <> 'P0' THEN
      RAISE EXCEPTION 'PROOF FAILED: 101 priority is "%", and the page says the 9:30 edit is applied',
        v_state ->> 'priority';
    END IF;
    RAISE NOTICE 'PROVED: ticket 101 resolves to the page''s printed row — Ticket One / P0';

    -- Ticket 102: no timestamp at all, so every edit applies.
    v_row := jsonb_build_object('ticket_id', '102', 'title', 'Ticket Two', 'priority', 'P2');
    SELECT properties, deleted INTO v_state, v_del
      FROM public.object_state(v_type, '102', v_row);
    IF v_state ->> 'title' <> 'Ticket' OR v_state ->> 'priority' <> 'P0' THEN
      RAISE EXCEPTION 'PROOF FAILED: 102 resolves to % / %, and the page prints Ticket / P0',
        v_state ->> 'title', v_state ->> 'priority';
    END IF;
    RAISE NOTICE 'PROVED: ticket 102 resolves to the page''s printed row — Ticket / P0';

    -- One edit, half applied: the page's "it is possible for some newer user
    -- edits to apply and older user edits to not apply on the same object".
    IF public.edit_properties_that_apply(v_type,
         '{"title":"X","priority":"Y"}'::jsonb, v_switch + interval '1 minute',
         jsonb_build_object('ts', to_char(v_switch + interval '2 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.USOF')))
       <> '{}'::jsonb THEN
      RAISE EXCEPTION 'PROOF FAILED: an edit older than the datasource applied';
    END IF;
    RAISE NOTICE 'PROVED: an edit older than the datasource timestamp is dropped property by property';

    -- And the other rule, which the shifted timeline exists to keep separate:
    -- an edit made BEFORE the switch is measured against the SWITCH, so it
    -- survives a datasource timestamp that predates the switch however old the
    -- edit itself is.
    IF public.edit_properties_that_apply(v_type,
         '{"title":"X"}'::jsonb, timestamptz '2010-01-01 08:30:00+00',
         jsonb_build_object('ts', to_char(v_switch - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS.USOF')))
       = '{}'::jsonb THEN
      RAISE EXCEPTION 'PROOF FAILED: a pre-switch edit was measured against itself, not against the switch';
    END IF;
    RAISE NOTICE 'PROVED: an edit older than the switch is measured against the switch';

    -- The edit-only escape, which no timestamp can override.
    IF public.edit_properties_that_apply(v_type,
         '{"team":"Recruiting","title":"X"}'::jsonb, v_switch + interval '1 minute',
         jsonb_build_object('ts', to_char(v_switch + interval '2 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.USOF')))
       <> '{"team": "Recruiting"}'::jsonb THEN
      RAISE EXCEPTION 'PROOF FAILED: the edit-only property did not survive, or the column property did';
    END IF;
    RAISE NOTICE 'PROVED: an edit-only property always applies, beside a column property that does not';

    -- THE CREATE PATH'S OWN DIAMOND, which only the flowchart states. A create
    -- made BEFORE the datasource timestamp leaves the object visible with the
    -- create's edits ignored, holding datasource data only.
    INSERT INTO public.object_edits
      (object_type_id, primary_key, instruction, properties, applied_at, applied_by_user_id)
    VALUES (v_type, '103', 'create', '{"ticket_id":"103","title":"Made up"}'::jsonb,
            v_switch + interval '1 minute', v_user);
    v_row := jsonb_build_object('ticket_id', '103', 'title', 'From the datasource',
                                'priority', 'P3', 'ts', to_char(v_switch + interval '2 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.USOF'));
    SELECT properties, deleted INTO v_state, v_del
      FROM public.object_state(v_type, '103', v_row);
    IF v_del THEN RAISE EXCEPTION 'PROOF FAILED: the created object went invisible'; END IF;
    IF v_state ->> 'title' <> 'From the datasource' THEN
      RAISE EXCEPTION 'PROOF FAILED: the create won over a newer datasource row — title is "%"',
        v_state ->> 'title';
    END IF;
    RAISE NOTICE 'PROVED: a create older than the datasource timestamp is ignored, and only datasource data remains';

    -- And the other arm of the same diamond: a create AFTER the datasource
    -- timestamp still marks the starting point and ignores datasource data.
    UPDATE public.object_edits SET applied_at = v_switch + interval '5 minutes'
     WHERE object_type_id = v_type AND primary_key = '103';
    SELECT properties INTO v_state FROM public.object_state(v_type, '103', v_row);
    IF v_state ->> 'title' <> 'Made up' OR v_state ->> 'priority' IS NOT NULL THEN
      RAISE EXCEPTION 'PROOF FAILED: a create newer than the datasource did not take over — %', v_state;
    END IF;
    RAISE NOTICE 'PROVED: a create newer than the datasource timestamp still ignores all datasource data';

    -- The default strategy is untouched: switch back and the 8:30 edit returns.
    UPDATE public.object_type_datasources
       SET conflict_resolution = 'apply_user_edits', timestamp_property_id = NULL
     WHERE id = v_otds;
    v_row := jsonb_build_object('ticket_id', '101', 'title', 'Ticket One',
                                'priority', 'P1', 'ts', to_char(v_switch + interval '2 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.USOF'));
    SELECT properties INTO v_state FROM public.object_state(v_type, '101', v_row);
    IF v_state ->> 'title' <> 'Ticket' THEN
      RAISE EXCEPTION 'PROOF FAILED: under apply_user_edits the edit must win, and the title is "%"',
        v_state ->> 'title';
    END IF;
    RAISE NOTICE 'PROVED: apply_user_edits is unchanged — the edit still always wins';

    -- And the switch itself is stamped, which is what pre-existing edits are
    -- measured against.
    SELECT count(*) INTO v_n FROM public.object_type_datasources
     WHERE id = v_otds AND conflict_resolution_changed_at > v_switch;
    IF v_n <> 1 THEN RAISE EXCEPTION 'PROOF FAILED: switching the strategy did not restamp it'; END IF;
    RAISE NOTICE 'PROVED: changing the strategy stamps when it changed';

    RAISE EXCEPTION 'ZZ842_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ842_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz842';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
