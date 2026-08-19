-- The ledger 578 named, and the reason it could not guess at it.
--
-- ── THE FOUR TERMS, AND WHAT EACH DECIDES ─────────────────────────────────
-- `ontology-manager/view-usage` defines all of them:
--
--   "Interactions: The total number of reads and writes on objects of this type
--    over the last 30 days."
--   "Active users: The number of unique user IDs that triggered the reads and
--    writes recorded over the last 30 days."
--
-- and two sentences settle the schema before a table is drawn:
--
--   "Note that one read represents one load request … Many objects loaded or
--    aggregated at once will only be recorded as a single read."
--   "Also note that any object type or link type usage happening in Ontology
--    Manager is not included."
--
-- **A read is a REQUEST.** Counting rows returned would be a different number
-- from Foundry's for identical traffic. And **the tool's own traffic does not
-- count**, which is why recording is an explicit call rather than a trigger: a
-- trigger cannot tell who is asking.
--
-- ── THE GRAIN, WHICH THE USAGE TAB DRAWS ──────────────────────────────────
-- `oma-user-interface-usage-tab.png` shows four displays — a daily Reads &
-- Writes chart, a daily Active users chart, `Application type (22)` broken down
-- as reads/writes per application, and an aggregate panel reading
-- `Interactions 8772 · Reads 8770 · Writes 2 · Active users 89`. Every one of
-- them is an aggregate of
--
--   (resource, day, application, user) → reads, writes
--
-- Nothing displayed needs a finer grain and nothing needs a coarser one. That
-- panel also shows the traffic shape — **8,770 reads against 2 writes** — so a
-- per-object read ledger would be enormous and answer no extra question.
--
-- ── application IS FREE TEXT, AND THAT IS A DECISION ──────────────────────
-- Not for want of a vocabulary. `apps-portal.png` draws the closed half:
-- `Platform apps 40`, in six categories that sum to exactly 40. But the portal
-- shows `All apps 75` — the other 35 are **promoted apps built by customers**,
-- "promoted applications trusted by administrators", grouped into collections
-- their organisations name. A CHECK over a fixed list would refuse a real
-- caller the first time someone promotes an app.
--
-- The usage list also mixes cased product names with a lowercase `actions`, so
-- what is recorded is a service identifier the caller supplies.
--
-- ── AND THE ONE THAT MAKES 578's FLAG SAFE ───────────────────────────────
--   "If you see “No usage for the last 30 days” in the usage graph when you
--    would expect to see usage statistics, then it’s possible that internal
--    tables may not have been configured."
--
-- Metrics are opt-in, admin-only, and take up to an hour to take effect. So
-- **OFF IS NOT ZERO**: `no_registered_usage` may only be computed where metrics
-- have been on for the whole window. `ontology_usage_window_covered()` is that
-- predicate, and without it a cleanup queue proposes deleting every object type
-- in an ontology that simply never switched metrics on.

BEGIN;

-- ── §1 the switch, per ontology ───────────────────────────────────────────
ALTER TABLE public.ontologies
  ADD COLUMN metrics_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN metrics_enabled_at timestamptz;

COMMENT ON COLUMN public.ontologies.metrics_enabled IS
  'The Ontology metrics toggle. Off by default, as Foundry ships it — and off is not zero: nothing may read an absence of rows as an absence of usage unless metrics covered the whole window.';
COMMENT ON COLUMN public.ontologies.metrics_enabled_at IS
  'When metrics were last switched on. A window is only covered if this is older than the window''s start, because rows before it were never recorded.';

CREATE OR REPLACE FUNCTION public.set_ontology_metrics(p_ontology uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  -- "This toggle can only be enabled or disabled by Ontology administrators."
  IF NOT (public.auth_role() = ANY (ARRAY['owner','admin'])) THEN
    RAISE EXCEPTION 'Ontology:MetricsToggleIsAdministrative — only an owner or admin may change Ontology metrics';
  END IF;
  UPDATE public.ontologies
     SET metrics_enabled = p_enabled,
         -- Turning it on restarts the covered window; turning it off keeps the
         -- stamp, because the rows already recorded are still real.
         metrics_enabled_at = CASE WHEN p_enabled AND NOT metrics_enabled
                                   THEN now() ELSE metrics_enabled_at END
   WHERE id = p_ontology;
END $fn$;
REVOKE ALL ON FUNCTION public.set_ontology_metrics(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ontology_metrics(uuid, boolean) TO authenticated;

-- ── §2 the rollup ─────────────────────────────────────────────────────────
CREATE TABLE public.ontology_usage (
  -- "usage metrics for object types and link types" — two columns, exactly one
  -- set, as action_type_rule_properties does. Never a `kind` discriminator.
  object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  link_type_id   uuid REFERENCES public.link_types(id) ON DELETE CASCADE,
  day            date NOT NULL,
  application    text NOT NULL CHECK (length(btrim(application)) > 0),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reads          integer NOT NULL DEFAULT 0 CHECK (reads >= 0),
  writes         integer NOT NULL DEFAULT 0 CHECK (writes >= 0),
  last_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(object_type_id, link_type_id) = 1),
  CHECK (reads > 0 OR writes > 0)
);
CREATE UNIQUE INDEX ontology_usage_grain ON public.ontology_usage
  (coalesce(object_type_id, link_type_id), day, application, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX ontology_usage_object_type ON public.ontology_usage (object_type_id, day);
CREATE INDEX ontology_usage_link_type ON public.ontology_usage (link_type_id, day);
CREATE INDEX ontology_usage_user ON public.ontology_usage (user_id);

COMMENT ON TABLE public.ontology_usage IS
  'Daily rollup of reads and writes per resource, application and user — the grain every Usage tab display aggregates from. A read is one load REQUEST, not one object: 8,770 reads against 2 writes is the documented traffic shape.';

-- ── §3 recording, which the caller does explicitly ───────────────────────
CREATE OR REPLACE FUNCTION public.record_ontology_usage(
  p_object_type uuid, p_link_type uuid, p_application text,
  p_reads integer DEFAULT 0, p_writes integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE ont uuid;
BEGIN
  IF num_nonnulls(p_object_type, p_link_type) <> 1 THEN
    RAISE EXCEPTION 'Ontology:UsageNamesOneResource — record usage against an object type or a link type, not both';
  END IF;
  -- "any object type or link type usage happening in Ontology Manager is not
  --  included" — the caller names itself, and the tool names itself too.
  IF p_application = 'ontology-manager' THEN RETURN; END IF;
  IF coalesce(p_reads, 0) + coalesce(p_writes, 0) = 0 THEN RETURN; END IF;

  SELECT ontology_id INTO ont FROM public.object_types WHERE id = p_object_type
   UNION ALL SELECT ontology_id FROM public.link_types WHERE id = p_link_type;
  IF NOT (SELECT metrics_enabled FROM public.ontologies WHERE id = ont) THEN
    RETURN;   -- the toggle is off; nothing is recorded, and nothing pretends to be
  END IF;

  INSERT INTO public.ontology_usage AS u
    (object_type_id, link_type_id, day, application, user_id, reads, writes)
  VALUES (p_object_type, p_link_type, current_date, p_application, auth.uid(),
          coalesce(p_reads, 0), coalesce(p_writes, 0))
  ON CONFLICT (coalesce(object_type_id, link_type_id), day, application,
               coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET reads = u.reads + excluded.reads,
                writes = u.writes + excluded.writes,
                last_at = now();
END $fn$;
REVOKE ALL ON FUNCTION public.record_ontology_usage(uuid, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ontology_usage(uuid, uuid, text, integer, integer) TO authenticated;

-- ── §4 the derived numbers, never stored ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.ontology_usage_summary(p_object_type uuid, p_days integer DEFAULT 30)
RETURNS TABLE (interactions bigint, reads bigint, writes bigint,
               active_users bigint, last_interaction timestamptz)
LANGUAGE sql STABLE AS $fn$
  SELECT coalesce(sum(u.reads + u.writes), 0), coalesce(sum(u.reads), 0),
         coalesce(sum(u.writes), 0), count(DISTINCT u.user_id), max(u.last_at)
    FROM public.ontology_usage u
   WHERE u.object_type_id = p_object_type
     AND u.day > current_date - p_days
$fn$;
COMMENT ON FUNCTION public.ontology_usage_summary(uuid, integer) IS
  'Interactions, Reads, Writes, Active users and Last interaction over the window. All derived — storing them would create two numbers that can disagree.';

CREATE OR REPLACE FUNCTION public.ontology_usage_by_application(p_object_type uuid, p_days integer DEFAULT 30)
RETURNS TABLE (application text, reads bigint, writes bigint)
LANGUAGE sql STABLE AS $fn$
  SELECT u.application, sum(u.reads), sum(u.writes)
    FROM public.ontology_usage u
   WHERE u.object_type_id = p_object_type AND u.day > current_date - p_days
   GROUP BY u.application ORDER BY sum(u.reads) + sum(u.writes) DESC
$fn$;

-- ── §5 the predicate that makes 578's flag safe ──────────────────────────
CREATE OR REPLACE FUNCTION public.ontology_usage_window_covered(p_ontology uuid, p_days integer)
RETURNS boolean LANGUAGE sql STABLE AS $fn$
  SELECT o.metrics_enabled
     AND o.metrics_enabled_at IS NOT NULL
     AND o.metrics_enabled_at <= now() - make_interval(days => p_days)
    FROM public.ontologies o WHERE o.id = p_ontology
$fn$;
COMMENT ON FUNCTION public.ontology_usage_window_covered(uuid, integer) IS
  'Were metrics on for the WHOLE window? Only then may an absence of usage rows be read as an absence of usage. Off is not zero.';

-- ── §6 no_registered_usage becomes computable, where it is safe ──────────
CREATE OR REPLACE FUNCTION public.cleanup_flags()
RETURNS TABLE (flag text, priority text, default_on boolean, parameter text,
               computable boolean, note text)
LANGUAGE sql IMMUTABLE AS $fn$
  VALUES
    ('no_registered_usage', 'high', true, 'days', true,
     'Reads and writes over the window, per ontology-manager/view-usage. Computed only where Ontology metrics covered the whole window — an ontology that never switched them on reports no data, never no usage.'),
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

CREATE OR REPLACE FUNCTION public.object_type_cleanup_flags(p_object_type uuid, p_config uuid)
RETURNS text[] LANGUAGE plpgsql STABLE AS $fn$
DECLARE t record; e record; hits text[] := '{}';
BEGIN
  SELECT * INTO t FROM public.object_types WHERE id = p_object_type;
  IF t.id IS NULL THEN RETURN hits; END IF;

  FOR e IN SELECT * FROM public.cleanup_effective_flags(p_config)
            WHERE enabled AND computable LOOP
    CASE e.flag
      -- The flag 578 could not compute. It stays silent unless metrics were on
      -- for the whole window, because no data is not no usage.
      WHEN 'no_registered_usage' THEN
        IF public.ontology_usage_window_covered(t.ontology_id, e.days)
           AND NOT EXISTS (SELECT 1 FROM public.ontology_usage u
                            WHERE u.object_type_id = t.id
                              AND u.day > current_date - e.days) THEN
          hits := hits || e.flag;
        END IF;

      WHEN 'past_deprecation_date' THEN
        IF t.status = 'deprecated' AND t.deprecation_deadline IS NOT NULL
           AND t.deprecation_deadline < current_date THEN
          hits := hits || e.flag;
        END IF;

      WHEN 'trashed_datasource' THEN
        IF EXISTS (SELECT 1 FROM public.object_type_datasources ds
                     JOIN public.datasets d ON d.id = ds.dataset_id
                    WHERE ds.object_type_id = t.id AND d.trashed_at IS NOT NULL) THEN
          hits := hits || e.flag;
        END IF;

      WHEN 'datasource_not_updated' THEN
        IF EXISTS (SELECT 1 FROM public.object_type_datasources ds
                     JOIN public.datasets d ON d.id = ds.dataset_id
                    WHERE ds.object_type_id = t.id
                      AND d.updated_at < now() - make_interval(days => e.days)) THEN
          hits := hits || e.flag;
        END IF;

      WHEN 'description_missing' THEN
        IF t.description IS NULL OR btrim(t.description) = '' THEN
          hits := hits || e.flag;
        END IF;

      WHEN 'display_name_regex' THEN
        IF e.regex IS NOT NULL AND t.label ~ e.regex THEN
          hits := hits || e.flag;
        END IF;

      ELSE NULL;
    END CASE;
  END LOOP;
  RETURN hits;
END $fn$;

-- ── §7 access ────────────────────────────────────────────────────────────
ALTER TABLE public.ontology_usage ENABLE ROW LEVEL SECURITY;
-- "the Usage tab will be accessible by users of all organizations that have the
--  Ontology metrics turned on" — reading is scoped to the ontology, and the
--  toggle gates it.
CREATE POLICY "read usage where metrics are on" ON public.ontology_usage
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t JOIN public.ontologies o ON o.id = t.ontology_id
     WHERE t.id = ontology_usage.object_type_id AND o.metrics_enabled
       AND (select public.auth_in_ontology(t.ontology_id)))
    OR EXISTS (
    SELECT 1 FROM public.link_types l JOIN public.ontologies o ON o.id = l.ontology_id
     WHERE l.id = ontology_usage.link_type_id AND o.metrics_enabled
       AND (select public.auth_in_ontology(l.ontology_id))));
GRANT SELECT ON public.ontology_usage TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; usr uuid; cfg uuid;
  ot uuid; quiet uuid; n int; ok boolean; s record;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe579') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe579') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe579', 'Probe579') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe579@beacon.test') RETURNING id INTO usr;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe579', 'Probe579', false) RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, description)
      VALUES (ont, proj, 'Aircraft', 'Aircraft', 'described') RETURNING id INTO ot;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label, description)
      VALUES (ont, proj, 'Quiet', 'Quiet', 'described') RETURNING id INTO quiet;

    -- Metrics ship OFF, and recording is a no-op until they are on.
    IF (SELECT metrics_enabled FROM public.ontologies WHERE id = ont) THEN
      RAISE EXCEPTION 'metrics defaulted ON';
    END IF;
    PERFORM public.record_ontology_usage(ot, NULL, 'quiver', 1, 0);
    SELECT count(*) INTO n FROM public.ontology_usage WHERE object_type_id = ot;
    IF n <> 0 THEN RAISE EXCEPTION 'usage was recorded while the toggle was off'; END IF;

    UPDATE public.ontologies SET metrics_enabled = true,
           metrics_enabled_at = now() - interval '90 days' WHERE id = ont;

    -- A read is one request, and repeat requests accumulate at the grain.
    PERFORM public.record_ontology_usage(ot, NULL, 'quiver', 1, 0);
    PERFORM public.record_ontology_usage(ot, NULL, 'quiver', 1, 0);
    PERFORM public.record_ontology_usage(ot, NULL, 'actions', 0, 1);
    SELECT count(*) INTO n FROM public.ontology_usage WHERE object_type_id = ot;
    IF n <> 2 THEN RAISE EXCEPTION 'expected two grain rows, found %', n; END IF;

    SELECT * INTO s FROM public.ontology_usage_summary(ot, 30);
    IF s.reads <> 2 OR s.writes <> 1 OR s.interactions <> 3 THEN
      RAISE EXCEPTION 'summary read %/%/% ', s.reads, s.writes, s.interactions;
    END IF;
    IF s.last_interaction IS NULL THEN RAISE EXCEPTION 'no last interaction'; END IF;

    SELECT count(*) INTO n FROM public.ontology_usage_by_application(ot, 30);
    IF n <> 2 THEN RAISE EXCEPTION 'expected two applications, found %', n; END IF;

    -- Ontology Manager's own traffic is not counted.
    PERFORM public.record_ontology_usage(ot, NULL, 'ontology-manager', 99, 0);
    SELECT reads INTO n FROM public.ontology_usage_summary(ot, 30);
    IF n <> 2 THEN RAISE EXCEPTION 'Ontology Manager traffic was counted'; END IF;

    -- A resource is one or the other.
    ok := false;
    BEGIN
      PERFORM public.record_ontology_usage(ot, ot, 'quiver', 1, 0);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%UsageNamesOneResource%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'usage named two resources'; END IF;

    -- ── and the flag, which is the whole point ──────────────────────────
    INSERT INTO public.cleanup_configurations (user_id, ontology_id) VALUES (usr, ont)
      RETURNING id INTO cfg;

    IF NOT public.ontology_usage_window_covered(ont, 30) THEN
      RAISE EXCEPTION 'a 90-day-old switch did not cover a 30-day window';
    END IF;
    -- Aircraft has usage; Quiet does not.
    IF 'no_registered_usage' = ANY (public.object_type_cleanup_flags(ot, cfg)) THEN
      RAISE EXCEPTION 'an object type with reads was flagged unused';
    END IF;
    IF NOT ('no_registered_usage' = ANY (public.object_type_cleanup_flags(quiet, cfg))) THEN
      RAISE EXCEPTION 'an object type with no usage was not flagged';
    END IF;

    -- THE ONE THAT MATTERS: switch metrics on just now, and NOTHING is flagged,
    -- because the window is no longer covered.
    UPDATE public.ontologies SET metrics_enabled_at = now() WHERE id = ont;
    IF public.ontology_usage_window_covered(ont, 30) THEN
      RAISE EXCEPTION 'a switch flipped today covered a 30-day window';
    END IF;
    IF 'no_registered_usage' = ANY (public.object_type_cleanup_flags(quiet, cfg)) THEN
      RAISE EXCEPTION 'no usage DATA was reported as no usage — the whole hazard';
    END IF;

    -- And with metrics off entirely, likewise.
    UPDATE public.ontologies SET metrics_enabled = false WHERE id = ont;
    IF public.ontology_usage_window_covered(ont, 30) THEN
      RAISE EXCEPTION 'a disabled ontology reported a covered window';
    END IF;

    RAISE EXCEPTION 'probe579:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe579:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe579';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '579: usage is a request counted once';
END $do$;

COMMIT;
