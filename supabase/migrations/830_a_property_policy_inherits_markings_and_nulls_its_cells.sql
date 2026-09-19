-- A property security policy inherits markings too, and failing them nulls its
-- cells rather than withholding the row.
--
-- The fourth and last slot. 826 and 827 built property security policies with a
-- granular arm only; this gives them the same `Markings` slot 829 gave the object
-- policy, and routes it to the denial shape the page states for property policies:
--
--   "If a user does not pass the object security policy, the object instance will not be viewable to that user. If they pass the object security policy but do not pass the property security policy, they will see a *null* value in place of the property value."
--   — object-permissioning/object-security-policies.md
--
-- I opened osp-add-marking-property-security-policy.png: the property policy's
-- Access requirements screen is the same screen as the object policy's, with the
-- same `Markings` heading, the same Add control, and rows in both states — one
-- tagged `Inherited` with `Stop inheriting`, one tagged `Removed` with `Start
-- inheriting`. So both mutations exist here, and the two policies hold their own
-- state over a shared baseline rather than sharing storage.
--
-- THE BASELINE SCOPE, WHICH IS THE ONE THING NOT PUBLISHED, AND WHICH SIDE I TOOK.
-- Measured: the inheritance sentence occurs ONCE in the mirror and its subject is
-- the OBJECT security policy. For a property policy the only published statement
-- about its configuration is the identity claim, made twice:
--
--   "These are identical to object security policies, except they only apply to a selection of properties."
--   — object-permissioning/object-security-policies.md
--
--   "The configuration settings for property security policies are identical to object security policies."
--   — object-permissioning/object-security-policies.md
--
-- So a property policy inherits from THE OBJECT TYPE'S DATASOURCES, exactly as the
-- object policy does. The alternative — inheriting only from the datasources
-- backing the covered properties — is attractive on a multi-datasource object type
-- and I did not take it, because the sentence it would rest on is about a DIFFERENT
-- MECHANISM. `mandatory-control-properties.md` says "Only the properties backed by
-- a specific datasource will be secured by the mandatory control in that
-- datasource", but the same page names its enforcer: "The mandatory controls are
-- enforced by backing the object type with a restricted view which has a policy
-- that requires users to satisfy the markings in the mapped column" — the
-- restricted view's own row policy, not a property security policy. Borrowing its
-- scoping rule would look like a citation and would not be one.
--
-- On a single-datasource object type the two readings are identical, which is every
-- object type we have and every object type the worked example uses. THE MDO CASE
-- IS UNDECIDED AND RECORDED AS SUCH — it is not refused, because no page refuses
-- it and being stricter than Foundry needs a reason.
--
-- AND IT FIXES A SILENT NO-OP IN 827. property_policy_nulls skips any policy whose
-- granular rules are absent — its own comment says why: "its markings slot is not
-- built yet (821)". That reason has now expired, and until this migration a
-- markings-only property policy nulled nothing at all. That is exactly step 7 of
-- the worked example, where the policy is given a marking and no rules. A refusal
-- whose reason has expired is the defect class the 779 arc is named for.

-- ── 1. The same two mutations, for the other policy kind ──────────────────
-- 826 already gave property_security_policies UNIQUE (id, object_type_id) and 829
-- gave object_type_datasources the same, so both composite FKs land without
-- further preparation.
create table public.property_policy_marking_stops (
  policy_id      uuid not null,
  object_type_id uuid not null,
  datasource_id  uuid not null,
  marking_id     uuid not null references public.markings(id) on delete cascade,
  stopped_by     uuid references public.users(id) on delete set null,
  stopped_at     timestamptz not null default now(),
  primary key (policy_id, datasource_id, marking_id),
  foreign key (policy_id, object_type_id)
    references public.property_security_policies (id, object_type_id) on delete cascade,
  foreign key (datasource_id, object_type_id)
    references public.object_type_datasources (id, object_type_id) on delete cascade
);

comment on table public.property_policy_marking_stops is
  'One inherited marking this property security policy stops inheriting from one datasource. Per-source for the same reason the object policy''s is (api/datasets-v2-resources-views-add-backing-datasets), and separate from the object policy''s because the two hold their own state over a shared baseline — osp-add-marking-property-security-policy.png shows a property policy with one marking Inherited and one Removed.';

create index property_policy_marking_stops_datasource_idx on public.property_policy_marking_stops (datasource_id);
create index property_policy_marking_stops_marking_idx    on public.property_policy_marking_stops (marking_id);
create index property_policy_marking_stops_stopped_by_idx on public.property_policy_marking_stops (stopped_by);
create index property_policy_marking_stops_type_idx       on public.property_policy_marking_stops (object_type_id);

create table public.property_policy_marking_adds (
  policy_id  uuid not null references public.property_security_policies(id) on delete cascade,
  marking_id uuid not null references public.markings(id) on delete cascade,
  added_by   uuid references public.users(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (policy_id, marking_id)
);

comment on table public.property_policy_marking_adds is
  'A mandatory control this property security policy requires that no datasource supplied. No datasource column, because an added control is inherited from nothing.';

create index property_policy_marking_adds_marking_idx  on public.property_policy_marking_adds (marking_id);
create index property_policy_marking_adds_added_by_idx on public.property_policy_marking_adds (added_by);

-- ── 2. The effective set ──────────────────────────────────────────────────
create or replace function public.property_policy_markings(p_policy uuid)
returns uuid[] language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  WITH inherited AS (
    SELECT m.id AS marking_id
      FROM public.property_security_policies p
      JOIN public.object_type_datasources d ON d.object_type_id = p.object_type_id
      CROSS JOIN LATERAL unnest(public.datasource_markings(d.id)) AS m(id)
     WHERE p.id = p_policy
       AND NOT EXISTS (
         SELECT 1 FROM public.property_policy_marking_stops s
          WHERE s.policy_id = p_policy
            AND s.datasource_id = d.id
            AND s.marking_id = m.id)
  ), added AS (
    SELECT a.marking_id FROM public.property_policy_marking_adds a WHERE a.policy_id = p_policy
  )
  SELECT coalesce(array_agg(DISTINCT x.marking_id), '{}'::uuid[])
    FROM (SELECT marking_id FROM inherited UNION SELECT marking_id FROM added) x
$$;

comment on function public.property_policy_markings(uuid) is
  'A property security policy''s effective mandatory controls, over the OBJECT TYPE''S datasources — "The configuration settings for property security policies are identical to object security policies" (object-permissioning/object-security-policies). Whether an MDO should instead scope the baseline to the covered properties'' datasources is unpublished and recorded in the 830 header; on a single-datasource type the two are the same set.';

-- ── 3. One guard serves both policy kinds ─────────────────────────────────
-- PATCHED, NOT RETYPED: 829's guard derived the permission from a literal table
-- name, which silently gives a property STOP the `apply` requirement instead of
-- `remove`. The suffix is the discriminator.
DO $patch$
DECLARE src text; out text;
BEGIN
  src := pg_get_functiondef('public.guard_object_policy_marking()'::regprocedure);
  out := replace(src,
    'CASE TG_TABLE_NAME WHEN ''object_policy_marking_stops'' THEN ''remove'' ELSE ''apply'' END',
    'CASE WHEN TG_TABLE_NAME LIKE ''%\_stops'' THEN ''remove'' ELSE ''apply'' END');
  IF out = src THEN
    RAISE EXCEPTION 'PATCH FAILED: guard_object_policy_marking does not carry the expected permission CASE';
  END IF;
  EXECUTE out;
END $patch$;

create trigger guard_property_policy_marking_stop
  before insert or update on public.property_policy_marking_stops
  for each row execute function public.guard_object_policy_marking();

create trigger guard_property_policy_marking_add
  before insert or update on public.property_policy_marking_adds
  for each row execute function public.guard_object_policy_marking();

alter table public.property_policy_marking_stops enable row level security;
alter table public.property_policy_marking_adds  enable row level security;

create policy "read property policy stops of visible object types"
  on public.property_policy_marking_stops for select to authenticated
  using (exists (select 1 from public.object_types t
                  where t.id = object_type_id and public.auth_in_ontology(t.ontology_id)));
create policy "project owners stop inherited property markings"
  on public.property_policy_marking_stops for insert to authenticated
  with check (public.object_type_owner(object_type_id));
create policy "project owners start inheriting property markings"
  on public.property_policy_marking_stops for delete to authenticated
  using (public.object_type_owner(object_type_id));

create policy "read property policy adds of visible object types"
  on public.property_policy_marking_adds for select to authenticated
  using (exists (select 1 from public.property_security_policies p
                  join public.object_types t on t.id = p.object_type_id
                 where p.id = policy_id and public.auth_in_ontology(t.ontology_id)));
create policy "project owners add property mandatory controls"
  on public.property_policy_marking_adds for insert to authenticated
  with check (exists (select 1 from public.property_security_policies p
                       where p.id = policy_id and public.object_type_owner(p.object_type_id)));
create policy "project owners remove property mandatory controls"
  on public.property_policy_marking_adds for delete to authenticated
  using (exists (select 1 from public.property_security_policies p
                  where p.id = policy_id and public.object_type_owner(p.object_type_id)));

-- ── 4. The projection learns the markings slot ────────────────────────────
-- Three single-line patches from pg_get_functiondef. The marking check is
-- evaluated HERE, in plpgsql, and collapses to an unconditional null-merge —
-- not spliced into the per-row CASE. A policy's marking set does not vary by
-- row, and satisfies_markings is a three-CTE query that would otherwise run once
-- per output row, which is the cost shape 619 measured.
DO $patch$
DECLARE src text; out text; prev text;
BEGIN
  src := pg_get_functiondef('public.property_policy_nulls(uuid,text)'::regprocedure);

  prev := src;
  src := replace(src, 'SELECT pp.policy,', 'SELECT pp.id, pp.policy,');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the policy select anchor did not match'; END IF;

  prev := src;
  src := replace(src,
    '-- rules has nothing to fail — its markings slot is not built yet (821).',
    '-- rules and a satisfied markings slot has nothing to fail (830).');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the stale comment anchor did not match'; END IF;

  prev := src;
  src := replace(src,
    'CONTINUE WHEN r.covered IS NULL OR r.policy IS NULL;',
    'CONTINUE WHEN r.covered IS NULL;' || E'\n' ||
    '    -- Failing the markings slot nulls the covered cells outright, whatever' || E'\n' ||
    '    -- the granular rules would have said — the two are conjunctive and this' || E'\n' ||
    '    -- one is already decided for this caller.' || E'\n' ||
    '    IF NOT public.satisfies_markings(public.property_policy_markings(r.id)) THEN' || E'\n' ||
    '      parts := parts || format('' || %L::jsonb'', r.covered::text);' || E'\n' ||
    '      CONTINUE;' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    CONTINUE WHEN r.policy IS NULL;');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the continue anchor did not match'; END IF;

  EXECUTE src;
  RAISE NOTICE 'PATCHED: the projection nulls a cell whose property policy markings fail';
END $patch$;

-- PROVED BY DOING, as `authenticated`, and the proof IS the page's worked example.
--
-- Step 4 stops the marking on the OBJECT policy "so that users without those
-- markings can see object instances"; step 7 lets the PROPERTY policy re-require
-- it for a selection of properties. Without step 4 the object policy would hide
-- every row and nothing about property-level nulling could be observed — which is
-- precisely why Foundry's walkthrough is ordered that way.
DO $$
DECLARE
  v_ot uuid := '47516b65-f965-47b5-bab1-0a31901b641c';
  v_ds uuid; v_dataset uuid; v_user uuid; v_org uuid; v_role text;
  v_osp uuid; v_psp uuid; v_cat uuid; v_m uuid; v_orgmk uuid;
  v_row jsonb; v_seen int; v_all int; v_msg text; v_fired boolean;
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
    VALUES ('zz-proof-830', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name) VALUES (v_cat, 'zz-proof-830-pii') RETURNING id INTO v_m;
  -- apply before remove: Markings:RemoveRequiresApply fires on row order (829).
  INSERT INTO public.marking_permissions (marking_id, user_id, permission) VALUES (v_m, v_user, 'apply');
  INSERT INTO public.marking_permissions (marking_id, user_id, permission) VALUES (v_m, v_user, 'remove');

  -- The backing dataset carries the marking, as the walkthrough's does.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_m, 'dataset', v_dataset);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  INSERT INTO public.object_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'zz-830-object', v_user) RETURNING id INTO v_osp;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- STEP 4. Stop it on the object policy, so instances are visible again.
  INSERT INTO public.object_policy_marking_stops
    (policy_id, object_type_id, datasource_id, marking_id, stopped_by)
    VALUES (v_osp, v_ot, v_ds, v_m, v_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: step 4 did not restore the instances (% of %)', v_seen, v_all;
  END IF;

  -- STEP 7. A property policy over two properties, with NO granular rules —
  -- the markings-only shape that nulled nothing before this migration.
  INSERT INTO public.property_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'zz-830-hide', v_user) RETURNING id INTO v_psp;
  INSERT INTO public.property_security_policy_properties (policy_id, object_type_id, property_id)
    VALUES (v_psp, v_ot, 'model'), (v_psp, v_ot, 'manufacturer');

  IF NOT (v_m = ANY (public.property_policy_markings(v_psp))) THEN
    RAISE EXCEPTION 'PROOF FAILED: the property policy did not inherit the datasource marking';
  END IF;

  -- 1. THE SHAPE. The row is returned, the keys are present, the values are null,
  --    and an uncovered property is untouched. All four, because any one alone
  --    would pass against the wrong feature.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  SELECT rr INTO v_row FROM public.indexed_objects(v_ot, 1) rr;
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: a property policy withheld rows (% of %)', v_seen, v_all;
  END IF;
  IF NOT (v_row ? 'model') OR NOT (v_row ? 'manufacturer') THEN
    RAISE EXCEPTION 'PROOF FAILED: a denied property lost its key: %', v_row;
  END IF;
  IF v_row->'model' <> 'null'::jsonb OR v_row->'manufacturer' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'PROOF FAILED: a denied property kept its value: %', v_row;
  END IF;
  IF v_row->>'tail_number' IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: an uncovered property was nulled too: %', v_row;
  END IF;
  RAISE NOTICE 'PROVED: a markings-only property policy nulls its cells and keeps the row';

  -- 2. STOP INHERITING on the property policy: the values come back.
  INSERT INTO public.property_policy_marking_stops
    (policy_id, object_type_id, datasource_id, marking_id, stopped_by)
    VALUES (v_psp, v_ot, v_ds, v_m, v_user);
  SET LOCAL ROLE authenticated;
  SELECT rr INTO v_row FROM public.indexed_objects(v_ot, 1) rr;
  RESET ROLE;
  IF v_row->>'model' IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: stopping inheritance did not restore the value: %', v_row;
  END IF;
  RAISE NOTICE 'PROVED: stopping inheritance on the property policy restores the values';

  -- 3. And holding the marking works too, so the check is membership and not the
  --    stop alone. Start inheriting again, then join the marking.
  DELETE FROM public.property_policy_marking_stops WHERE policy_id = v_psp;
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_m, v_user);
  SET LOCAL ROLE authenticated;
  SELECT rr INTO v_row FROM public.indexed_objects(v_ot, 1) rr;
  RESET ROLE;
  IF v_row->>'model' IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: a member of the marking still sees null: %', v_row;
  END IF;
  RAISE NOTICE 'PROVED: holding the marking restores the values without a stop';

  -- 4. The organizations refusal applies to this slot too.
  SELECT m.id INTO v_orgmk FROM public.markings m
    JOIN public.marking_categories c ON c.id = m.category_id
   WHERE c.organization_id IS NULL AND c.name = 'Organizations' LIMIT 1;
  IF v_orgmk IS NOT NULL THEN
    v_fired := false;
    BEGIN
      INSERT INTO public.property_policy_marking_adds (policy_id, marking_id, added_by)
        VALUES (v_psp, v_orgmk, v_user);
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    IF NOT v_fired OR v_msg NOT LIKE 'Markings:OrganizationMarkingNotSupported%' THEN
      RAISE EXCEPTION 'PROOF FAILED: an organization marking entered the property Markings slot (%)',
        coalesce(v_msg, 'no error');
    END IF;
    RAISE NOTICE 'PROVED: an organization marking is refused by the property Markings slot';
  END IF;

  DELETE FROM public.marking_members              WHERE marking_id = v_m;
  DELETE FROM public.property_policy_marking_adds  WHERE policy_id = v_psp;
  DELETE FROM public.property_policy_marking_stops WHERE policy_id = v_psp;
  DELETE FROM public.property_security_policies    WHERE id = v_psp;
  DELETE FROM public.object_policy_marking_stops   WHERE policy_id = v_osp;
  DELETE FROM public.object_security_policies      WHERE id = v_osp;
  DELETE FROM public.marking_permissions           WHERE marking_id = v_m;
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = v_m;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings           WHERE id = v_m;
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;

  -- Claims stay set until after this read, or auth_in_ontology is false and the
  -- call raises for the wrong reason (829).
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  SELECT rr INTO v_row FROM public.indexed_objects(v_ot, 1) rr;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v_seen <> v_all OR v_row->>'model' IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: the fixture left the read path changed (% rows, model %)',
      v_seen, coalesce(v_row->>'model', 'null');
  END IF;
  IF EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-830')
     OR EXISTS (SELECT 1 FROM public.property_security_policies WHERE name = 'zz-830-hide') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed, % instances readable with values intact', v_seen;
END $$;
