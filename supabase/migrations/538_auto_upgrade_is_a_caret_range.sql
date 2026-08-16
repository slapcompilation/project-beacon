-- `auto_upgrade` finally does something, and the documentation says what.
--
-- 509 added `action_type_rules.auto_upgrade` from a screenshot — the Run
-- function card shows an "Auto upgrade to compatible versions" toggle beside a
-- pinned version — and shipped it off by default. It has been written ever
-- since and **read by nothing**: `action_function_to_run` joins
-- `r.function_version_id` and never looks at the flag. A stored toggle that no
-- resolver consults is the same "built, not consumed" gap this repository keeps
-- finding, and it is the seventh or eighth time.
--
-- What the toggle MEANS was not invented here. It is published:
--
--   "In addition to depending on a pinned version of a Function, some
--    applications like Workshop and Actions allow you to depend on a Function
--    at a version range. Doing so enables automatic upgrades at runtime"
--
--   "Applications like Workshop and Actions currently only allow version ranges
--    that comprise backward compatible versions (that is, minor or patch
--    upgrades)."
--
--   "The NPM equivalent of this backward compatible range used by Workshop and
--    Actions is the caret range."
--
--   "when you depend on a Function at a version range, a concrete version that
--    satisfies the range will be chosen at runtime during execution. In
--    particular, the *maximum* satisfying version will be chosen"
--                        (functions/version-range-dependencies-for-functions)
--
-- So the toggle is a **caret range on the pinned version**, resolved to the
-- maximum satisfying version at execution. Off means pinned, which the page
-- also endorses: "if your application has strict uptime requirements and cannot
-- tolerate any breaks, you should use pinned version dependencies."
--
-- ── AND IT SETTLES SOMETHING 536 MARKED AS INFERENCE ────────────────────────
-- 536 said the documentation "does not say how two prereleases of the SAME
-- x.y.z order against each other" and marked the ordering as inference. That
-- was wrong, and this page is where it says so:
--
--   "You should also be familiar with the rules around version precedence as
--    defined in the Semantic Versioning specification. In other words, you
--    should be able to determine, given two distinct versions, which one has
--    lower precedence. For example, `1.0.0-rc.1` < `1.0.0` < `1.0.1` <
--    `1.1.0` < `2.0.0`."
--
-- Precedence is the semver specification's, by reference, and the printed
-- example confirms both things 536 implemented: a release outranks its own
-- prerelease, and prerelease identifiers are dot-separated. The inference note
-- in 536 stands as a record of what I believed; this corrects it forward.
--
-- ── WHAT IS STILL INFERENCE ─────────────────────────────────────────────────
-- The caret's behaviour BELOW 1.0.0 — that `^0.2.3` allows `0.2.x` but not
-- `0.3.0`, and `^0.0.3` allows nothing but `0.0.3` — is NPM's rule, which the
-- page names but does not restate. Marked, and it is the conservative
-- direction: a narrower range upgrades less.

-- ── the caret's upper bound ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.semver_caret_upper(p_major int, p_minor int, p_patch int)
RETURNS int[] LANGUAGE sql IMMUTABLE AS $fn$
  -- Exclusive upper bound of a caret range, NPM's rule (INFERENCE below 1.0.0,
  -- which the page names rather than prints):
  --   ^1.2.3 → <2.0.0     a major is the only breaking step
  --   ^0.2.3 → <0.3.0     "0.y.z is for initial development", so a minor breaks
  --   ^0.0.3 → <0.0.4     nothing is compatible with 0.0.x but itself
  SELECT CASE
           WHEN p_major > 0 THEN ARRAY[p_major + 1, 0, 0]
           WHEN p_minor > 0 THEN ARRAY[0, p_minor + 1, 0]
           ELSE ARRAY[0, 0, p_patch + 1]
         END
$fn$;
COMMENT ON FUNCTION public.semver_caret_upper(int, int, int) IS
  'The exclusive upper bound of a caret range: the backward-compatible window an auto-upgrading dependency may move within.';

-- ── the version a rule actually runs ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.action_rule_version(p_rule uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE r record; hi int[]; v uuid;
BEGIN
  SELECT ar.function_version_id, ar.auto_upgrade, fv.function_id,
         fv.major, fv.minor, fv.patch, fv.prerelease
    INTO r
    FROM public.action_type_rules ar
    JOIN public.function_versions fv ON fv.id = ar.function_version_id
   WHERE ar.id = p_rule;
  IF r IS NULL THEN RETURN NULL; END IF;

  -- Off is a pinned dependency, which is the documented conservative choice.
  IF NOT r.auto_upgrade THEN RETURN r.function_version_id; END IF;

  hi := public.semver_caret_upper(r.major, r.minor, r.patch);

  -- "the maximum satisfying version will be chosen". Prereleases are excluded:
  -- they are not backward compatible versions, and a range without a
  -- prerelease does not admit one.
  SELECT fv.id INTO v
    FROM public.function_versions fv
   WHERE fv.function_id = r.function_id
     AND fv.prerelease IS NULL
     AND (fv.major, fv.minor, fv.patch) >= (r.major, r.minor, r.patch)
     AND (fv.major, fv.minor, fv.patch) < (hi[1], hi[2], hi[3])
   ORDER BY fv.major DESC, fv.minor DESC, fv.patch DESC
   LIMIT 1;

  -- A pinned PRERELEASE with the toggle on has no compatible successor of its
  -- own kind; it keeps running, rather than silently jumping to a release.
  RETURN coalesce(v, r.function_version_id);
END $fn$;
REVOKE ALL ON FUNCTION public.action_rule_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.action_rule_version(uuid) TO authenticated;
COMMENT ON FUNCTION public.action_rule_version(uuid) IS
  'The function version a function-backed action runs: the pinned one, or with auto_upgrade the maximum version satisfying the caret range on it.';

-- ── the binding, resolving through it ───────────────────────────────────────
-- plpgsql with the id in a variable, NOT `WHERE v.id = action_rule_version(...)`
-- inside a query over function_versions. 536 recorded that shape missing rows
-- written earlier in the same transaction, reproducibly and unexplained; every
-- fixture here publishes a version and calls this in one transaction.
CREATE OR REPLACE FUNCTION public.action_function_to_run(p_action_type uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE a record; r record; v record; f record; ver uuid;
BEGIN
  SELECT at.id, at.ontology_id INTO a FROM public.action_types at WHERE at.id = p_action_type;
  IF a IS NULL THEN RETURN NULL; END IF;

  SELECT ar.* INTO r FROM public.action_type_rules ar
   WHERE ar.action_type_id = p_action_type AND ar.kind = 'function'
   ORDER BY ar.position LIMIT 1;
  IF r IS NULL THEN RETURN NULL; END IF;

  ver := public.action_rule_version(r.id);
  SELECT * INTO v FROM public.function_versions WHERE id = ver;
  IF v IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO f FROM public.functions WHERE id = v.function_id;

  RETURN jsonb_build_object(
    'action_type_id', a.id,
    'ontology_id',    a.ontology_id,
    'api_name',       f.api_name,
    -- An action may pin a prerelease, so the tag has to survive the round trip.
    'version',        public.function_version_string(v.major, v.minor, v.patch, v.prerelease),
    'source',         v.source,
    'signature',      v.signature,
    'object_types',   v.imports->'object_types',
    'edits',          v.edits->'object_types',
    'inputs',         coalesce(
      (SELECT jsonb_object_agg(i.input_name, p.api_name)
         FROM public.action_type_rule_inputs i
         JOIN public.action_type_parameters p ON p.id = i.parameter_id
        WHERE i.rule_id = r.id), '{}'::jsonb));
END $fn$;

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE ont uuid; otype text; fid uuid; pinned uuid; rule uuid; act uuid; got jsonb;
        sig jsonb := '{"parameters":[],"returns":"OntologyEdit[]"}'::jsonb;
        eds jsonb;
BEGIN
  -- The caret's three windows, from the page's own semantics.
  IF public.semver_caret_upper(1, 2, 3) <> ARRAY[2, 0, 0]
     OR public.semver_caret_upper(0, 2, 3) <> ARRAY[0, 3, 0]
     OR public.semver_caret_upper(0, 0, 3) <> ARRAY[0, 0, 4] THEN
    RAISE EXCEPTION 'the caret window is not NPM''s';
  END IF;

  BEGIN
    -- An edit function must declare an object type it edits, and the guard
    -- checks that type belongs to the same ontology, so both come from one row.
    -- `edits` names object types by API NAME (guard_function_edits matches on
    -- api_name), while `imports` holds ids. Both come from one row here.
    SELECT ot.ontology_id, ot.api_name INTO ont, otype FROM public.object_types ot LIMIT 1;
    IF ont IS NULL THEN RAISE EXCEPTION '538: no object type to declare as edited'; END IF;
    eds := jsonb_build_object('object_types', jsonb_build_array(otype));
    INSERT INTO public.functions (ontology_id, api_name, display_name)
    VALUES (ont, 'probe538', 'Probe 538') RETURNING id INTO fid;
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature, edits)
    VALUES (fid, 1, 0, 0, 'export default () => 1', sig, eds) RETURNING id INTO pinned;

    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (ont, 'probe-538-action', 'Probe 538') RETURNING id INTO act;
    INSERT INTO public.action_type_rules
      (action_type_id, kind, position, function_name, function_version_id, auto_upgrade)
    VALUES (act, 'function', 0, 'probe538', pinned, false) RETURNING id INTO rule;

    -- Pinned: the only version there is.
    IF public.action_rule_version(rule) <> pinned THEN
      RAISE EXCEPTION 'a pinned rule did not resolve to its pin';
    END IF;

    -- A compatible release lands, and a major one beside it.
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature, edits)
    VALUES (fid, 1, 1, 0, 'export default () => 2', sig, eds),
           (fid, 2, 0, 0, 'export default () => 3', sig, eds);

    -- Still pinned while the toggle is off. This is the half that was already
    -- true, and the half that must not change.
    IF public.action_rule_version(rule) <> pinned THEN
      RAISE EXCEPTION 'a pinned rule moved when a new version landed';
    END IF;

    UPDATE public.action_type_rules SET auto_upgrade = true WHERE id = rule;

    -- "the maximum satisfying version": 1.1.0, and NOT 2.0.0.
    got := to_jsonb(public.function_version_string(v.major, v.minor, v.patch, v.prerelease))
      FROM public.function_versions v WHERE v.id = public.action_rule_version(rule);
    IF got <> to_jsonb('1.1.0'::text) THEN
      RAISE EXCEPTION 'auto upgrade resolved % rather than 1.1.0', got;
    END IF;

    -- And a prerelease inside the window is not a backward compatible version.
    INSERT INTO public.function_versions (function_id, major, minor, patch, prerelease, source, signature, edits)
    VALUES (fid, 1, 2, 0, 'rc1', 'export default () => 4', sig, eds);
    got := to_jsonb(public.function_version_string(v.major, v.minor, v.patch, v.prerelease))
      FROM public.function_versions v WHERE v.id = public.action_rule_version(rule);
    IF got <> to_jsonb('1.1.0'::text) THEN
      RAISE EXCEPTION 'auto upgrade took the prerelease %', got;
    END IF;

    -- The binding reports what it will actually run.
    got := public.action_function_to_run(act);
    IF got ->> 'version' <> '1.1.0' THEN
      RAISE EXCEPTION 'the action reports version %, not the resolved one', got ->> 'version';
    END IF;

    RAISE EXCEPTION 'probe-538-done' USING ERRCODE = 'ZZZZZ';
  EXCEPTION WHEN SQLSTATE 'ZZZZZ' THEN NULL;
  END;

  RAISE NOTICE '538: auto upgrade is a caret range, resolved to the maximum that satisfies it';
END $do$;
