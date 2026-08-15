-- Resolving "the latest version" of a function, the way the API publishes it.
--
-- F1 built versions as `major.minor.patch[-prerelease]` and resolved the
-- latest one exactly one way. The API publishes two, a flag, and a default
-- that changes with the mode:
--
--   "Gets a specific query type with the given API name. By default, this
--    returns the highest semantic version of the query, excluding pre-release
--    versions. To resolve the most recently published version instead,
--    including pre-release versions, set `latestVersionResolution` to
--    `PUBLISH_TIME`."
--
--   "`latestVersionResolution` · enum · one of `PUBLISH_TIME`,
--    `SEMANTIC_VERSION` — Controls how latest version is resolved when
--    `version` is omitted. Defaults to `SEMANTIC_VERSION`."
--
--   "`includePrerelease` · boolean — When resolving the latest version,
--    whether prerelease versions are considered. Defaults to `false`, except
--    when `latestVersionResolution` is `PUBLISH_TIME`. Not supported together
--    with `version`."
--
--   "`version` · string — The version of the given Function, written
--    `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional. Examples:
--    `1.2.3`, `1.2.3-rc1`."
--                       (api/functions-v2-resources/queries-get-query, and the
--                        same four fields on execute-query and streamingExecute)
--
-- What was already right: SEMANTIC_VERSION excluding prereleases is what
-- `function_latest_version` did, and that is the documented default. What was
-- missing is every other combination, and pinning a version at all.
--
-- ── A BUG THIS WOULD HAVE INTRODUCED ────────────────────────────────────────
-- Both callers format the version as `format('%s.%s.%s', major, minor, patch)`,
-- which drops the tag. It has never lied, because no prerelease could ever be
-- resolved — the moment `includePrerelease` works, `1.2.3-rc1` would report
-- itself as `1.2.3`, and a run would be attributed to a version it is not.
-- The format the page prints is now a function, and both callers use it.
--
-- ── WHAT IS INFERENCE ───────────────────────────────────────────────────────
-- The page gives the format and the two modes; it does not say how two
-- prereleases of the SAME `x.y.z` order against each other, and it does not
-- say what breaks a tie between two versions published in the same instant.
-- Both are marked below. The first follows semver's own rule closely enough
-- that `-rc10` beats `-rc9`, which plain text ordering gets wrong; the second
-- is the row id, so the answer is at least stable.
--
-- The `branch` parameter on execute-query — "When provided without `version`,
-- the latest version on this branch is used" — is NOT built. `function_versions`
-- has no branch, and inventing one here would be a shape rather than a
-- reading. Recorded as a question in DELIVERABLE-MAP.

-- ── the published format ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.function_version_string(
  p_major int, p_minor int, p_patch int, p_prerelease text DEFAULT NULL)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  -- "written `<major>.<minor>.<patch>-<tag>`, where `-<tag>` is optional"
  SELECT format('%s.%s.%s', p_major, p_minor, p_patch)
      || coalesce('-' || p_prerelease, '')
$$;
COMMENT ON FUNCTION public.function_version_string(int, int, int, text) IS
  'A function version as the API writes it: <major>.<minor>.<patch>-<tag>, the tag optional.';

-- INFERENCE: the page does not order two prereleases of the same version.
-- Each dot-separated identifier is left-padded so a numeric one compares by
-- magnitude rather than by first character — otherwise `rc9` outranks `rc10`.
-- Identifiers longer than 32 characters truncate, which no real tag reaches.
CREATE OR REPLACE FUNCTION public.semver_prerelease_key(p_prerelease text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_prerelease IS NULL THEN NULL ELSE
    (SELECT array_agg(lpad(e, 32, '0') ORDER BY ord)
       FROM unnest(string_to_array(p_prerelease, '.')) WITH ORDINALITY x(e, ord))
  END
$$;
COMMENT ON FUNCTION public.semver_prerelease_key(text) IS
  'A sortable key for a prerelease tag. INFERENCE: the documentation gives the tag format but no ordering between two prereleases of one version.';

-- ── the resolver ────────────────────────────────────────────────────────────
-- Dropped rather than replaced: adding parameters makes an overload, and the
-- old one-argument shape would stay callable with the old single behaviour.
DROP FUNCTION IF EXISTS public.function_latest_version(uuid);

CREATE OR REPLACE FUNCTION public.function_latest_version(
  p_function uuid,
  p_resolution text DEFAULT 'SEMANTIC_VERSION',
  p_include_prerelease boolean DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE pre boolean; v uuid;
BEGIN
  IF p_resolution NOT IN ('PUBLISH_TIME', 'SEMANTIC_VERSION') THEN
    RAISE EXCEPTION 'Functions:InvalidLatestVersionResolution — % is not PUBLISH_TIME or SEMANTIC_VERSION', p_resolution;
  END IF;
  -- "Defaults to `false`, except when `latestVersionResolution` is
  -- `PUBLISH_TIME`" — one line, and it is the whole rule.
  pre := coalesce(p_include_prerelease, p_resolution = 'PUBLISH_TIME');

  IF p_resolution = 'PUBLISH_TIME' THEN
    -- "the most recently published version". INFERENCE: the id breaks a tie
    -- between two published in the same instant, so the answer is stable.
    SELECT fv.id INTO v FROM public.function_versions fv
     WHERE fv.function_id = p_function AND (pre OR fv.prerelease IS NULL)
     ORDER BY fv.published_at DESC, fv.id DESC
     LIMIT 1;
  ELSE
    -- "the highest semantic version". A release outranks its own prereleases,
    -- which is why the NULL test sorts before the tag comparison.
    SELECT fv.id INTO v FROM public.function_versions fv
     WHERE fv.function_id = p_function AND (pre OR fv.prerelease IS NULL)
     ORDER BY fv.major DESC, fv.minor DESC, fv.patch DESC,
              (fv.prerelease IS NULL) DESC,
              public.semver_prerelease_key(fv.prerelease) DESC
     LIMIT 1;
  END IF;
  RETURN v;
END $$;
COMMENT ON FUNCTION public.function_latest_version(uuid, text, boolean) IS
  'The latest version of a function: the highest semantic version excluding prereleases by default, or the most recently published one including them when resolution is PUBLISH_TIME.';

-- ── the guard asked the same question a different way ──────────────────────
-- `guard_function_version` finds the version a release must follow by ordering
-- `..., (prerelease IS NULL) DESC, prerelease DESC` — plain text, so with
-- `2.0.0-rc9` and `2.0.0-rc10` present it calls rc9 the latest and lets a
-- release land that does not follow rc10. It is the same question the resolver
-- answers, so it now uses the same key: "compose predicates, never restate".
-- Restated from the live definition; only the ORDER BY changes.
CREATE OR REPLACE FUNCTION public.guard_function_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE prev record; breaks text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Functions:VersionsAreImmutable — a released version cannot be changed; publish a new one';
  END IF;

  SELECT * INTO prev FROM public.function_versions v
   WHERE v.function_id = NEW.function_id
   ORDER BY v.major DESC, v.minor DESC, v.patch DESC,
            (v.prerelease IS NULL) DESC,
            public.semver_prerelease_key(v.prerelease) DESC
   LIMIT 1;
  IF prev IS NULL THEN RETURN NEW; END IF;

  IF (NEW.major, NEW.minor, NEW.patch) <= (prev.major, prev.minor, prev.patch)
     AND NEW.prerelease IS NULL THEN
    RAISE EXCEPTION 'Functions:VersionGoesForward — %.%.% does not follow %.%.%',
      NEW.major, NEW.minor, NEW.patch, prev.major, prev.minor, prev.patch;
  END IF;

  breaks := public.signature_breaks(prev.signature, NEW.signature);
  IF array_length(breaks, 1) > 0 AND NEW.major = prev.major THEN
    RAISE EXCEPTION 'Functions:BreakingChangeNeedsMajor — %', array_to_string(breaks, '; ')
      USING HINT = 'Release a major version, or restore the previous signature.';
  END IF;
  RETURN NEW;
END $$;

-- ── and the version a caller asked for by name ──────────────────────────────
CREATE OR REPLACE FUNCTION public.function_resolve_version(
  p_function uuid,
  p_version text DEFAULT NULL,
  p_resolution text DEFAULT 'SEMANTIC_VERSION',
  p_include_prerelease boolean DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE parts text[]; v uuid;
BEGIN
  IF p_version IS NULL THEN
    RETURN public.function_latest_version(p_function, p_resolution, p_include_prerelease);
  END IF;
  -- "Not supported together with `version`." The resolution mode is merely
  -- ignored — it "controls how latest version is resolved when `version` is
  -- omitted" — but the flag is called out, so it is refused rather than ignored.
  IF p_include_prerelease IS NOT NULL THEN
    RAISE EXCEPTION 'Functions:IncludePrereleaseWithVersion — includePrerelease is not supported together with version';
  END IF;

  parts := regexp_match(p_version, '^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z.-]+))?$');
  IF parts IS NULL THEN
    RAISE EXCEPTION 'Functions:InvalidVersion — % is not written <major>.<minor>.<patch>-<tag>', p_version;
  END IF;

  SELECT fv.id INTO v FROM public.function_versions fv
   WHERE fv.function_id = p_function
     AND fv.major = parts[1]::int AND fv.minor = parts[2]::int
     AND fv.patch = parts[3]::int
     AND fv.prerelease IS NOT DISTINCT FROM parts[4];
  IF v IS NULL THEN
    RAISE EXCEPTION 'Functions:VersionNotFound — this function has no version %', p_version;
  END IF;
  RETURN v;
END $$;
COMMENT ON FUNCTION public.function_resolve_version(uuid, text, text, boolean) IS
  'The version a caller meant: the one they pinned, or the latest under the given resolution. Refuses includePrerelease alongside an explicit version, which the API does not support.';

-- ── the two readers, taking what a caller asked for ─────────────────────────
-- Dropped rather than replaced: the parameter list grows, and an overload
-- would be skipped by gen:client and leave the old shape callable.
DROP FUNCTION IF EXISTS public.function_to_run(uuid, text);

CREATE OR REPLACE FUNCTION public.function_to_run(
  p_ontology uuid,
  p_api_name text,
  p_version text DEFAULT NULL,
  p_resolution text DEFAULT 'SEMANTIC_VERSION',
  p_include_prerelease boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f record; v record; types jsonb; ver uuid;
BEGIN
  SELECT * INTO f FROM public.functions
   WHERE ontology_id = p_ontology AND api_name = p_api_name;
  IF f IS NULL OR NOT public.auth_in_ontology(f.ontology_id) THEN
    RAISE EXCEPTION 'Functions:NotFound — % is not a function you can see', p_api_name;
  END IF;
  -- "a user must have **Viewer** role on the repository from which the
  -- function was published" — placement is our repository boundary (454).
  IF f.project_id IS NOT NULL AND public.project_role(f.project_id) IS NULL THEN
    RAISE EXCEPTION 'Functions:ReadFunctionsPermissionDenied — this function lives in a project you have no role on';
  END IF;

  -- Resolved into a variable first, and NOT called inside the WHERE of a
  -- query over the same table. In that position it misses rows written
  -- earlier in the same transaction — observed here, reproducibly: the
  -- function receives the right arguments and its own SELECT returns nothing,
  -- while the identical predicate run inline finds the row. Committed rows are
  -- unaffected, which is why the old shape looked fine; a fixture that
  -- publishes a version and calls this in one transaction would not be.
  ver := public.function_resolve_version(
           f.id, p_version, p_resolution, p_include_prerelease);
  SELECT * INTO v FROM public.function_versions WHERE id = ver;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Functions:NoPublishedVersion — % has no released version', p_api_name;
  END IF;

  -- The declared imports, as the api names the client speaks.
  SELECT COALESCE(jsonb_agg(t.api_name), '[]'::jsonb) INTO types
    FROM public.object_types t
   WHERE t.id::text IN (SELECT jsonb_array_elements_text(v.imports->'object_types'));

  RETURN jsonb_build_object(
    'function_id', f.id, 'version_id', v.id,
    'api_name', f.api_name, 'source', v.source,
    'signature', v.signature, 'object_types', types,
    'version', public.function_version_string(v.major, v.minor, v.patch, v.prerelease));
END $$;
REVOKE ALL ON FUNCTION public.function_to_run(uuid, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.function_to_run(uuid, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.action_function_to_run(p_action_type uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
           'action_type_id', a.id,
           'ontology_id',    a.ontology_id,
           'api_name',       f.api_name,
           -- An action pins its version, and a pinned version can be a
           -- prerelease, so the tag has to survive the round trip.
           'version',        public.function_version_string(v.major, v.minor, v.patch, v.prerelease),
           'source',         v.source,
           'signature',      v.signature,
           'object_types',   v.imports->'object_types',
           'edits',          v.edits->'object_types',
           'inputs',         coalesce(
             (SELECT jsonb_object_agg(i.input_name, p.api_name)
                FROM public.action_type_rule_inputs i
                JOIN public.action_type_parameters p ON p.id = i.parameter_id
               WHERE i.rule_id = r.id), '{}'::jsonb))
    FROM public.action_types a
    JOIN public.action_type_rules r ON r.action_type_id = a.id AND r.kind = 'function'
    JOIN public.function_versions v ON v.id = r.function_version_id
    JOIN public.functions f ON f.id = v.function_id
   WHERE a.id = p_action_type
$$;

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE fid uuid; ont uuid; proj uuid; a uuid; b uuid; msg text;
BEGIN
  -- The format, both shapes.
  IF public.function_version_string(1, 2, 3) <> '1.2.3'
     OR public.function_version_string(1, 2, 3, 'rc1') <> '1.2.3-rc1' THEN
    RAISE EXCEPTION 'the version format is not what the page prints';
  END IF;

  -- The prerelease key sorts by magnitude, which plain text does not.
  IF NOT (public.semver_prerelease_key('rc10') > public.semver_prerelease_key('rc9')) THEN
    RAISE EXCEPTION 'rc10 does not outrank rc9';
  END IF;

  -- The rules, run against a real function with four versions, rolled back in
  -- its own subtransaction.
  BEGIN
    SELECT o.id INTO ont FROM public.ontologies o LIMIT 1;
    SELECT p.id INTO proj FROM public.projects p LIMIT 1;
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
    VALUES (ont, NULL, 'probe536', 'Probe 536') RETURNING id INTO fid;
    -- The lowest semantic version, stamped as the most recently published —
    -- which is the only way the two modes can disagree. It goes in first
    -- because a release must follow the last one (`VersionGoesForward`).
    INSERT INTO public.function_versions (function_id, major, minor, patch, prerelease, source, signature, published_at)
    VALUES (fid, 0, 9, 0, NULL, 'export default () => 4', '{"parameters":[],"returns":"Integer"}'::jsonb,
            now() + interval '1 minute') RETURNING id INTO b;
    INSERT INTO public.function_versions (function_id, major, minor, patch, prerelease, source, signature)
    VALUES
      (fid, 1, 0, 0, NULL,   'export default () => 1', '{"parameters":[],"returns":"Integer"}'::jsonb),
      (fid, 2, 0, 0, 'rc9',  'export default () => 2', '{"parameters":[],"returns":"Integer"}'::jsonb),
      (fid, 2, 0, 0, 'rc10', 'export default () => 3', '{"parameters":[],"returns":"Integer"}'::jsonb);

    -- Default: highest semantic version, prereleases excluded. 1.0.0, not the
    -- 2.0.0 prereleases and not the newer 0.9.0.
    SELECT public.function_latest_version(fid) INTO a;
    IF (SELECT public.function_version_string(major, minor, patch, prerelease)
          FROM public.function_versions WHERE id = a) <> '1.0.0' THEN
      RAISE EXCEPTION 'the default resolution is not the highest release';
    END IF;

    -- Including prereleases: 2.0.0-rc10 beats 2.0.0-rc9 and 1.0.0.
    SELECT public.function_latest_version(fid, 'SEMANTIC_VERSION', true) INTO a;
    IF (SELECT public.function_version_string(major, minor, patch, prerelease)
          FROM public.function_versions WHERE id = a) <> '2.0.0-rc10' THEN
      RAISE EXCEPTION 'includePrerelease did not reach the highest prerelease';
    END IF;

    -- PUBLISH_TIME: the most recently published, and prereleases count by
    -- default in that mode.
    IF public.function_latest_version(fid, 'PUBLISH_TIME') <> b THEN
      RAISE EXCEPTION 'PUBLISH_TIME did not resolve the most recent publication';
    END IF;

    -- A pinned version, including a prerelease. Resolved into a variable for
    -- the reason given on function_to_run above.
    SELECT public.function_resolve_version(fid, '2.0.0-rc9') INTO a;
    IF (SELECT public.function_version_string(major, minor, patch, prerelease)
          FROM public.function_versions WHERE id = a) <> '2.0.0-rc9' THEN
      RAISE EXCEPTION 'a pinned prerelease did not resolve to itself';
    END IF;

    -- And the two refusals.
    BEGIN
      PERFORM public.function_resolve_version(fid, '2.0.0-rc9', 'SEMANTIC_VERSION', true);
      RAISE EXCEPTION 'includePrerelease was accepted alongside a version';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      IF msg NOT LIKE '%IncludePrereleaseWithVersion%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.function_latest_version(fid, 'NEWEST');
      RAISE EXCEPTION 'an unpublished resolution mode was accepted';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      IF msg NOT LIKE '%InvalidLatestVersionResolution%' THEN RAISE; END IF;
    END;

    -- The guard now agrees with the resolver about which version is last.
    -- With text ordering it took rc9 for the newest and let 2.0.0 through as
    -- following it; the highest here is 2.0.0-rc10 either way, so the release
    -- that must be refused is 2.0.0 itself — it does not go forward.
    BEGIN
      INSERT INTO public.function_versions (function_id, major, minor, patch, prerelease, source, signature)
      VALUES (fid, 2, 0, 0, NULL, 'export default () => 5', '{"parameters":[],"returns":"Integer"}'::jsonb);
      RAISE EXCEPTION 'a release landed on top of its own prerelease';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
      IF msg NOT LIKE '%VersionGoesForward%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'probe-536-done' USING ERRCODE = 'ZZZZZ';
  EXCEPTION WHEN SQLSTATE 'ZZZZZ' THEN NULL;
  END;

  RAISE NOTICE '536: the latest version is whichever the caller meant';
END $do$;
