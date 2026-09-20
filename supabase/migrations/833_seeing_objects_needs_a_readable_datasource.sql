-- Seeing objects needs a readable datasource, unless a policy says otherwise.
--
-- Found by the first post-build reconciliation of this arc (832's header says why
-- there had not been one). Measured before writing: neither object_read_predicate
-- nor object_type_instances_readable mentions a datasource, so today any member
-- of the ontology reads the instances of any object type regardless of whether
-- they can read the data behind it. That is also the DEFAULT state, because the
-- requirement is only lifted once a security policy exists.
--
-- THE REQUIREMENT, stated on three pages:
--
--   "Migrating to projects does not change who has access to the backing datasource. To see objects, users continue to need permissions on both the object type and the datasource."
--   — object-permissioning/ontology-permissions.md
--
--   "Object visibility is governed by the permissions on the backing data source. You must hold View permissions on the backing data source to see the objects."
--   — object-permissioning/ontology-permissions.md
--
--   "To view objects of an object type backed by a dataset, you must also be able to view the dataset."
--   — object-permissioning/configuring-rv-access-controls.md
--
-- AND THE EXEMPTION, which is why this rule is conditional rather than absolute:
--
--   "When an object or property security policy is configured, users do not need `Viewer` permissions to the object type's backing data sources to view object instances."
--   — object-permissioning/object-security-policies.md
--
-- THE DENIAL SHAPE IS SETTLED BY AN ENUMERATION, AND THE DECIDING WORD IS `ANY`.
-- Two pages appear to disagree: the sentences above read as *no objects at all*,
-- while multi-datasource-objects.md has the properties of an unreadable
-- datasource coming back null. They are one rule, and the api names its error:
--
--   "The provided token does not have permission to view any data sources backing this object type. Ensure the object type has backing data sources configured and visible."
--   — api/general-overview-errors.md
--
-- A 403 that fires only when the caller can see NO datasource is exactly the
-- statement that seeing SOME is not an error. Its only parameter is the object
-- type, so it is raised for the TYPE and not per row. Hence:
--
--   zero readable datasources, no policy   the type is refused
--   at least one readable                  rows come back, and the properties of
--                                          the unreadable datasources are nulled
--
-- THIS MIGRATION BUILDS THE REFUSAL ARM ONLY. The per-datasource nulling is the
-- same rule's other half and needs a multi-datasource object type to mean
-- anything; the platform has one object type with one datasource. It is UNBUILT
-- rather than unpublished, and the sentence governing it is quoted above.
--
-- PERMISSION_DENIED, NOT NOT-FOUND. The api classifies this as PERMISSION_DENIED,
-- and we already have Ontology:ObjectTypeNotFound for a type you may not see at
-- all. Reusing that name would tell a caller the type does not exist when the
-- page says the opposite is still visible:
--
--   "To see an object type, you must have View permissions on the object type, but do not need View permissions for the backing datasource."
--   — object-permissioning/ontology-permissions.md
--
-- The schema stays visible; the data does not. The proof below checks both.
--
-- WHAT VIEWER ON THE DATASOURCE ACTUALLY IS HERE, measured rather than assumed,
-- because my first draft of this file guessed wrong and the dry run caught it.
-- can_read_dataset resolves through resource_file_access, which is (same
-- organization) AND markings AND the scoped session — there is no project role in
-- it. My first fixture tried to make a dataset unreadable by moving it to a
-- project the caller has no role in; the dataset stayed readable, because its
-- organization never changed. The mechanism that actually denies is a MARKING on
-- the datasource, which is also the mechanism the pages describe.
--
-- AND THE ARMS TAKE THE STRONGER FUNCTION, for the same reason. The dataset arm
-- is can_read_dataset_data, not can_read_dataset, because the page says:
--
--   "any user that has at least `Viewer` permissions on the dataset and its transactions will have access to all object instances created from that dataset."
--   — object-permissioning/managing-object-security.md
--
-- The dataset AND its transactions: the file and the data. can_read_dataset_data
-- is exactly that pair (can_read_dataset AND the effective DATA markings), and
-- the objects are the data.
--
-- THE RESTRICTED VIEW ARM IS DECIDED BY A TWO-ITEM ENUMERATION, and it overturned
-- what I first wrote, which was a bare existence check:
--
--   "To view objects of an object type backed by a restricted view in Object Storage v1 (Phonograph), you must be able to view the object type itself; you do not necessarily need to see the restricted view."
--   — object-permissioning/configuring-rv-access-controls.md
--
--   "In Object Storage v2, you must be able to see a restricted view to see objects of the object type backed by that restricted view."
--   — object-permissioning/configuring-rv-access-controls.md
--
-- We are v2, so seeing the view is required. Its ROW policy is the other half and
-- is already applied by restricted_view_predicate; this is the file half.
--
-- LATENT TODAY, AND SAYING SO IS THE POINT. resource_markings holds zero rows,
-- every datasource is in the caller's organization, and there is one object type
-- with one dataset datasource. So this rule refuses nothing right now — which is
-- the landing I want for a reader-wide change, and is why the proof below has to
-- MANUFACTURE the denial to show the rule exists at all.
--
-- ONE INTERACTION I MEASURED AND AM RECORDING RATHER THAN DISCOVERING LATER. A
-- caller with an organization claim and NO sub holds no markings, so on the day
-- any datasource is marked, that caller stops seeing those instances. That is the
-- 825 shape, and I checked it deliberately this time. It differs from 825 in the
-- way that matters: 825 refused a caller the pages never said to refuse, whereas
-- markings are mandatory controls and a caller holding none is supposed to be
-- refused marked data. It is consistent with every other marking check we have.

-- What one datasource requires of a caller, per backing kind.
create or replace function public.datasource_readable(p_datasource uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce((
    SELECT CASE
      WHEN d.dataset_id IS NOT NULL THEN public.can_read_dataset_data(d.dataset_id)
      WHEN d.restricted_view_id IS NOT NULL THEN
        coalesce((SELECT public.resource_file_access('restricted_view', v.id, v.organization_id)
                    FROM public.restricted_views v WHERE v.id = d.restricted_view_id), false)
      -- A sync carries its input dataset's markings (774), and no page gives it a
      -- Viewer requirement of its own, so it takes its input's.
      WHEN d.time_series_sync_id IS NOT NULL THEN
        coalesce((SELECT public.can_read_dataset_data(s.input_dataset_id)
                    FROM public.time_series_syncs s WHERE s.id = d.time_series_sync_id), false)
      -- A media set is a RID we hold no resource row for, so there is nothing to
      -- ask. True rather than false deliberately: refusing what cannot be
      -- evaluated would be stricter than Foundry, and this migration is about a
      -- requirement the pages state, not about the ones they do not.
      ELSE true
    END
    FROM public.object_type_datasources d
   WHERE d.id = p_datasource), false)
$$;

comment on function public.datasource_readable(uuid) is
  'Whether the caller may read one object type datasource — View permissions on the backing data source, per object-permissioning/ontology-permissions. A media-set datasource answers true because we hold no media set resource to ask; that is a recorded gap, not a claim that media sets are public.';

-- The type-level question the api names.
create or replace function public.object_type_data_readable(p_object_type uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT
    -- The exemption: a configured policy replaces the datasource requirement.
    EXISTS (SELECT 1 FROM public.object_security_policies p
             WHERE p.object_type_id = p_object_type)
    OR EXISTS (SELECT 1 FROM public.property_security_policies p
                WHERE p.object_type_id = p_object_type)
    -- No datasource configured is not what this error is about; it names the
    -- token's permission on the datasources that exist.
    OR NOT EXISTS (SELECT 1 FROM public.object_type_datasources d
                    WHERE d.object_type_id = p_object_type)
    -- ANY, so one readable datasource is enough.
    OR EXISTS (SELECT 1 FROM public.object_type_datasources d
                WHERE d.object_type_id = p_object_type
                  AND public.datasource_readable(d.id))
$$;

comment on function public.object_type_data_readable(uuid) is
  'Whether the caller may read this object type''s DATA: true when a security policy is configured (which replaces the requirement per object-permissioning/object-security-policies), or when at least one backing datasource is readable. The word any in the api''s ViewObjectPermissionDenied is what makes one enough.';

-- Patched into the live definitions, never retyped.
--
-- THE NEW CHECK GOES IN AHEAD OF THE OLD ONE, CARRYING ITS OWN RAISE. My first
-- attempt inserted the check AFTER the existing guard and then renamed the RAISE
-- that fell through to it — a second replace whose pattern assumed the newline
-- and indentation that follow the anchor. indexed_objects carries Windows
-- carriage returns and a blank line from an earlier patch, so that rename matched
-- in two readers and silently did nothing in the third, which then raised
-- ObjectTypeNotFound for a permission failure. Nothing caught it but the proof:
-- the patch block's own assertion only looked for object_type_data_readable,
-- which was present either way. A guard that passes is not evidence.
--
-- One self-contained replace cannot half-apply. The precedence is deliberate: the
-- new branch requires the type to be VISIBLE before it fires, so a type the
-- caller may not see at all still falls through to ObjectTypeNotFound, and only a
-- visible type with unreadable data reaches the permission error.
DO $patch$
DECLARE r record; src text; out text; n int := 0; still text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
       AND p.proname IN ('indexed_objects', 'evaluate_object_set', 'list_linked_objects')
  LOOP
    src := pg_get_functiondef(r.oid);
    out := replace(src,
      'IF ont IS NULL OR NOT public.object_type_instances_readable(p_object_type) THEN',
      'IF ont IS NOT NULL AND public.object_type_instances_readable(p_object_type)' || E'\n' ||
      '     AND NOT public.object_type_data_readable(p_object_type) THEN' || E'\n' ||
      '    RAISE EXCEPTION ''Ontology:ViewObjectPermissionDenied — you cannot view any data source backing %'', p_object_type;' || E'\n' ||
      '  END IF;' || E'\n' ||
      '  IF ont IS NULL OR NOT public.object_type_instances_readable(p_object_type) THEN');
    IF out = src THEN
      RAISE EXCEPTION 'PATCH FAILED: % does not carry the expected guard', r.proname;
    END IF;
    EXECUTE out;
    n := n + 1;
  END LOOP;
  IF n <> 3 THEN RAISE EXCEPTION 'PATCH FAILED: expected 3 readers, patched %', n; END IF;

  -- search_objects filters a set rather than raising, so it takes the same
  -- predicate as a filter: a type whose data you cannot read drops out.
  src := pg_get_functiondef('public.search_objects(text,integer)'::regprocedure);
  out := replace(src,
    'AND public.object_type_instances_readable(ot.id)',
    'AND public.object_type_instances_readable(ot.id)' || E'\n' ||
    '          AND public.object_type_data_readable(ot.id)');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: search_objects filter anchor did not match'; END IF;
  EXECUTE out;

  SELECT string_agg(p.proname, ', ') INTO still FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND p.proname IN ('indexed_objects', 'evaluate_object_set', 'list_linked_objects', 'search_objects')
     AND pg_get_functiondef(p.oid) NOT LIKE '%object_type_data_readable%';
  IF still IS NOT NULL THEN
    RAISE EXCEPTION 'PATCH FAILED: % does not ask the new rule', still;
  END IF;

  -- The assertion my first attempt was missing. Asking the rule is not the same
  -- as refusing under its own name, and that gap is what shipped a permission
  -- failure disguised as a missing object type.
  SELECT string_agg(p.proname, ', ') INTO still FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND p.proname IN ('indexed_objects', 'evaluate_object_set', 'list_linked_objects')
     AND pg_get_functiondef(p.oid) NOT LIKE '%ViewObjectPermissionDenied%';
  IF still IS NOT NULL THEN
    RAISE EXCEPTION 'PATCH FAILED: % asks the rule but refuses under the wrong name', still;
  END IF;
  RAISE NOTICE 'PATCHED: four readers require a readable datasource, three raise the named error';
END $patch$;


-- PROVED BY DOING, as `authenticated`, on the real indexed object type.
--
-- The fixture denies by MARKING the backing dataset, which is what the pages
-- describe and what I measured to be the only thing that actually denies here.
-- It earns the right to apply that marking rather than bypassing the guard,
-- which wants org-admin AND the apply permission.
--
-- THE FIXTURE UNWINDS IN A SUBTRANSACTION RATHER THAN BY DELETE, and that is
-- forced rather than stylistic: `Markings:NotDeletable — markings cannot be
-- deleted once created`. A mandatory control you could delete would not be
-- mandatory, so the guard is right and my first cleanup was wrong. A plpgsql
-- block with an EXCEPTION clause is a subtransaction; raising at the end of it
-- rolls the whole fixture back, while a real assertion failure re-raises and
-- still fails the migration. It also means a failure halfway through cannot
-- leave a marking behind, which DELETE-based cleanup could.
DO $$
DECLARE
  v_ot uuid := '47516b65-f965-47b5-bab1-0a31901b641c';
  v_user uuid; v_org uuid; v_role text; v_dataset uuid; v_ds uuid;
  v_cat uuid; v_marking uuid; v_osp uuid;
  v_seen int; v_all int; v_msg text; v_fired boolean; v_unwound boolean := false;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT d.id, d.dataset_id INTO v_ds, v_dataset
    FROM public.object_type_datasources d
   WHERE d.object_type_id = v_ot AND d.dataset_id IS NOT NULL;
  IF v_user IS NULL OR v_dataset IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user and a dataset-backed datasource';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  SELECT count(*) INTO v_all FROM objects.ot_47516b65f96547b5bab10a31901b641c;
  IF v_all < 1 THEN RAISE EXCEPTION 'PROOF CANNOT RUN: the index is empty'; END IF;

  BEGIN
    -- The proof mints its own marking, and the reason is a measurement: this
    -- platform has exactly ONE marking category, the system Organizations one,
    -- and all 53 markings live in it. There is no ordinary marking to borrow. An
    -- organization marking would not serve either, because 829's guard refuses to
    -- stop or add one as a regular marking and step 4b below does exactly that.
    INSERT INTO public.marking_categories (name, category_type, organization_id)
      VALUES ('zz-833-category', 'conjunctive', v_org) RETURNING id INTO v_cat;
    INSERT INTO public.markings (name, description, category_id, created_by_user_id)
      VALUES ('zz-833-marking', 'fixture for the datasource requirement proof', v_cat, v_user)
      RETURNING id INTO v_marking;
    IF public.marking_member(v_marking, v_user) THEN
      RAISE EXCEPTION 'PROOF CANNOT RUN: the caller already holds its own fixture marking';
    END IF;

    -- 0. Unmarked: the rule changes nothing for a legitimate caller.
    IF NOT public.object_type_data_readable(v_ot) THEN
      RAISE EXCEPTION 'PROOF FAILED: an unmarked datasource is reported unreadable';
    END IF;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
    RESET ROLE;
    IF v_seen <> v_all THEN
      RAISE EXCEPTION 'PROOF FAILED: the new rule already restricts (% of %)', v_seen, v_all;
    END IF;
    RAISE NOTICE 'PROVED: an unmarked datasource is unaffected — % instances', v_seen;

    -- 1. THE HOLE. Mark the dataset with something the caller does not hold.
    INSERT INTO public.marking_permissions (marking_id, user_id, permission)
      VALUES (v_marking, v_user, 'apply'), (v_marking, v_user, 'remove');
    INSERT INTO public.resource_markings (resource_kind, resource_id, marking_id)
      VALUES ('dataset', v_dataset, v_marking);

    IF public.can_read_dataset_data(v_dataset) THEN
      RAISE EXCEPTION 'PROOF CANNOT RUN: the dataset is still readable while marked';
    END IF;
    -- And the OLD rule still admits the caller, which is exactly the gap: an
    -- object type's own markings never included its datasource's.
    IF NOT public.object_type_instances_readable(v_ot) THEN
      RAISE EXCEPTION 'PROOF INCONCLUSIVE: the pre-existing rule refuses too, so this proves nothing';
    END IF;

    SET LOCAL ROLE authenticated;
    v_fired := false;
    BEGIN
      PERFORM public.indexed_objects(v_ot, 100);
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    RESET ROLE;
    IF NOT v_fired OR v_msg NOT LIKE 'Ontology:ViewObjectPermissionDenied%' THEN
      RAISE EXCEPTION 'PROOF FAILED: objects still readable without their datasource (%)',
        coalesce(v_msg, 'no error');
    END IF;
    RAISE NOTICE 'PROVED: no readable datasource, no objects — %', left(v_msg, 52);

    -- 2. AND IT IS NOT A NOT-FOUND. The type itself stays visible.
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_seen FROM public.object_types WHERE id = v_ot;
    RESET ROLE;
    IF v_seen <> 1 THEN
      RAISE EXCEPTION 'PROOF FAILED: the object type itself disappeared';
    END IF;
    RAISE NOTICE 'PROVED: the schema stays visible while the data does not';

    -- 3. Search drops the type instead of raising.
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_seen FROM public.search_objects('a', 50) s
     WHERE s.object_type_id = v_ot;
    RESET ROLE;
    IF v_seen <> 0 THEN
      RAISE EXCEPTION 'PROOF FAILED: search still returns % rows of an unreadable type', v_seen;
    END IF;
    RAISE NOTICE 'PROVED: search drops a type whose data the caller cannot read';

    -- 4a. THE EXEMPTION, which is the whole reason this rule is conditional. What
    --     it lifts is the REFUSAL: the call stops raising. It does not lift the
    --     marking, because 829 has a policy inherit its datasources' markings and
    --     a mandatory control is not escapable by configuring a policy. So the
    --     rows are still withheld here, and asserting that is the point — I
    --     expected all 8 back on the first run, and the two rules composing this
    --     way is the correct answer rather than the one I had in mind.
    INSERT INTO public.object_security_policies (object_type_id, name, created_by)
      VALUES (v_ot, 'zz-833-object', v_user) RETURNING id INTO v_osp;
    SET LOCAL ROLE authenticated;
    v_fired := false;
    BEGIN
      SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    RESET ROLE;
    IF v_fired THEN
      RAISE EXCEPTION 'PROOF FAILED: a policy did not lift the refusal (%)', v_msg;
    END IF;
    IF v_seen <> 0 THEN
      RAISE EXCEPTION 'PROOF FAILED: the inherited marking did not withhold the rows (% seen)', v_seen;
    END IF;
    RAISE NOTICE 'PROVED: a policy lifts the refusal, and the inherited marking still withholds the rows';

    -- 4b. AND THE DOCUMENTED ESCAPE PUTS THEM BACK. Stopping the inheritance of
    --     that one marking on that one datasource is the only thing between the
    --     caller and the data, which is what makes 4a a marking result rather
    --     than a lingering datasource-permission result.
    INSERT INTO public.object_policy_marking_stops
      (policy_id, object_type_id, datasource_id, marking_id, stopped_by)
      VALUES (v_osp, v_ot, v_ds, v_marking, v_user);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
    RESET ROLE;
    IF v_seen <> v_all THEN
      RAISE EXCEPTION 'PROOF FAILED: stopping the inherited marking did not restore the rows (% of %)',
        v_seen, v_all;
    END IF;
    RAISE NOTICE 'PROVED: stopping the inheritance restores all % instances', v_seen;

    RAISE EXCEPTION 'ZZ833_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ833_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN
    RAISE EXCEPTION 'PROOF FAILED: the fixture block did not reach its unwind';
  END IF;

  -- Outside the subtransaction: the fixture is gone and the platform reads as it
  -- did before. Checked by asking, because the unwind is the cleanup here.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: % instances readable after the unwind, expected %', v_seen, v_all;
  END IF;
  IF EXISTS (SELECT 1 FROM public.markings WHERE name = 'zz-833-marking')
     OR EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-833-category')
     OR EXISTS (SELECT 1 FROM public.object_security_policies WHERE name = 'zz-833-object')
     OR EXISTS (SELECT 1 FROM public.resource_markings WHERE resource_id = v_dataset) THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture survived the unwind';
  END IF;
  RAISE NOTICE 'PROVED: fixture unwound, % instances readable again', v_seen;
END $$;
