-- Functions, slice F1: the read-only subset, as code.
--
-- "**Functions** enable code authors to write logic that can be executed
-- quickly in operational contexts… This logic is executed on the server side
-- in an isolated environment." (functions/overview.md)
--
-- "Queries are the read-only subsets of functions… They cannot have any side
-- effects, such as modifying the Ontology or altering external systems."
-- (functions/query-functions.md)
--
-- The logic is TypeScript, run in a Deno worker with no ambient permissions;
-- the ontology reaches it only through the injected generated client, whose
-- every call the host performs with the CALLER's JWT. This table holds the
-- artifact: source, typed signature, declared imports, immutable versions.

-- ── the function ────────────────────────────────────────────────────────────
CREATE TABLE public.functions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_id   uuid NOT NULL REFERENCES public.ontologies(id) ON DELETE RESTRICT,
  -- Placement, like every other ontology resource (454).
  project_id    uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  -- "Be in lowerCamelCase. Be under 100 characters. Not contain leading
  -- numbers. Be unique among all Ontologies imported into the repository."
  api_name      text NOT NULL
                CHECK (api_name ~ '^[a-z][a-zA-Z0-9]*$' AND length(api_name) < 100),
  display_name  text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description   text,
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ontology_id, api_name)
);
COMMENT ON TABLE public.functions IS
  'A function: server-side logic authored as code against the ontology. The api_name follows the documented four rules; versions carry the source.';
CREATE INDEX functions_ontology_idx ON public.functions (ontology_id);
CREATE INDEX functions_project_idx ON public.functions (project_id);
CREATE INDEX functions_created_by_idx ON public.functions (created_by);

-- ── the immutable version ───────────────────────────────────────────────────
-- "Versions for function releases are chosen by their publishers and are
-- immutable after creation." Semver: "versions take the form `X.Y.Z`… A
-- version may also include a prerelease identifier".
CREATE TABLE public.function_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id   uuid NOT NULL REFERENCES public.functions(id) ON DELETE CASCADE,
  major         int NOT NULL CHECK (major >= 0),
  minor         int NOT NULL CHECK (minor >= 0),
  patch         int NOT NULL CHECK (patch >= 0),
  prerelease    text CHECK (prerelease IS NULL OR prerelease ~ '^[0-9A-Za-z.-]+$'),
  -- The code itself.
  source        text NOT NULL CHECK (length(btrim(source)) > 0),
  -- The typed signature: {"parameters":[{"name","type","required"}],"returns":"…"}
  signature     jsonb NOT NULL,
  -- "the functions plugins load the latest Ontology based on the
  -- repository's permissions and generate code bindings for every object and
  -- link type that was loaded" — declared here, and the host refuses a
  -- mediated call naming anything outside them.
  imports       jsonb NOT NULL DEFAULT '{"object_types":[],"link_types":[]}'::jsonb,
  published_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (function_id, major, minor, patch, prerelease)
);
COMMENT ON TABLE public.function_versions IS
  'One published version: the TypeScript source, its typed signature, and the object and link types it declares. Immutable after creation.';
CREATE INDEX function_versions_function_idx ON public.function_versions (function_id);
CREATE INDEX function_versions_published_by_idx ON public.function_versions (published_by);

-- ── the signature grammar ───────────────────────────────────────────────────
-- The types are the documented Workshop mapping (use-functions.md) plus the
-- object-set type; anything else refuses by name rather than passing through.
CREATE OR REPLACE FUNCTION public.function_type_valid(p_type text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_type IN ('boolean', 'string', 'Integer', 'Long', 'Float', 'Double',
                    'LocalDate', 'Timestamp')
      OR p_type ~ '^(boolean|string|Integer|Long|Float|Double|LocalDate|Timestamp)\[\]$'
      OR p_type ~ '^ObjectSet<[A-Za-z][A-Za-z0-9]*>$'
$$;

CREATE OR REPLACE FUNCTION public.function_signature_valid(p_sig jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE p jsonb; seen text[] := '{}';
BEGIN
  IF p_sig IS NULL OR jsonb_typeof(p_sig) <> 'object'
     OR jsonb_typeof(p_sig->'parameters') <> 'array'
     OR NOT public.function_type_valid(p_sig->>'returns') THEN
    RETURN false;
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(p_sig->'parameters') LOOP
    IF (p->>'name') !~ '^[a-z][a-zA-Z0-9]*$'
       OR NOT public.function_type_valid(p->>'type')
       OR jsonb_typeof(p->'required') <> 'boolean'
       OR (p->>'name') = ANY (seen) THEN
      RETURN false;
    END IF;
    seen := seen || (p->>'name');
  END LOOP;
  RETURN true;
END $$;

ALTER TABLE public.function_versions
  ADD CONSTRAINT function_versions_signature_valid
  CHECK (public.function_signature_valid(signature));

-- ── the backward compatibility checks ───────────────────────────────────────
-- The page's own list of breaking changes: "Dropping a function… Dropping an
-- input (even an optional one) on a function's signature. Reordering an input
-- on a function's signature. Adding a required input to a function's
-- signature. Bad input type changes… Bad output type changes".
-- "Note that widening a numeric input type (like integer to float) will
-- result in a warning" — so widening passes; everything else takes a major.
CREATE OR REPLACE FUNCTION public.type_widens(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (p_from = 'Integer' AND p_to IN ('Long', 'Float', 'Double'))
      OR (p_from = 'Long'    AND p_to IN ('Float', 'Double'))
      OR (p_from = 'Float'   AND p_to = 'Double')
$$;

CREATE OR REPLACE FUNCTION public.signature_breaks(p_old jsonb, p_new jsonb)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  breaks text[] := '{}'; i int; oldp jsonb; newp jsonb;
  n_old int; n_new int;
BEGIN
  n_old := jsonb_array_length(p_old->'parameters');
  n_new := jsonb_array_length(p_new->'parameters');

  FOR i IN 0 .. n_old - 1 LOOP
    oldp := p_old->'parameters'->i;
    newp := p_new->'parameters'->i;
    IF newp IS NULL THEN
      breaks := breaks || format('dropped input "%s"', oldp->>'name');
    ELSIF (newp->>'name') IS DISTINCT FROM (oldp->>'name') THEN
      -- A name at a different position is either a reorder or a drop; the
      -- page names both, and both take a major.
      breaks := breaks || format('input "%s" moved or was dropped', oldp->>'name');
    ELSIF (newp->>'type') IS DISTINCT FROM (oldp->>'type')
          AND NOT public.type_widens(oldp->>'type', newp->>'type') THEN
      breaks := breaks || format('input "%s" changed type %s to %s',
                                 oldp->>'name', oldp->>'type', newp->>'type');
    END IF;
  END LOOP;

  FOR i IN n_old .. n_new - 1 LOOP
    newp := p_new->'parameters'->i;
    IF (newp->>'required')::boolean THEN
      breaks := breaks || format('added required input "%s"', newp->>'name');
    END IF;
  END LOOP;

  IF (p_new->>'returns') IS DISTINCT FROM (p_old->>'returns') THEN
    breaks := breaks || format('output changed %s to %s',
                               p_old->>'returns', p_new->>'returns');
  END IF;
  RETURN breaks;
END $$;

COMMENT ON FUNCTION public.signature_breaks(jsonb, jsonb) IS
  'The documented breaking changes between two signatures: dropped, moved, retyped or newly-required inputs, and output changes. Widening a numeric input is not a break.';

-- ── publishing ──────────────────────────────────────────────────────────────
-- Immutable, and a break takes a major bump. Foundry warns here; ours
-- refuses, because there is no human release-review step (reading, decision 5).
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
            (v.prerelease IS NULL) DESC, v.prerelease DESC
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
CREATE TRIGGER trg_guard_function_version BEFORE INSERT OR UPDATE ON public.function_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_function_version();

-- ── resolution ──────────────────────────────────────────────────────────────
-- "API-named queries will always use the **latest tagged version** of the
-- published query" — the latest STABLE release, prereleases excluded.
CREATE OR REPLACE FUNCTION public.function_latest_version(p_function uuid)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT v.id FROM public.function_versions v
   WHERE v.function_id = p_function AND v.prerelease IS NULL
   ORDER BY v.major DESC, v.minor DESC, v.patch DESC
   LIMIT 1
$$;

-- What the runner needs, in one call: the source, the signature and the
-- declared imports resolved to their api names. Definer because the runner
-- holds the caller's JWT for DATA, not for the artifact — reading the code
-- takes the same visibility the function itself has.
CREATE OR REPLACE FUNCTION public.function_to_run(p_ontology uuid, p_api_name text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE f record; v record; types jsonb;
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

  SELECT * INTO v FROM public.function_versions
   WHERE id = public.function_latest_version(f.id);
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
    'version', format('%s.%s.%s', v.major, v.minor, v.patch));
END $$;
REVOKE ALL ON FUNCTION public.function_to_run(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.function_to_run(uuid, text) TO authenticated, service_role;

-- ── visibility ──────────────────────────────────────────────────────────────
ALTER TABLE public.functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ontology members see functions" ON public.functions FOR SELECT
  USING (public.auth_in_ontology(ontology_id) AND public.can_see_placed(project_id));
CREATE POLICY "editors author functions" ON public.functions FOR ALL
  USING (public.auth_in_ontology(ontology_id)
         AND (public.auth_role() IN ('owner', 'admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')))
  WITH CHECK (public.auth_in_ontology(ontology_id)
              AND (public.auth_role() IN ('owner', 'admin')
                   OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')));
CREATE POLICY "readers see versions" ON public.function_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.functions f WHERE f.id = function_id
                   AND public.auth_in_ontology(f.ontology_id)
                   AND public.can_see_placed(f.project_id)));
CREATE POLICY "editors publish versions" ON public.function_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.functions f WHERE f.id = function_id
                   AND public.auth_in_ontology(f.ontology_id)
                   AND (public.auth_role() IN ('owner', 'admin')
                        OR public.role_rank(public.project_role(f.project_id)) >= public.role_rank('editor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.functions f WHERE f.id = function_id
                        AND public.auth_in_ontology(f.ontology_id)
                        AND (public.auth_role() IN ('owner', 'admin')
                             OR public.role_rank(public.project_role(f.project_id)) >= public.role_rank('editor'))));

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; fn uuid; t uuid;
  u1 uuid := gen_random_uuid(); before text; payload jsonb; n int;
  sig jsonb := '{"parameters":[{"name":"minimumMinutes","type":"Integer","required":true}],"returns":"Double"}';
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('fn-501') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f501@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (u1, 'f501@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;
  sp := public.create_space('F501');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'f501', 'F501', false) RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'f501', 'F501') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);
  RESET ROLE;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Aircraft501', 'Aircraft') RETURNING id INTO t;
  SET LOCAL ROLE authenticated;

  -- 1. The four API name rules refuse what the page refuses.
  BEGIN
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
    VALUES (ont, proj, 'NotCamel', 'Bad');
    RAISE EXCEPTION 'an UpperCamel api name was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%api_name%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
    VALUES (ont, proj, '2fast', 'Bad');
    RAISE EXCEPTION 'a leading-number api name was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE '%api_name%' THEN RAISE; END IF;
  END;

  INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
  VALUES (ont, proj, 'getReschedulableAircraftCount', 'Reschedulable aircraft')
  RETURNING id INTO fn;

  -- 2. A version publishes with its source, signature and declared imports.
  INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature, imports)
  VALUES (fn, 1, 0, 0,
    'export default async function run(client, { minimumMinutes }) { return 0 }',
    sig, jsonb_build_object('object_types', jsonb_build_array(t::text), 'link_types', '[]'::jsonb));

  -- 3. Immutable after creation.
  BEGIN
    UPDATE public.function_versions SET source = 'tampered' WHERE function_id = fn;
    RAISE EXCEPTION 'a released version was edited';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Functions:VersionsAreImmutable%' THEN RAISE; END IF;
  END;

  -- 4. The documented breaking changes each take a major.
  BEGIN
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fn, 1, 1, 0, 'x', '{"parameters":[{"name":"minimumMinutes","type":"Integer","required":true},{"name":"extra","type":"string","required":true}],"returns":"Double"}');
    RAISE EXCEPTION 'a new required input rode a minor version';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Functions:BreakingChangeNeedsMajor%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fn, 1, 1, 0, 'x', '{"parameters":[{"name":"minimumMinutes","type":"Integer","required":true}],"returns":"string"}');
    RAISE EXCEPTION 'an output type change rode a minor version';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Functions:BreakingChangeNeedsMajor%' THEN RAISE; END IF;
  END;

  -- 5. An optional input and a numeric widening are backward compatible.
  INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
  VALUES (fn, 1, 1, 0, 'x', '{"parameters":[{"name":"minimumMinutes","type":"Long","required":true},{"name":"note","type":"string","required":false}],"returns":"Double"}');

  -- 6. The runner payload resolves the latest stable version and its imports.
  INSERT INTO public.function_versions (function_id, major, minor, patch, prerelease, source, signature)
  VALUES (fn, 2, 0, 0, 'rc1', 'x', sig);
  payload := public.function_to_run(ont, 'getReschedulableAircraftCount');
  IF payload->>'version' <> '1.1.0' THEN
    RAISE EXCEPTION 'the latest STABLE version should resolve, got %', payload->>'version';
  END IF;

  -- 7. Placement gates the read, the way repository Viewer does.
  RESET ROLE;
  DELETE FROM public.project_role_grants WHERE project_id = proj AND user_id = u1;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.function_to_run(ont, 'getReschedulableAircraftCount');
    RAISE EXCEPTION 'a user with no project role read the function';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Functions:ReadFunctionsPermissionDenied%' THEN RAISE; END IF;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '501: a function is versioned code, and a break takes a major';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
