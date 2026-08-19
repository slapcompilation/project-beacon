-- Phase F3. What uses this object type — the index CLAUDE.md keeps invoking.
--
-- ── THE WHOLE SPECIFICATION IS ONE WORD AND ONE SCREENSHOT ────────────────
-- `ontology-manager/overview` enumerates the object type page as seven numbered
-- sections and gives Dependents no sentence at all. Everything below is read
-- off `oma-user-interface-overview-annotated.png`, which is the image those
-- numbers annotate:
--
--   Dependents 14
--   Workshop 9 · Function 2 · Graph Template 1 · Quiver Dashboard 1 ·
--   Use cases 1 · Automation 0 · Developer Console App 0 · Map Layer 0 ·
--   Map Template 0
--
-- Left pane kinds with counts, right pane the instances of the selected kind.
-- Three things follow that no sentence gives: the header is the SUM of the
-- kinds (9+2+1+1+1 = 14), so a dependent is counted once per instance and not
-- per reference; the zeroes are rendered, so the kind list is shown whole; and
-- the right pane offers Create new, so it is a place of work.
--
-- ── DEPENDENTS ARE APPLICATIONS, NOT ONTOLOGY TYPES ──────────────────────
-- Every kind in that list is an application. Action types and link types are
-- NOT dependents — they are sections 3 and 4 of the same page with their own
-- panels. Folding them in would inflate every count while answering a question
-- the panel does not ask.
--
-- ── AND THE KIND LIST IS WHAT THE PLATFORM HAS, NOT A UNIVERSAL ENUM ─────
-- The first draft of the reading proposed registering all nine with a
-- `computable` flag, the way `cleanup_flags()` carries two it cannot compute.
-- `app-building/curating-apps` argues against it:
--
--   "You can configure the option to display or hide platform apps from users
--    in Control Panel under the **Application access** tab. This allows you to
--    show only certain sub-groups of apps in Applications Portal, as well as in
--    the rest of Foundry."
--
-- **"as well as in the rest of Foundry"** — an application hidden for an
-- enrollment is hidden everywhere, which must include a panel naming it as a
-- dependent kind. So the rendered zeroes are kinds the platform HAS and this
-- object type does not use. Registering Workshop on a platform with no Workshop
-- would render a panel no Foundry tenant would ever see. Two kinds, and zeroes
-- among those two. (Inference; the clause is about Application access rather
-- than about Dependents.)
--
-- ── A DEPENDENT YOU CANNOT SEE DOES NOT COUNT ────────────────────────────
-- Nothing states this for Dependents. The same page states it twice for the
-- Applications Portal's own groupings:
--
--   "Only collections that have promoted apps linked to them are displayed in
--    Applications Portal, and only if you have access to view/discover these
--    apps."
--
-- and again for tags. `view-usage` says the equivalent for the panel directly
-- beside this one — its metrics "only includes the usage from users who have
-- access to the object type". So counts are scoped to what the caller may
-- already see, which is both the safe direction and the documented-by-analogy
-- one. Here that falls out for free: the functions and automations a caller
-- cannot see are already invisible to them under RLS, so a plain query in a
-- non-DEFINER function counts only what they could have opened anyway.
--
-- ── THE TWO PATHS ARE CONTENT, NOT SCHEMA ────────────────────────────────
-- Neither consumer has a foreign key to `object_types`, which is why reading
-- `pg_constraint` finds nothing: a function names its object types inside
-- `imports` jsonb, and an automation reaches them through its object set or
-- through an action its effects invoke. The dependency lives in a resource's
-- content.
--
-- ── AND WHAT THIS DOES NOT DO ────────────────────────────────────────────
-- It does not retire `check:surfaces`. That guard asks whether one of OUR React
-- files is reachable from `main.tsx`; this asks which applications consume an
-- object type. Two different graphs.
--
-- Nor does it gate deletion. `metadata-statuses` is explicit that the gate is
-- status — "A resource's status must be `experimental` or `deprecated` before
-- it can be deleted" — which 321 and 327 already enforce. Dependents is
-- informational: it tells an editor what will break, not whether they may act.

BEGIN;

-- ── §1 the kinds this platform can have ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.dependent_kinds()
RETURNS TABLE (kind text, label text, note text)
LANGUAGE sql IMMUTABLE AS $fn$
  VALUES
    ('function',   'Function',
     'A function whose published version declares this object type among its imports.'),
    ('automation', 'Automation',
     'An automation whose condition watches an object set of this type, or whose effects invoke an action that edits it.')
$fn$;
REVOKE ALL ON FUNCTION public.dependent_kinds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dependent_kinds() TO authenticated;

COMMENT ON FUNCTION public.dependent_kinds() IS
  'The dependent kinds this platform has. Foundry shows nine because it has nine applications; Application access scopes that list per enrollment, so registering kinds we do not have would render a panel no tenant would see.';

-- ── §2 the instances, per kind ───────────────────────────────────────────
-- Deliberately NOT security definer: a caller sees the functions and
-- automations RLS already lets them see, which is the collections-and-tags rule
-- arriving for free.
CREATE OR REPLACE FUNCTION public.object_type_dependents(p_object_type uuid)
RETURNS TABLE (kind text, dependent_id uuid, name text)
LANGUAGE sql STABLE AS $fn$
  -- A function declares its object types in `imports`, as ids in a jsonb array.
  SELECT DISTINCT 'function', f.id, f.display_name
    FROM public.functions f
    JOIN public.function_versions v ON v.function_id = f.id
   WHERE p_object_type::text IN (
           SELECT jsonb_array_elements_text(v.imports->'object_types'))

  UNION

  -- An automation reaches an object type through the object set it watches …
  SELECT DISTINCT 'automation', a.id, a.display_name
    FROM public.automations a
    JOIN public.object_sets os
      ON os.id = nullif(a.condition->>'object_set_id','')::uuid
   WHERE os.subject_type_id = p_object_type

  UNION

  -- … or through an action one of its effects invokes.
  SELECT DISTINCT 'automation', a.id, a.display_name
    FROM public.automations a
    JOIN public.automation_effects e ON e.automation_id = a.id
    JOIN public.action_type_rules r ON r.action_type_id = e.action_type_id
   WHERE r.object_type_id = p_object_type
$fn$;

COMMENT ON FUNCTION public.object_type_dependents(uuid) IS
  'Applications that consume this object type, one row per instance. Not SECURITY DEFINER on purpose: a dependent the caller cannot see must not be counted, and RLS already answers that.';

-- ── §3 the panel: every kind, including the zeroes ───────────────────────
CREATE OR REPLACE FUNCTION public.object_type_dependent_counts(p_object_type uuid)
RETURNS TABLE (kind text, label text, dependents bigint)
LANGUAGE sql STABLE AS $fn$
  SELECT k.kind, k.label, count(d.dependent_id)
    FROM public.dependent_kinds() k
    LEFT JOIN public.object_type_dependents(p_object_type) d ON d.kind = k.kind
   GROUP BY k.kind, k.label
   ORDER BY count(d.dependent_id) DESC, k.kind
$fn$;
COMMENT ON FUNCTION public.object_type_dependent_counts(uuid) IS
  'The left pane. Every kind appears, including those with none — the screenshot renders Automation 0 beside Workshop 9, which is what makes it a directory rather than a result set.';

-- ── assertions, which build a real dependent of each kind ────────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; usr uuid;
  ot uuid; other uuid; fn uuid; auto uuid; os_id uuid; act uuid; n bigint; total bigint;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe580') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe580') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe580', 'Probe580') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe580@beacon.test') RETURNING id INTO usr;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe580', 'Probe580', false) RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Aircraft', 'Aircraft') RETURNING id INTO ot;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Lonely', 'Lonely') RETURNING id INTO other;

    -- Two kinds, both real.
    SELECT count(*) INTO n FROM public.dependent_kinds();
    IF n <> 2 THEN RAISE EXCEPTION 'expected two dependent kinds, found %', n; END IF;

    -- Nothing yet, and the zeroes still render.
    SELECT count(*) INTO n FROM public.object_type_dependent_counts(ot);
    IF n <> 2 THEN RAISE EXCEPTION 'the panel dropped a kind with no dependents'; END IF;
    SELECT sum(dependents) INTO total FROM public.object_type_dependent_counts(ot);
    IF total <> 0 THEN RAISE EXCEPTION 'found % dependents before any existed', total; END IF;

    -- A function that imports it.
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
      VALUES (ont, proj, 'scoreAircraft', 'Score aircraft') RETURNING id INTO fn;
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature, imports)
      VALUES (fn, 1, 0, 0, 'export function f(){}', '{}'::jsonb,
              jsonb_build_object('object_types', jsonb_build_array(ot::text),
                                 'link_types', '[]'::jsonb));

    -- An automation watching an object set of it.
    INSERT INTO public.object_sets (ontology_id, project_id, api_name, name, subject_type_id, created_by_user_id)
      VALUES (ont, proj, 'grounded', 'Grounded', ot, usr) RETURNING id INTO os_id;
    INSERT INTO public.automations (project_id, display_name, owner_id, condition)
      VALUES (proj, 'Watch grounded', usr,
              jsonb_build_object('type','objects_added','object_set_id', os_id::text))
      RETURNING id INTO auto;

    SELECT count(*) INTO n FROM public.object_type_dependents(ot);
    IF n <> 2 THEN RAISE EXCEPTION 'expected two dependents, found %', n; END IF;

    -- The counts, and the header is their sum.
    SELECT dependents INTO n FROM public.object_type_dependent_counts(ot) WHERE kind = 'function';
    IF n <> 1 THEN RAISE EXCEPTION 'function count is %', n; END IF;
    SELECT dependents INTO n FROM public.object_type_dependent_counts(ot) WHERE kind = 'automation';
    IF n <> 1 THEN RAISE EXCEPTION 'automation count is %', n; END IF;

    -- A second path to the SAME automation must not double-count it: "counted
    -- once per instance, not per reference" is what the header sum proves.
    INSERT INTO public.action_types (ontology_id, api_name, label)
      VALUES (ont, 'ground-it', 'Ground it') RETURNING id INTO act;
    INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
      VALUES (act, 'modify_object', 1, ot);
    -- Editing effects takes ownership (517), and the probe holds no claims. The
    -- rule is worth obeying rather than working around, so the insert runs as
    -- the owner and the claim is dropped immediately after — the dependent
    -- queries below must run unauthenticated to read as the migration does.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', usr::text)::text, true);
    INSERT INTO public.automation_effects (automation_id, position, kind, action_type_id)
      VALUES (auto, 1, 'action', act);
    PERFORM set_config('request.jwt.claims', '', true);

    SELECT dependents INTO n FROM public.object_type_dependent_counts(ot) WHERE kind = 'automation';
    IF n <> 1 THEN
      RAISE EXCEPTION 'one automation reaching the type two ways counted % times', n;
    END IF;

    -- And an unrelated object type has none of it.
    SELECT sum(dependents) INTO total FROM public.object_type_dependent_counts(other);
    IF total <> 0 THEN RAISE EXCEPTION 'a bystander object type had % dependents', total; END IF;

    RAISE EXCEPTION 'probe580:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe580:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe580';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '580: a dependent is an application that uses this';
END $do$;

COMMIT;
