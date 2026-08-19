-- Phase F2. A second list, asking a different question from the first.
--
-- ── WHY THIS IS NOT MORE ROWS IN ontology_violations() ─────────────────────
-- That function asks whether an object type is MALFORMED. Cleanup asks whether
-- one is probably DEAD and safe to remove:
--
--   "The tool aims to help Ontology editors determine the safety of deleting an
--    object type and provides a deprecation option which informs object type
--    users of its future removal."
--
-- A blank description is not a violation. Foundry draws the same line in its own
-- navigation: `cleanup-filters.png` shows `Health issues 1,939` and
-- `Cleanup 5,633` as separate sections with separate counts.
--
-- ── THE FLAGS, AND THE ONE THE PROSE FORGOT ────────────────────────────────
-- The page lists six and warns you that is not all of them — "The following
-- list of flags is aimed at answering common issues, but is not exhaustive:".
-- `cleanup-configuration-view.png` shows SEVEN toggles, and the extra one,
-- `No registered usage in 30 days`, appears in no sentence anywhere. It is also
-- the strongest signal in the tool.
--
-- Two of the seven are registered here and cannot be computed, each for its own
-- documented reason, which is the treatment `create_or_modify_object` and the
-- interface rule kinds already carry — expressible, listed, refused with a
-- reason, rather than silently absent:
--
--   * `phonograph_deindexed` — "Flag only applied to object types in Object
--     Storage v1. There is no equivalent check for Object Storage v2." We are
--     OSv2. Computing it would mean inventing the check the page says does not
--     exist.
--   * `no_registered_usage` — needs the Ontology metrics ledger that
--     `ontology-manager/view-usage` defines: reads and writes over 30 days,
--     where "one read represents one load request" and "any object type or link
--     type usage happening in Ontology Manager is not included". That ledger is
--     its own work, and in Foundry its own Control Panel toggle.
--
-- The metrics page also carries the hazard, and it is why this flag may never
-- default to computing zero: when the toggle is off you see "No usage for the
-- last 30 days" for everything. **No usage and no usage data must never be the
-- same answer**, or the flag proposes deleting the entire ontology.
--
-- ── PRIORITY IS THREE VALUES, AND ONLY A SCREENSHOT SAYS SO ────────────────
-- The prose says the queue is "sorted by the highest priority among the flags
-- that an object type triggers" and never gives the values. The configuration
-- screenshot shows a Priority dropdown on every flag reading High, Medium or
-- Low. So "highest" is a min() over an ordering, not a numeric rank.
--
-- ── CONFIGURATION IS (MODE, OVERRIDES), NOT A ROW PER FLAG ─────────────────
-- This is forced by one sentence:
--
--   "Note that if using a custom flag setup, new flags that get added in the
--    future will not be automatically turned on if they are turned on when
--    using the default set of flags."
--
-- Copying the defaults into rows would convert every user to Custom silently,
-- and a flag added later would reach nobody. So the default set stays a live
-- reference and overrides exist only in custom mode.
--
-- ── THE QUEUE IS STORED, NOT A VIEW ────────────────────────────────────────
-- "the tool may take time to find cleanup candidates based on the size of your
-- Ontology", "you will be prompted to recalculate the cleanup queue", and from
-- the screenshot, "Saving changes to flag settings will reset previous Cleanup
-- results". Foundry PROMPTS rather than recomputing silently, so the results
-- need a computed_at and a way to be invalidated.
--
-- ── AND STAGING IS ALREADY BUILT ───────────────────────────────────────────
-- "Deprecation and deletion are staged the same way as normal Ontology
-- modifications", and `cleanup-staging-example.png` is the same Review edits
-- modal as any other change. Phase D owns that. Nothing here writes an object
-- type; Snooze is the only state this migration adds.

BEGIN;

-- ── §1 the registry ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_priority_rank(p text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END
$fn$;

CREATE OR REPLACE FUNCTION public.cleanup_flags()
RETURNS TABLE (flag text, priority text, default_on boolean, parameter text,
               computable boolean, note text)
LANGUAGE sql IMMUTABLE AS $fn$
  VALUES
    ('no_registered_usage', 'high', true, 'days', false,
     'Reads and writes over the window, per ontology-manager/view-usage. Not computable: there is no Ontology metrics ledger yet, and until there is, no usage data must not be reported as no usage.'),
    ('past_deprecation_date', 'high', true, NULL, true,
     'Object type currently has the deprecated status and the deprecation date field is in the past.'),
    ('trashed_datasource', 'high', true, NULL, true,
     'Any datasource backing this object type has been trashed in Compass.'),
    ('phonograph_deindexed', 'high', true, NULL, false,
     'Not computable, and deliberately: the page applies it only to Object Storage v1 and states there is no equivalent check for v2. We are v2.'),
    ('datasource_not_updated', 'medium', true, 'days', true,
     'The last modification to the backing datasource is older than the window.'),
    ('description_missing', 'low', false, NULL, true,
     'The object type has a blank description. Does not check properties.'),
    ('display_name_regex', 'low', false, 'regex', true,
     'The display name matches the pattern. Foundry supports ECMA regex; ours is POSIX, so a pattern using ECMA-only syntax will not behave identically.')
$fn$;
REVOKE ALL ON FUNCTION public.cleanup_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_flags() TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_flag_names()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT ARRAY['no_registered_usage','past_deprecation_date','trashed_datasource',
               'phonograph_deindexed','datasource_not_updated',
               'description_missing','display_name_regex']
$fn$;

-- The published defaults for the two parameterised flags.
CREATE OR REPLACE FUNCTION public.cleanup_flag_default_days(p_flag text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $fn$
  -- "No registered usage in 30 days" · "Datasource not updated in 90 days"
  SELECT CASE p_flag WHEN 'no_registered_usage' THEN 30
                     WHEN 'datasource_not_updated' THEN 90 END
$fn$;

-- ── §2 per-user configuration ─────────────────────────────────────────────
CREATE TABLE public.cleanup_configurations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ontology_id uuid NOT NULL REFERENCES public.ontologies(id) ON DELETE CASCADE,
  -- "a choice of using either the default set or custom flags"
  mode        text NOT NULL DEFAULT 'default' CHECK (mode IN ('default', 'custom')),
  -- NULL means the queue has never been computed, or was reset by a settings
  -- change. Foundry prompts to recalculate rather than doing it silently.
  computed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ontology_id)
);
CREATE INDEX cleanup_configurations_ontology ON public.cleanup_configurations (ontology_id);
COMMENT ON TABLE public.cleanup_configurations IS
  'One per user per ontology. Mode is default or custom, never a copy of the defaults — a flag added later must reach everyone still on the default set.';

CREATE TABLE public.cleanup_flag_overrides (
  configuration_id uuid NOT NULL REFERENCES public.cleanup_configurations(id) ON DELETE CASCADE,
  flag         text NOT NULL CHECK (flag = ANY (public.cleanup_flag_names())),
  enabled      boolean NOT NULL,
  priority     text CHECK (priority IS NULL OR priority IN ('high','medium','low')),
  param_days   integer CHECK (param_days IS NULL OR param_days > 0),
  param_regex  text,
  PRIMARY KEY (configuration_id, flag)
);
COMMENT ON TABLE public.cleanup_flag_overrides IS
  'Departures from the published defaults, in custom mode only. Absence means "as published", which is what keeps a future flag reaching a custom user at its own default rather than off.';

-- ── §3 snooze, the one new state ──────────────────────────────────────────
-- "Snoozing is an action that will affect only the user that performs it."
CREATE TABLE public.cleanup_snoozes (
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  until          timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, object_type_id)
);
CREATE INDEX cleanup_snoozes_object_type ON public.cleanup_snoozes (object_type_id);
COMMENT ON TABLE public.cleanup_snoozes IS
  'Hides an object type from ONE user''s cleanup queue until a time they choose. Never global — the page is explicit that snoozing affects only the user who does it.';

-- ── §4 the stored queue ───────────────────────────────────────────────────
CREATE TABLE public.cleanup_candidates (
  configuration_id uuid NOT NULL REFERENCES public.cleanup_configurations(id) ON DELETE CASCADE,
  object_type_id   uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  flags            text[] NOT NULL CHECK (cardinality(flags) > 0),
  priority         text NOT NULL CHECK (priority IN ('high','medium','low')),
  PRIMARY KEY (configuration_id, object_type_id)
);
CREATE INDEX cleanup_candidates_object_type ON public.cleanup_candidates (object_type_id);
COMMENT ON TABLE public.cleanup_candidates IS
  'The materialised queue. Stored rather than a view because the page says finding candidates takes time and prompts to recalculate; priority is the highest among the flags a type triggers.';

-- ── §5 effective settings: the registry, overridden only in custom mode ───
CREATE OR REPLACE FUNCTION public.cleanup_effective_flags(p_config uuid)
RETURNS TABLE (flag text, enabled boolean, priority text, days integer,
               regex text, computable boolean)
LANGUAGE sql STABLE AS $fn$
  SELECT f.flag,
         CASE WHEN c.mode = 'custom' THEN coalesce(o.enabled, f.default_on)
              ELSE f.default_on END,
         CASE WHEN c.mode = 'custom' THEN coalesce(o.priority, f.priority)
              ELSE f.priority END,
         CASE WHEN c.mode = 'custom' THEN coalesce(o.param_days, public.cleanup_flag_default_days(f.flag))
              ELSE public.cleanup_flag_default_days(f.flag) END,
         CASE WHEN c.mode = 'custom' THEN coalesce(o.param_regex, '\[test|deprecated\]')
              ELSE '\[test|deprecated\]' END,
         f.computable
    FROM public.cleanup_configurations c
   CROSS JOIN public.cleanup_flags() f
    LEFT JOIN public.cleanup_flag_overrides o
      ON o.configuration_id = c.id AND o.flag = f.flag
   WHERE c.id = p_config
$fn$;

-- ── §6 which flags an object type trips ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.object_type_cleanup_flags(p_object_type uuid, p_config uuid)
RETURNS text[] LANGUAGE plpgsql STABLE AS $fn$
DECLARE t record; e record; hits text[] := '{}';
BEGIN
  SELECT * INTO t FROM public.object_types WHERE id = p_object_type;
  IF t.id IS NULL THEN RETURN hits; END IF;

  FOR e IN SELECT * FROM public.cleanup_effective_flags(p_config)
            WHERE enabled AND computable LOOP
    CASE e.flag
      -- "Object type currently has the deprecated status and the deprecation
      --  date field is in the past."
      WHEN 'past_deprecation_date' THEN
        IF t.status = 'deprecated' AND t.deprecation_deadline IS NOT NULL
           AND t.deprecation_deadline < current_date THEN
          hits := hits || e.flag;
        END IF;

      -- "Any datasource (whether dataset, restricted view, or other) backing
      --  this object type has been trashed in Compass."
      WHEN 'trashed_datasource' THEN
        IF EXISTS (SELECT 1 FROM public.object_type_datasources ds
                     JOIN public.datasets d ON d.id = ds.dataset_id
                    WHERE ds.object_type_id = t.id AND d.trashed_at IS NOT NULL) THEN
          hits := hits || e.flag;
        END IF;

      -- "Checks with Compass the time of the last modification to the backing
      --  datasource."
      WHEN 'datasource_not_updated' THEN
        IF EXISTS (SELECT 1 FROM public.object_type_datasources ds
                     JOIN public.datasets d ON d.id = ds.dataset_id
                    WHERE ds.object_type_id = t.id
                      AND d.updated_at < now() - make_interval(days => e.days)) THEN
          hits := hits || e.flag;
        END IF;

      -- "The object type has a blank description. Does not check for
      --  descriptions on all properties of the object type."
      WHEN 'description_missing' THEN
        IF t.description IS NULL OR btrim(t.description) = '' THEN
          hits := hits || e.flag;
        END IF;

      WHEN 'display_name_regex' THEN
        IF e.regex IS NOT NULL AND t.label ~ e.regex THEN
          hits := hits || e.flag;
        END IF;

      ELSE NULL;   -- a computable flag with no arm here would be a bug, not a skip
    END CASE;
  END LOOP;
  RETURN hits;
END $fn$;

-- ── §7 recalculating, which is what Start cleanup does ───────────────────
CREATE OR REPLACE FUNCTION public.run_cleanup(p_config uuid)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE c record; t record; hits text[]; n int := 0;
BEGIN
  SELECT * INTO c FROM public.cleanup_configurations WHERE id = p_config;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Ontology:CleanupConfigurationNotFound — % is not a configuration you can run', p_config;
  END IF;

  DELETE FROM public.cleanup_candidates WHERE configuration_id = p_config;

  FOR t IN SELECT id FROM public.object_types WHERE ontology_id = c.ontology_id LOOP
    -- "Once you act on an object type in your queue, it disappears from the
    --  queue" — a live snooze keeps it out.
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.cleanup_snoozes s
                           WHERE s.user_id = c.user_id AND s.object_type_id = t.id
                             AND s.until > now());
    hits := public.object_type_cleanup_flags(t.id, p_config);
    CONTINUE WHEN cardinality(hits) = 0;

    INSERT INTO public.cleanup_candidates (configuration_id, object_type_id, flags, priority)
    VALUES (p_config, t.id, hits,
            -- "sorted by the highest priority among the flags that an object
            --  type triggers" — highest is the LOWEST rank.
            (SELECT e.priority FROM public.cleanup_effective_flags(p_config) e
              WHERE e.flag = ANY (hits)
              ORDER BY public.cleanup_priority_rank(e.priority) LIMIT 1));
    n := n + 1;
  END LOOP;

  UPDATE public.cleanup_configurations SET computed_at = now() WHERE id = p_config;
  RETURN n;
END $fn$;
REVOKE ALL ON FUNCTION public.run_cleanup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_cleanup(uuid) TO authenticated;

-- ── §8 a settings change resets the results ──────────────────────────────
-- Two functions rather than one branching on TG_TABLE_NAME: plpgsql resolves a
-- record's fields at runtime whichever branch is taken, so a single function
-- naming both `NEW.configuration_id` and `NEW.id` fails on whichever table
-- lacks the other's column.
CREATE OR REPLACE FUNCTION public.reset_cleanup_results(p_config uuid)
RETURNS void LANGUAGE sql AS $fn$
  DELETE FROM public.cleanup_candidates WHERE configuration_id = p_config;
  UPDATE public.cleanup_configurations SET computed_at = NULL WHERE id = p_config;
$fn$;

CREATE OR REPLACE FUNCTION public.reset_cleanup_on_override()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM public.reset_cleanup_results(coalesce(NEW.configuration_id, OLD.configuration_id));
  RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION public.reset_cleanup_on_mode()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM public.reset_cleanup_results(NEW.id);
  RETURN NULL;
END $fn$;

CREATE TRIGGER cleanup_overrides_reset_results
  AFTER INSERT OR UPDATE OR DELETE ON public.cleanup_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION public.reset_cleanup_on_override();
CREATE TRIGGER cleanup_mode_resets_results
  AFTER UPDATE OF mode ON public.cleanup_configurations
  FOR EACH ROW WHEN (OLD.mode IS DISTINCT FROM NEW.mode)
  EXECUTE FUNCTION public.reset_cleanup_on_mode();

-- ── §9 access: every one of these is the acting user's own ───────────────
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cleanup_configurations','cleanup_snoozes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "own %1$s" ON public.%1$I
      FOR ALL USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()))$p$, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['cleanup_flag_overrides','cleanup_candidates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "own %1$s" ON public.%1$I
      FOR ALL USING (EXISTS (SELECT 1 FROM public.cleanup_configurations c
        WHERE c.id = %1$I.configuration_id AND c.user_id = (select auth.uid())))
      WITH CHECK (EXISTS (SELECT 1 FROM public.cleanup_configurations c
        WHERE c.id = %1$I.configuration_id AND c.user_id = (select auth.uid())))$p$, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $do$;

-- ── assertions, which run the queue and watch every arm ──────────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; usr uuid; ds uuid; br uuid;
  cfg uuid; dead uuid; blank uuid; trashed uuid; stale uuid; fine uuid;
  n int; hits text[]; pri text; ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe578') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe578') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe578', 'Probe578') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe578@beacon.test') RETURNING id INTO usr;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe578', 'Probe578', false) RETURNING id INTO ont;

    -- Seven flags, five computable, two refused with a reason.
    SELECT count(*) INTO n FROM public.cleanup_flags();
    IF n <> 7 THEN RAISE EXCEPTION 'expected seven flags, found %', n; END IF;
    SELECT count(*) INTO n FROM public.cleanup_flags() WHERE NOT computable;
    IF n <> 2 THEN RAISE EXCEPTION 'expected two uncomputable flags, found %', n; END IF;
    SELECT count(*) INTO n FROM public.cleanup_flags()
     WHERE NOT computable AND (note IS NULL OR length(note) < 40);
    IF n <> 0 THEN RAISE EXCEPTION 'an uncomputable flag gives no reason'; END IF;
    -- Two ship off, and they are the two the filter panel does not list.
    SELECT count(*) INTO n FROM public.cleanup_flags() WHERE NOT default_on;
    IF n <> 2 THEN RAISE EXCEPTION 'expected two flags off by default, found %', n; END IF;

    INSERT INTO public.cleanup_configurations (user_id, ontology_id) VALUES (usr, ont)
      RETURNING id INTO cfg;

    -- Default mode: five enabled, and description_missing is not one of them.
    SELECT count(*) INTO n FROM public.cleanup_effective_flags(cfg) WHERE enabled;
    IF n <> 5 THEN RAISE EXCEPTION 'the default set enabled % flags, expected 5', n; END IF;
    IF (SELECT enabled FROM public.cleanup_effective_flags(cfg) WHERE flag = 'description_missing') THEN
      RAISE EXCEPTION 'description_missing is on by default, and the screenshot says otherwise';
    END IF;
    IF (SELECT days FROM public.cleanup_effective_flags(cfg) WHERE flag = 'datasource_not_updated') <> 90 THEN
      RAISE EXCEPTION 'the published 90-day default did not come through';
    END IF;

    -- ── the object types, one per computable flag ────────────────────────
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, description,
                                     status, deprecation_reason, deprecation_deadline)
      VALUES (ont, proj, 'Dead', 'Dead', 'has one', 'deprecated', 'gone', current_date - 1)
      RETURNING id INTO dead;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, description)
      VALUES (ont, proj, 'Blank', '[test] Blank', '') RETURNING id INTO blank;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, description)
      VALUES (ont, proj, 'Fine', 'Fine', 'described') RETURNING id INTO fine;

    -- A trashed datasource, and a stale one.
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, description)
      VALUES (ont, proj, 'Trashed', 'Trashed', 'described') RETURNING id INTO trashed;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name, trashed_at)
      VALUES (org, proj, 'gone578', 'Gone', now()) RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (trashed, ds, br);

    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, description)
      VALUES (ont, proj, 'Stale', 'Stale', 'described') RETURNING id INTO stale;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (org, proj, 'old578', 'Old') RETURNING id INTO ds;
    UPDATE public.datasets SET updated_at = now() - interval '200 days' WHERE id = ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (stale, ds, br);

    -- ── each arm, one at a time ──────────────────────────────────────────
    hits := public.object_type_cleanup_flags(dead, cfg);
    IF NOT ('past_deprecation_date' = ANY (hits)) THEN
      RAISE EXCEPTION 'a past deprecation deadline was not flagged';
    END IF;
    hits := public.object_type_cleanup_flags(trashed, cfg);
    IF NOT ('trashed_datasource' = ANY (hits)) THEN
      RAISE EXCEPTION 'a trashed datasource was not flagged';
    END IF;
    hits := public.object_type_cleanup_flags(stale, cfg);
    IF NOT ('datasource_not_updated' = ANY (hits)) THEN
      RAISE EXCEPTION 'a 200-day-old datasource was not flagged against a 90-day window';
    END IF;
    hits := public.object_type_cleanup_flags(fine, cfg);
    IF cardinality(hits) <> 0 THEN
      RAISE EXCEPTION 'a healthy object type was flagged: %', hits;
    END IF;

    -- The two off-by-default flags do NOT fire in default mode, even though
    -- `Blank` trips both.
    hits := public.object_type_cleanup_flags(blank, cfg);
    IF cardinality(hits) <> 0 THEN
      RAISE EXCEPTION 'a flag that ships off still fired: %', hits;
    END IF;

    -- ── the queue ────────────────────────────────────────────────────────
    n := public.run_cleanup(cfg);
    IF n <> 3 THEN RAISE EXCEPTION 'expected 3 candidates, got %', n; END IF;
    IF (SELECT computed_at FROM public.cleanup_configurations WHERE id = cfg) IS NULL THEN
      RAISE EXCEPTION 'running the queue did not stamp computed_at';
    END IF;

    -- Priority is the HIGHEST among the flags a type trips: stale trips only a
    -- medium, dead trips a high.
    SELECT priority INTO pri FROM public.cleanup_candidates
     WHERE configuration_id = cfg AND object_type_id = stale;
    IF pri <> 'medium' THEN RAISE EXCEPTION 'stale got priority %, expected medium', pri; END IF;
    SELECT priority INTO pri FROM public.cleanup_candidates
     WHERE configuration_id = cfg AND object_type_id = dead;
    IF pri <> 'high' THEN RAISE EXCEPTION 'dead got priority %, expected high', pri; END IF;

    -- ── custom mode turns one on, and the results reset ──────────────────
    UPDATE public.cleanup_configurations SET mode = 'custom' WHERE id = cfg;
    IF (SELECT computed_at FROM public.cleanup_configurations WHERE id = cfg) IS NOT NULL THEN
      RAISE EXCEPTION 'changing mode did not reset the results';
    END IF;
    SELECT count(*) INTO n FROM public.cleanup_candidates WHERE configuration_id = cfg;
    IF n <> 0 THEN RAISE EXCEPTION 'changing mode left % stale candidate(s)', n; END IF;

    -- Absence of an override still means "as published" — this is what keeps a
    -- future flag reaching a custom user.
    SELECT count(*) INTO n FROM public.cleanup_effective_flags(cfg) WHERE enabled;
    IF n <> 5 THEN RAISE EXCEPTION 'custom mode with no overrides changed the set'; END IF;

    INSERT INTO public.cleanup_flag_overrides (configuration_id, flag, enabled, param_regex)
      VALUES (cfg, 'display_name_regex', true, '\[test\]');
    hits := public.object_type_cleanup_flags(blank, cfg);
    IF NOT ('display_name_regex' = ANY (hits)) THEN
      RAISE EXCEPTION 'an override did not enable the regex flag: %', hits;
    END IF;
    IF 'description_missing' = ANY (hits) THEN
      RAISE EXCEPTION 'enabling one flag enabled another';
    END IF;

    -- ── snooze keeps a type out of one user's queue ──────────────────────
    n := public.run_cleanup(cfg);
    INSERT INTO public.cleanup_snoozes (user_id, object_type_id, until)
      VALUES (usr, dead, now() + interval '7 days');
    IF public.run_cleanup(cfg) <> n - 1 THEN
      RAISE EXCEPTION 'a snoozed object type stayed in the queue';
    END IF;
    -- And an expired snooze does not.
    UPDATE public.cleanup_snoozes SET until = now() - interval '1 day'
     WHERE user_id = usr AND object_type_id = dead;
    IF public.run_cleanup(cfg) <> n THEN
      RAISE EXCEPTION 'an expired snooze still hid an object type';
    END IF;

    RAISE EXCEPTION 'probe578:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe578:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe578';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '578: cleanup asks whether an object type is dead';
END $do$;

COMMIT;
