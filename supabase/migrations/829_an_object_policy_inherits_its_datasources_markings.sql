-- An object security policy inherits its datasources' markings, minus what it
-- stops, plus what it adds.
--
-- The third of the four slots in the Compose dialog. 821 built `Granular policy`;
-- this builds `Markings`. The model is stated in one paragraph:
--
--   "By default, an object security policy will inherit all mandatory controls from its data sources. These include [markings](/docs/foundry/security/markings/), [organizations](/docs/foundry/security/orgs-and-spaces/#organizations), and [classifications](/docs/foundry/security/classification-based-access-controls/)."
--   — object-permissioning/object-security-policies.md
--
--   "The object security policy can then be further customized to add new mandatory controls and remove inherited mandatory controls that are no longer necessary."
--   — object-permissioning/object-security-policies.md
--
-- Two mutations over a computed baseline, never a stored list.
--
-- THE DENIAL SHAPE DECIDES THE SEAM, AND MY FIRST DRAFT PUT IT IN THE WRONG
-- PLACE. I had this composing into object_type_instances_readable, the guard
-- 825 pointed four readers at. That guard answers whether the object type
-- exists for you at all, and three of its four callers RAISE
-- Ontology:ObjectTypeNotFound on false. The page says something different, twice:
--
--   "If a user does not pass the object security policy, the object instance will not be viewable to that user."
--   — object-permissioning/object-security-policies.md
--
--   "In the **Markings** configuration, stop inheriting the `PII` and `VIP` markings so that users without those markings can see object instances."
--   — object-permissioning/object-security-policies.md
--
-- The INSTANCES are not viewable. The type does not disappear. So this belongs
-- beside the granular arm, in object_read_predicate, where failing it yields no
-- rows — exactly what 821 does for the other half of the same policy. The two
-- marking sets now have two honest denial shapes:
--
--   the object type's own markings (819, Compass)   the TYPE is hidden
--   the policy's mandatory controls (here)          the INSTANCES are not viewable
--
-- IT COMPOSES, IT DOES NOT REPLACE. The access conditions are a three-item list
-- — Viewer on the object type, passing a granular policy, passing the marking,
-- organization or classification checks — so item three is added to item two
-- rather than swapped for it. The decoupling sentence is narrower than it first
-- reads: it gives up Viewer on the DATA SOURCES, not on the object type.
--
--   "When an object or property security policy is configured, users do not need `Viewer` permissions to the object type's backing data sources to view object instances."
--   — object-permissioning/object-security-policies.md
--
-- A STOP IS PER SOURCE. The api states the rule and its failure mode, with the
-- field nested inside each backing dataset rather than beside them:
--
--   "Markings listed here will not be inherited from this backing dataset. The caller must have the DECLASSIFY permission on each marking listed here. If multiple backing datasets have the same marking applied, the marking must be listed for each backing dataset or it will still be inherited."
--   — api/datasets-v2-resources-views-add-backing-datasets.md
--
--   "Each of these keyphrases must be specified on **every** input that requires removal of Markings or Organizations."
--   — building-pipelines/remove-inherited-markings.md
--
-- An ADD has no source, so it is a separate table with a two-column key rather
-- than a nullable datasource meaning "not inherited".
--
-- ORGANIZATION MARKINGS ARE REFUSED HERE, and this reverses what I first wrote.
-- 828 made organizations a disjunctive marking category, so the EVALUATOR needs
-- no special case — and I took that to mean the authoring surface needed none
-- either. The api refuses exactly that conflation, by name:
--
--   "Adding an organization marking as a regular marking is not supported. Use the organization endpoints on a project resource instead."
--   — api/filesystem-v2-resources-resources-add-markings.md
--
-- and the enumeration of where each attaches agrees:
--
--   "The scope of information protected by organizations includes spaces, ontologies, projects, users, groups, tag categories, and collections. However, individual resources cannot be tied to an organization. In comparison, markings can only be applied to projects and resources."
--   — security/orgs-and-spaces.md
--
-- osp-permissions-ui-overview.png draws them as two peer cards with two separate
-- Manage links, and both Access-requirements captures contain exactly one
-- section, headed `Markings`. So this migration builds the Markings slot only.
-- An inherited organization marking still reaches the baseline and is still
-- enforced; it simply cannot be stopped or added here, which matches the fact
-- that the only published organization removal is per pipeline input.
--
-- WHAT A STOP CAN REACH, stated because the schema permits more than the reading
-- does. effective_file_markings folds a dataset's folder and project markings
-- into its set, so those become stoppable through a datasource edge, while the
-- object type's own project marking arrives through effective_object_type_markings
-- and is not stoppable. That asymmetry is deliberate and published on the
-- pipeline side — "Move your output to a separate project if you need to remove
-- an organization that is on the existing project" — but it is load-bearing, so
-- it is written down rather than left for the next reader to discover.
--
-- NOT BUILT: classifications. The api publishes `markingType · one of MANDATORY,
-- CBAC` on a marking category, so a classification is a category of marking we
-- do not populate rather than a slot we failed to build.

-- ── 1. What one datasource contributes ────────────────────────────────────
-- ALL FOUR BACKING KINDS, because object_type_datasources' own CHECK enumerates
-- four and the page says a policy inherits from its data sources without
-- qualification. My first draft covered two and fell through to an empty set for
-- the other two, which is a silent zero where a sentence says otherwise.
create or replace function public.datasource_markings(p_datasource uuid)
returns uuid[] language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce((
    SELECT CASE
      WHEN d.dataset_id IS NOT NULL THEN
        public.effective_file_markings('dataset', d.dataset_id)
        || public.effective_data_markings(d.dataset_id)
      WHEN d.restricted_view_id IS NOT NULL THEN
        public.restricted_view_markings(d.restricted_view_id)
      WHEN d.time_series_sync_id IS NOT NULL THEN
        -- "Time series syncs inherit all markings of their input dataset."
        -- (time-series/time-series-permissions) — the same union 774 and 786
        -- already take of a sync's input.
        coalesce((SELECT public.effective_file_markings('dataset', s.input_dataset_id)
                      || public.effective_data_markings(s.input_dataset_id)
                    FROM public.time_series_syncs s WHERE s.id = d.time_series_sync_id),
                 '{}'::uuid[])
      ELSE
        -- A media-set datasource. resource_marking_kinds() has no media_set
        -- member, so there is no local resource whose markings we could read;
        -- this is an empty set BECAUSE WE CANNOT SEE THEM, not because there are
        -- none. The media page says the opposite — "stopping inheritance only
        -- affects this object and does not remove the marking from the backing
        -- media set itself" — so a media set does carry markings we do not hold.
        '{}'::uuid[]
    END
    FROM public.object_type_datasources d
   WHERE d.id = p_datasource), '{}'::uuid[])
$$;

comment on function public.datasource_markings(uuid) is
  'The markings one object type datasource contributes to a policy''s inherited baseline, across all four backing kinds the table''s CHECK enumerates. A media-set datasource returns an empty set because we hold no media set markings, not because it has none — see the migration header.';

-- ── 2. The two mutations ──────────────────────────────────────────────────
-- The parents gain the composite unique keys the child FKs need, so a stop
-- cannot name a datasource belonging to some other object type. 826 hit exactly
-- this and wrote down why: a composite foreign key keeps it honest rather than
-- merely copied. Without it such a row inserts happily and is then filtered out
-- by the join inside object_policy_markings — Stop inheriting appears to work
-- and the marking keeps hiding the instances.
alter table public.object_security_policies add constraint object_security_policies_id_object_type_key
  unique (id, object_type_id);
alter table public.object_type_datasources  add constraint object_type_datasources_id_object_type_key
  unique (id, object_type_id);

create table public.object_policy_marking_stops (
  policy_id      uuid not null,
  object_type_id uuid not null,
  datasource_id  uuid not null,
  marking_id     uuid not null references public.markings(id) on delete cascade,
  stopped_by     uuid references public.users(id) on delete set null,
  stopped_at     timestamptz not null default now(),
  primary key (policy_id, datasource_id, marking_id),
  foreign key (policy_id, object_type_id)
    references public.object_security_policies (id, object_type_id) on delete cascade,
  foreign key (datasource_id, object_type_id)
    references public.object_type_datasources (id, object_type_id) on delete cascade
);

comment on table public.object_policy_marking_stops is
  'One inherited marking this object security policy stops inheriting FROM ONE DATASOURCE — "If multiple backing datasets have the same marking applied, the marking must be listed for each backing dataset or it will still be inherited" (api/datasets-v2-resources-views-add-backing-datasets). Stopping does not remove the marking from the datasource. Organization markings are refused here; see guard_object_policy_marking.';

create index object_policy_marking_stops_datasource_idx on public.object_policy_marking_stops (datasource_id);
create index object_policy_marking_stops_marking_idx    on public.object_policy_marking_stops (marking_id);
create index object_policy_marking_stops_stopped_by_idx on public.object_policy_marking_stops (stopped_by);
create index object_policy_marking_stops_type_idx       on public.object_policy_marking_stops (object_type_id);

create table public.object_policy_marking_adds (
  policy_id  uuid not null references public.object_security_policies(id) on delete cascade,
  marking_id uuid not null references public.markings(id) on delete cascade,
  added_by   uuid references public.users(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (policy_id, marking_id)
);

comment on table public.object_policy_marking_adds is
  'A mandatory control this object security policy requires that no datasource supplied — "further customized to add new mandatory controls" (object-permissioning/object-security-policies). No datasource column, because an added control is inherited from nothing.';

create index object_policy_marking_adds_marking_idx  on public.object_policy_marking_adds (marking_id);
create index object_policy_marking_adds_added_by_idx on public.object_policy_marking_adds (added_by);

-- ── 3. The effective set ──────────────────────────────────────────────────
create or replace function public.object_policy_markings(p_policy uuid)
returns uuid[] language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  WITH inherited AS (
    SELECT m.id AS marking_id
      FROM public.object_security_policies p
      JOIN public.object_type_datasources d ON d.object_type_id = p.object_type_id
      CROSS JOIN LATERAL unnest(public.datasource_markings(d.id)) AS m(id)
     WHERE p.id = p_policy
       AND NOT EXISTS (
         SELECT 1 FROM public.object_policy_marking_stops s
          WHERE s.policy_id = p_policy
            AND s.datasource_id = d.id
            AND s.marking_id = m.id)
  ), added AS (
    SELECT a.marking_id FROM public.object_policy_marking_adds a WHERE a.policy_id = p_policy
  )
  SELECT coalesce(array_agg(DISTINCT x.marking_id), '{}'::uuid[])
    FROM (SELECT marking_id FROM inherited UNION SELECT marking_id FROM added) x
$$;

comment on function public.object_policy_markings(uuid) is
  'An object security policy''s effective mandatory controls: everything its datasources supply, minus what it stopped from each of them, plus what it added. A marking stopped from one datasource still arrives from another that supplies it.';

create or replace function public.object_type_policy_markings(p_object_type uuid)
returns uuid[] language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce((
    SELECT public.object_policy_markings(p.id)
      FROM public.object_security_policies p
     WHERE p.object_type_id = p_object_type), '{}'::uuid[])
$$;

comment on function public.object_type_policy_markings(uuid) is
  'The mandatory controls an object type''s security policy demands, or none when it has no policy. satisfies_markings of an empty array is true, so an unpolicied type is unaffected. Safe as a scalar subquery because object_security_policies.object_type_id is UNIQUE (821).';

-- ── 4. Who may author a mutation, and what may be mutated ─────────────────
-- The api names the permission for a stop and 483 already implemented it for
-- restricted views: "The caller must have the DECLASSIFY permission on each
-- marking listed here." Ours is the `remove` permission from 399's vocabulary,
-- and the mirror-image for an add is `apply`.
create or replace function public.guard_object_policy_marking()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$
DECLARE v_needed text := CASE TG_TABLE_NAME WHEN 'object_policy_marking_stops' THEN 'remove' ELSE 'apply' END;
BEGIN
  -- The Markings slot is not the Organizations slot.
  IF EXISTS (SELECT 1 FROM public.markings m
               JOIN public.marking_categories c ON c.id = m.category_id
              WHERE m.id = NEW.marking_id
                AND c.organization_id IS NULL AND c.name = 'Organizations') THEN
    RAISE EXCEPTION 'Markings:OrganizationMarkingNotSupported — an organization marking cannot be stopped or added as a regular marking'
      USING HINT = 'Use the organization endpoints on a project resource instead.';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.holds_marking_permission(NEW.marking_id, auth.uid(), v_needed) THEN
    RAISE EXCEPTION 'Markings:CannotMutatePolicyControl — this takes the % permission on that marking', v_needed;
  END IF;
  RETURN NEW;
END $$;

create trigger guard_object_policy_marking_stop
  before insert or update on public.object_policy_marking_stops
  for each row execute function public.guard_object_policy_marking();

create trigger guard_object_policy_marking_add
  before insert or update on public.object_policy_marking_adds
  for each row execute function public.guard_object_policy_marking();

alter table public.object_policy_marking_stops enable row level security;
alter table public.object_policy_marking_adds  enable row level security;

create policy "read policy marking stops of visible object types"
  on public.object_policy_marking_stops for select to authenticated
  using (exists (select 1 from public.object_types t
                  where t.id = object_type_id and public.auth_in_ontology(t.ontology_id)));

create policy "project owners stop inherited markings"
  on public.object_policy_marking_stops for insert to authenticated
  with check (public.object_type_owner(object_type_id));

create policy "project owners start inheriting again"
  on public.object_policy_marking_stops for delete to authenticated
  using (public.object_type_owner(object_type_id));

create policy "read policy marking adds of visible object types"
  on public.object_policy_marking_adds for select to authenticated
  using (exists (select 1 from public.object_security_policies p
                  join public.object_types t on t.id = p.object_type_id
                 where p.id = policy_id and public.auth_in_ontology(t.ontology_id)));

create policy "project owners add mandatory controls"
  on public.object_policy_marking_adds for insert to authenticated
  with check (exists (select 1 from public.object_security_policies p
                       where p.id = policy_id and public.object_type_owner(p.object_type_id)));

create policy "project owners remove added mandatory controls"
  on public.object_policy_marking_adds for delete to authenticated
  using (exists (select 1 from public.object_security_policies p
                  where p.id = policy_id and public.object_type_owner(p.object_type_id)));

-- ── 5. The third conjunct, beside the granular arm rather than above it ───
-- PATCHED, NOT RETYPED, from pg_get_functiondef. The marking set is uniform
-- across rows, so it is evaluated once here and collapses to a constant `false`
-- rather than becoming a per-row call inside the emitted SQL.
DO $patch$
DECLARE src text; out text;
BEGIN
  src := pg_get_functiondef('public.object_read_predicate(uuid,text)'::regprocedure);
  out := replace(src,
    '  SELECT coalesce(public.object_security_predicate(p_object_type, p_alias),' || E'\n' ||
    '                  public.restricted_view_predicate(p_object_type, p_alias))',
    '  SELECT CASE' || E'\n' ||
    '    WHEN NOT public.satisfies_markings(public.object_type_policy_markings(p_object_type))' || E'\n' ||
    '      THEN ''false''' || E'\n' ||
    '    ELSE coalesce(public.object_security_predicate(p_object_type, p_alias),' || E'\n' ||
    '                  public.restricted_view_predicate(p_object_type, p_alias))' || E'\n' ||
    '  END');
  IF out = src THEN
    RAISE EXCEPTION 'PATCH FAILED: object_read_predicate does not carry the expected coalesce';
  END IF;
  EXECUTE out;
  RAISE NOTICE 'PATCHED: the row filter now carries the policy''s mandatory controls';
END $patch$;

comment on function public.object_read_predicate(uuid, text) is
  'The row filter for one object type: false when the caller fails the policy''s mandatory controls, otherwise its object security policy if it has one and its datasource''s restricted view policy if not. Failing a mandatory control yields NO ROWS rather than hiding the type — "the object instance will not be viewable to that user" (object-permissioning/object-security-policies).';

-- PROVED BY DOING, as `authenticated`, on the real indexed object type.
--
-- The fixture marks the BACKING DATASET, because that is where a baseline comes
-- from; nothing marks the object type, so this proves the new conjunct and not
-- 819's. The caller is granted apply and remove on the fixture markings, because
-- holds_marking_permission has no org-admin bootstrap and marking_permissions is
-- empty in this database — measured, not assumed.
DO $$
DECLARE
  v_ot uuid := '47516b65-f965-47b5-bab1-0a31901b641c';
  v_ds uuid; v_dataset uuid; v_user uuid; v_org uuid; v_role text;
  v_osp uuid; v_cat uuid; v_m uuid; v_extra uuid; v_orgmk uuid;
  v_seen int; v_all int; v_msg text; v_fired boolean;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT d.id, d.dataset_id INTO v_ds, v_dataset
    FROM public.object_type_datasources d WHERE d.object_type_id = v_ot AND d.dataset_id IS NOT NULL;
  IF v_user IS NULL OR v_ds IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user and a dataset-backed datasource';
  END IF;
  SELECT count(*) INTO v_all FROM objects.ot_47516b65f96547b5bab10a31901b641c;

  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-829', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name) VALUES (v_cat, 'zz-proof-829-inherited') RETURNING id INTO v_m;
  INSERT INTO public.markings (category_id, name) VALUES (v_cat, 'zz-proof-829-added')     RETURNING id INTO v_extra;
  -- apply BEFORE remove: "To remove a Marking, a user must also be able to apply
  -- the Marking" is a live guard (Markings:RemoveRequiresApply), and it fires on
  -- the row order within a single INSERT.
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    VALUES (v_m, v_user, 'apply'), (v_extra, v_user, 'apply');
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    VALUES (v_m, v_user, 'remove'), (v_extra, v_user, 'remove');
  INSERT INTO public.object_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'zz-829-object', v_user) RETURNING id INTO v_osp;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 0. A policy with no inherited markings demands nothing.
  IF public.object_policy_markings(v_osp) <> '{}'::uuid[] THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the datasource already contributes markings';
  END IF;
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: an unmarked policy already restricts (% of %)', v_seen, v_all;
  END IF;

  -- 1. INHERITANCE, AND THE DENIAL SHAPE. Mark the backing dataset; the policy
  --    picks it up and the instances go to ZERO ROWS. The count itself is the
  --    assertion: if this were routed through the type guard the call would
  --    raise instead, and the proof would abort here rather than report 0.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_m, 'dataset', v_dataset);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  IF NOT (v_m = ANY (public.object_policy_markings(v_osp))) THEN
    RAISE EXCEPTION 'PROOF FAILED: the policy did not inherit its datasource''s marking';
  END IF;
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: an inherited marking did not restrict the instances (% rows)', v_seen;
  END IF;
  RAISE NOTICE 'PROVED: an inherited marking yields no rows, and does not hide the type';

  -- 2. STOP INHERITING. The marking stays on the dataset; the policy stops
  --    demanding it. Both halves, because a stop that also un-marked the dataset
  --    would pass the second alone.
  INSERT INTO public.object_policy_marking_stops
    (policy_id, object_type_id, datasource_id, marking_id, stopped_by)
    VALUES (v_osp, v_ot, v_ds, v_m, v_user);
  IF v_m = ANY (public.object_policy_markings(v_osp)) THEN
    RAISE EXCEPTION 'PROOF FAILED: the stopped marking is still demanded';
  END IF;
  IF NOT (v_m = ANY (public.effective_file_markings('dataset', v_dataset))) THEN
    RAISE EXCEPTION 'PROOF FAILED: stopping inheritance removed the marking from the datasource';
  END IF;
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: instances still hidden after the stop (% of %)', v_seen, v_all;
  END IF;
  RAISE NOTICE 'PROVED: stopping inheritance frees the instances and leaves the datasource marked';

  -- 3. ADD. A control no datasource supplied.
  INSERT INTO public.object_policy_marking_adds (policy_id, marking_id, added_by)
    VALUES (v_osp, v_extra, v_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: an added marking did not restrict the instances';
  END IF;

  -- 4. Holding it opens them again, so the check is membership and not a
  --    constant false.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_extra, v_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: a member of the added marking still cannot read (% of %)', v_seen, v_all;
  END IF;
  RAISE NOTICE 'PROVED: an added control restricts, and holding it admits';

  -- 5. THE ORGANIZATIONS REFUSAL, by name. An organization marking belongs to
  --    the other slot and the api refuses this conflation explicitly.
  SELECT m.id INTO v_orgmk FROM public.markings m
    JOIN public.marking_categories c ON c.id = m.category_id
   WHERE c.organization_id IS NULL AND c.name = 'Organizations' LIMIT 1;
  IF v_orgmk IS NOT NULL THEN
    v_fired := false;
    BEGIN
      INSERT INTO public.object_policy_marking_adds (policy_id, marking_id, added_by)
        VALUES (v_osp, v_orgmk, v_user);
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    IF NOT v_fired OR v_msg NOT LIKE 'Markings:OrganizationMarkingNotSupported%' THEN
      RAISE EXCEPTION 'PROOF FAILED: an organization marking entered the Markings slot (%)',
        coalesce(v_msg, 'no error');
    END IF;
    RAISE NOTICE 'PROVED: an organization marking is refused by the Markings slot';
  END IF;

  -- 6. And a stop naming another object type's datasource cannot be written at
  --    all, rather than being written and silently ignored.
  v_fired := false;
  BEGIN
    INSERT INTO public.object_policy_marking_stops
      (policy_id, object_type_id, datasource_id, marking_id, stopped_by)
      VALUES (v_osp, v_ot, gen_random_uuid(), v_extra, v_user);
  EXCEPTION WHEN foreign_key_violation THEN v_fired := true;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: a stop naming an unrelated datasource was accepted';
  END IF;
  RAISE NOTICE 'PROVED: a stop cannot name a datasource outside its object type';

  DELETE FROM public.marking_members             WHERE marking_id IN (v_m, v_extra);
  DELETE FROM public.object_policy_marking_adds  WHERE policy_id = v_osp;
  DELETE FROM public.object_policy_marking_stops WHERE policy_id = v_osp;
  DELETE FROM public.marking_permissions         WHERE marking_id IN (v_m, v_extra);
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id IN (v_m, v_extra);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  DELETE FROM public.object_security_policies WHERE id = v_osp;
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings           WHERE id IN (v_m, v_extra);
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;

  -- The claims stay set until AFTER this read: clearing them first makes
  -- auth_in_ontology false and the call raises for the wrong reason.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: % instances readable after cleanup, expected %', v_seen, v_all;
  END IF;
  IF EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-829')
     OR EXISTS (SELECT 1 FROM public.object_security_policies WHERE name = 'zz-829-object') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed, % instances readable again', v_seen;
END $$;
