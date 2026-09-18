-- An object security policy decides which instances a caller sees.
--
-- The biggest remaining item of ONTOLOGY-JOURNEY-GAPS §1, and the row of that
-- document I got wrong. It says the ontology has "nothing in any layer" for
-- row-level control and that the only row-level path "is bound to no object
-- type". That is false, and I wrote it. `restricted_view_predicate(p_object_type,
-- p_alias)` takes an object type, finds the datasource carrying a
-- restricted_view_id, compiles that view's policy through `granular_policy_sql`
-- and returns an EXISTS joined on the primary key. Five readers apply it on
-- every read. It is wired but unexercised — measured today: one datasource,
-- none backed by a restricted view, and no restricted views at all.
--
-- What is genuinely missing is narrower, and this migration is it: a granular
-- policy attached to the OBJECT TYPE rather than to a view under it.
--
--   "Object security policies allow you to configure view permissions on an object instance by configuring security policies on the object type, independently of the permissions on the backing data source."
--   — object-permissioning/object-security-policies.md

-- WHAT THE CAPTURES SETTLED, AND WHY THE EXISTING READING COULD NOT.
-- `docs/foundry-reference/readings/object-permissioning.md` opened 1 of the 22 captures on its pages —
-- my omission — and concluded from that one image that the dialog is a fixed
-- conjunction of four slots and that no rule language should be built. The
-- fourth slot is `Granular policy`, and behind its Manage link is a full
-- composer. I opened osp-add-granular-policy.png myself rather than take it
-- second-hand, and it prints its own definition:
--
--   "A granular policy is a combination of rules that describe what rows can be seen by different people"
--   — object-permissioning/images/osp-add-granular-policy.png
--
-- with a Match All/any selector, a draggable rule row, and an add-a-condition
-- affordance for nesting. That is the grammar 483 already built for restricted
-- views. So the correction is not to invent a rule language but to REUSE the
-- one we have: `granular_policy_sql(p_policy, p_fields, p_alias)` takes its
-- field list from the caller and is not bound to views at all.

-- DECISION 1: THE POLICY IS KEYED TO THE OBJECT TYPE, NOT THE DATASOURCE.
-- Two of my refuters disagreed on this, so I settled it from the prose. The
-- capture evidence for datasource-keying is that the policy row is labelled with
-- the datasource — a blue table link reading `passenger`. But that is the row's
-- NAME, not its key: step 2 creates it "to override data source policies with
-- object security policies", so it inherits the name of what it overrode. Three
-- sentences key it to the type, and one is decisive:
--
--   "**Unified cell-level security:** A single feature provides row-level (object security policies), column-level (property security policies), and cell-level permissions, rather than requiring a combination of restricted views (RVs) and multi-data source object types (MDOs)."
--   — object-permissioning/managing-object-security.md
--
-- A per-datasource policy IS the MDO model, which is the thing this feature
-- exists to replace. Structural evidence agrees: in
-- osp-object-security-policy-properties.png, which I opened, the section offers
-- only an add-property-security-policy button — there is no way to add a second
-- object policy — and the one that exists reads `All properties`, which on an
-- MDO would be more than its own datasource's. Hence UNIQUE on object_type_id.
--
-- The MDO case is not published on any page I read and is not invented here.

-- DECISION 2: IT OVERRIDES THE DATASOURCE POLICY, IT DOES NOT AND WITH IT.
-- The word is the page's own, twice over — step 2 above, and:
--
--   "When an object or property security policy is configured, users do not need `Viewer` permissions to the object type's backing data sources to view object instances."
--   — object-permissioning/object-security-policies.md
--
-- osp-permissions-ui-overview.png draws it as an arrow from a
-- `Datasource access requirements` column to a `Policy access requirements`
-- column — a replacement, not a conjunction. So object_read_predicate COALESCEs
-- rather than ANDs, and an object type with both keeps only the object policy.

-- SCOPE. This is the row-level half — the `Granular policy` slot. The markings
-- and organizations slots of the same dialog inherit from the datasource with an
-- explicit stop list, and property security policies null a value rather than
-- hide a row; both are their own chunk and neither is started here.

-- ── 1. The comparison Foundry's own worked example uses ────────────────────
-- osp-add-granular-policy.png's single rule reads `Current user markings
-- satisfies VIP`, and its operator dropdown shows `Satisfies`. That operator is
-- not among the eight on the comparisons list, and the page's weight table says
-- why it is its own thing:
--
--   "A marking condition is given a weight of 3,000."
--   — platform-security-management/manage-granular-policies.md
--
-- Three condition kinds are weighted there — a constant against a field at 1, a
-- collection against a field at 1,000, and a marking condition at 3,000 — so the
-- page itself treats a marking condition as neither of the other two. 483
-- already weighs it at 3,000; it simply had no operator that could reach it.
--
-- The right-hand term is a mandatory control property, which we have had since
-- 727 as `base_type = 'marking'` with allowed_markings and allowed_organizations
-- on the datasource, enforced by index_object_type at build time. Nothing read
-- it at query time until now.

-- PATCHED, NOT RETYPED, all three: pg_get_functiondef's own output with the
-- named lines replaced, and a RAISE if an anchor stops matching.

-- A marking-typed field is a collection AND a marking. Dataset schemas carry
-- STRING, LONG and DATE today and never MARKING, so no restricted view policy
-- changes meaning.
DO $patch$
DECLARE src text; out text;
BEGIN
  src := pg_get_functiondef('public.granular_term_shape(jsonb,jsonb)'::regprocedure);
  out := replace(src,
    'RETURN QUERY SELECT ''column'', (f->>''type'') = ''ARRAY'', false;',
    'RETURN QUERY SELECT ''column'', (f->>''type'') IN (''ARRAY'', ''MARKING''), (f->>''type'') = ''MARKING'';');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the column arm of granular_term_shape did not match'; END IF;
  EXECUTE out;
END $patch$;

-- The operator, and its one legal shape: a caller marking attribute against a
-- mandatory control property. Anything else is a malformed policy rather than a
-- silently different comparison.
DO $patch$
DECLARE src text; out text; addition text;
BEGIN
  src := pg_get_functiondef('public.granular_comparison_check(jsonb,jsonb)'::regprocedure);
  out := replace(src,
    '(''equal'', ''intersects'', ''subset_of'', ''superset_of'',',
    '(''equal'', ''intersects'', ''subset_of'', ''superset_of'', ''satisfies'',');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the comparison list of granular_comparison_check did not match'; END IF;

  -- The body is dollar-quoted by pg_get_functiondef, so the text wants single
  -- quotes; doubling is only for this literal.
  addition :=
    '  -- Satisfies compares the caller against a mandatory control property and' || E'\n' ||
    '  -- nothing else; the row''s markings are the right-hand term.' || E'\n' ||
    '  IF cmp = ''satisfies'' THEN' || E'\n' ||
    '    IF NOT (l.kind = ''user_attribute'' AND l.is_marking' || E'\n' ||
    '            AND r.kind = ''column'' AND r.is_marking) THEN' || E'\n' ||
    '      RAISE EXCEPTION ''Policies:SatisfiesTakesAMandatoryControl — satisfies compares a caller marking attribute against a mandatory control property'';' || E'\n' ||
    '    END IF;' || E'\n' ||
    '  END IF;' || E'\n' || E'\n';

  src := out;
  out := replace(src,
    '  -- "Equal / Less Than / Less Than or Equal / Greater Than or Equal / Greater',
    addition || '  -- "Equal / Less Than / Less Than or Equal / Greater Than or Equal / Greater');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the arity comment of granular_comparison_check did not match'; END IF;
  EXECUTE out;
END $patch$;

-- And its SQL. The caller side is implicit in the function, so only the
-- property term is emitted.
DO $patch$
DECLARE src text; out text; addition text;
BEGIN
  src := pg_get_functiondef('public.granular_comparison_sql(jsonb,jsonb,text)'::regprocedure);
  addition :=
    '  IF cmp = ''satisfies'' THEN' || E'\n' ||
    '    RETURN format(''public.satisfies_mandatory_control(%s)'', r.o_sql);' || E'\n' ||
    '  END IF;' || E'\n' || E'\n';
  out := replace(src,
    '  -- The three collection comparisons: promote a scalar side to a one-element',
    addition || '  -- The three collection comparisons: promote a scalar side to a one-element');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the collection comment of granular_comparison_sql did not match'; END IF;
  EXECUTE out;
END $patch$;

-- What a mandatory control value demands of a caller. The two halves differ, and
-- the page is explicit about both:
--
--   "If a resource has multiple markings, the user must have all of them to access the resource."
--   — object-link-types/mandatory-control-properties.md
--
--   "If a resource has multiple organizations, the user must be a member of at least one of the organizations applied to the resource."
--   — object-link-types/mandatory-control-properties.md
--
--   "In this case, a user must satisfy all the markings and at least one of the organizations to access the resource."
--   — object-link-types/mandatory-control-properties.md
--
-- NULL is REFUSED rather than waved through, which is the opposite of what
-- marking_value_allowed does with it — that one is the storage check, where a
-- missing value is required-ness's business. At read time the granular policies
-- page settles it outright:
--
--   "**Make sure policy columns are non-null:** Rows with null values in a policy column will be inaccessible to all users."
--   — platform-security-management/manage-granular-policies.md
--
-- An empty array is the published permissive case and stays permissive:
-- "values can be set to an empty array. In such cases, all users will meet the
-- marking requirements".
create or replace function public.satisfies_mandatory_control(p_value jsonb)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT CASE
    WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN false
    WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN false
    WHEN p_value = '[]'::jsonb THEN true
    ELSE
      -- Every marking, and satisfies_markings is the one that already knows
      -- about conjunctive and disjunctive categories and implied markings.
      public.satisfies_markings((
        SELECT coalesce(array_agg(v::uuid), '{}'::uuid[])
          FROM jsonb_array_elements_text(p_value) v
         WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.marking_id = v::uuid)))
      AND (
        NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(p_value) v
            JOIN public.organizations o ON o.marking_id = v::uuid)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(p_value) v
           WHERE v = ANY (public.auth_org_marking_ids())))
  END
$$;

comment on function public.satisfies_mandatory_control(jsonb) is
  'Whether the caller satisfies one mandatory control value: all of its markings, and at least one of its organizations when it names any (object-link-types/mandatory-control-properties). NULL is refused — "Rows with null values in a policy column will be inaccessible to all users" — while an empty array admits everyone.';

-- ── 2. The object type as a set of policy fields ───────────────────────────
-- granular_policy_sql needs the field list its columns are checked against. For
-- a restricted view that is the backing dataset's schema; for an object type it
-- is the type's own properties, because the policy is written against
-- properties and the index table names its columns by property_id.
--
-- Derived properties are excluded, and not for tidiness: index_object_type omits
-- `source = 'linked_objects'` from the table it builds, so a policy naming one
-- would compile to a column that does not exist and fail at read time rather
-- than at authoring time. The page independently declines to reason about them:
-- "You cannot test derived property visibility, as this also relies on the
-- user's visibility on the derived property's source object."
create or replace function public.object_type_policy_fields(p_object_type uuid)
returns jsonb language sql stable
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'name', p.property_id,
           'type', CASE p.base_type
                     WHEN 'marking' THEN 'MARKING'
                     WHEN 'array'   THEN 'ARRAY'
                     ELSE upper(p.base_type)
                   END) ORDER BY p.position), '[]'::jsonb)
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type
     AND p.source <> 'linked_objects'
$$;

comment on function public.object_type_policy_fields(uuid) is
  'An object type''s properties as the field list granular_policy_sql checks columns against, named by property_id because that is what index_object_type names the index columns. A marking property reports MARKING so it can be the right-hand term of a satisfies comparison; derived properties are omitted because the index table has no column for them.';

-- ── 3. The policy itself ───────────────────────────────────────────────────
create table public.object_security_policies (
  id             uuid primary key default gen_random_uuid(),
  object_type_id uuid not null unique references public.object_types(id) on delete cascade,
  name           text not null,
  policy         jsonb,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.object_security_policies is
  'One object security policy per object type, overriding the datasource''s requirements (object-permissioning/object-security-policies). `policy` is NULL when the policy exists but configures no granular rules — osp-permissions-ui-overview.png renders that state as None — and a NULL policy filters no rows.';

comment on column public.object_security_policies.name is
  'What the Security policies list shows. Foundry defaults it to the datasource the policy overrode, which is why osp-object-security-policy-properties.png labels the row `passenger`; the name is not the key.';

create index object_security_policies_object_type_idx
  on public.object_security_policies (object_type_id);

alter table public.object_security_policies enable row level security;

-- Who may author one. The rule is the page's, and it needed a new helper: no
-- function here asked whether the caller holds Owner on the project containing
-- an object type, because the object type's own write path asks about the
-- ontology instead.
create or replace function public.object_type_owner(p_object_type uuid)
returns boolean language sql stable
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce(
    (SELECT public.role_rank(public.project_role(t.project_id)) >= public.role_rank('owner')
       FROM public.object_types t WHERE t.id = p_object_type),
    false)
$$;

comment on function public.object_type_owner(uuid) is
  'Whether the caller holds Owner on the project containing an object type — "this means you must hold the `Owner` role on the project that contains the object type" (object-permissioning/object-security-policies). False when the type has no project or does not exist.';

-- Read: anyone who can see the object type. Write: Owner on its project.
--
--   "To create or edit an object or property security policy, you must be an **Owner** of the object type."
--   — object-permissioning/object-security-policies.md
--
--   "If your enrollment uses [project-based permissions](/docs/foundry/object-permissioning/ontology-permissions/), this means you must hold the `Owner` role on the project that contains the object type."
--   — object-permissioning/object-security-policies.md
--
-- Split per command rather than FOR ALL, because 619 measured a FOR ALL write
-- policy running on every SELECT.
create policy "read security policies of visible object types"
  on public.object_security_policies for select to authenticated
  using (exists (select 1 from public.object_types t
                  where t.id = object_type_id and public.auth_in_ontology(t.ontology_id)));

create policy "project owners create object security policies"
  on public.object_security_policies for insert to authenticated
  with check (public.object_type_owner(object_type_id));

create policy "project owners edit object security policies"
  on public.object_security_policies for update to authenticated
  using (public.object_type_owner(object_type_id))
  with check (public.object_type_owner(object_type_id));

create policy "project owners remove object security policies"
  on public.object_security_policies for delete to authenticated
  using (public.object_type_owner(object_type_id));

-- ── 4. The policy is well-formed, and within what an OBJECT policy allows ──
-- The comparison list is shared with restricted views, but one line narrows it
-- here and it is the enumeration that wins:
--
--   "Object security policies do not support less/greater than comparison operators."
--   — platform-security-management/manage-granular-policies.md
create or replace function public.guard_object_security_policy()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$
DECLARE cmp text;
BEGIN
  IF NEW.policy IS NULL THEN RETURN NEW; END IF;

  -- Shape, arity, weights and the user-attribute requirement, from 483.
  PERFORM public.granular_policy_check(NEW.policy,
                                       public.object_type_policy_fields(NEW.object_type_id));

  -- Both levels, because the grammar nests exactly one deep and an ordering
  -- comparison hidden inside a nested group is still an ordering comparison.
  FOR cmp IN
    SELECT r->>'comparison'
      FROM jsonb_array_elements(NEW.policy->'rules') r
     WHERE NOT (r ? 'rules')
    UNION ALL
    SELECT r2->>'comparison'
      FROM jsonb_array_elements(NEW.policy->'rules') g,
           jsonb_array_elements(g->'rules') r2
     WHERE g ? 'rules'
  LOOP
    IF cmp IN ('less_than', 'less_than_or_equal', 'greater_than_or_equal', 'greater_than') THEN
      RAISE EXCEPTION 'Policies:ComparisonNotOnObjectPolicies — % is not available on an object security policy', cmp
        USING HINT = 'Object security policies do not support less/greater than comparison operators.';
    END IF;
  END LOOP;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

create trigger guard_object_security_policy
  before insert or update on public.object_security_policies
  for each row execute function public.guard_object_security_policy();

-- ── 5. The predicate, and the seam every reader already goes through ───────
create or replace function public.object_security_predicate(p_object_type uuid, p_alias text default 'o')
returns text language plpgsql stable
set search_path to 'public', 'pg_temp' as $$
DECLARE pol jsonb;
BEGIN
  SELECT policy INTO pol FROM public.object_security_policies
   WHERE object_type_id = p_object_type;
  -- No policy row, or a policy row with no granular rules, filters nothing.
  IF pol IS NULL THEN RETURN NULL; END IF;
  RETURN public.granular_policy_sql(pol, public.object_type_policy_fields(p_object_type), p_alias);
END $$;

comment on function public.object_security_predicate(uuid, text) is
  'The row filter an object type''s granular policy compiles to, against the index table under p_alias. NULL when no policy applies, matching restricted_view_predicate''s contract so the readers COALESCE it the same way.';

-- Decision 2 lives in this COALESCE: the object policy overrides the
-- datasource's, it does not add to it.
create or replace function public.object_read_predicate(p_object_type uuid, p_alias text default 'o')
returns text language sql stable
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce(public.object_security_predicate(p_object_type, p_alias),
                  public.restricted_view_predicate(p_object_type, p_alias))
$$;

comment on function public.object_read_predicate(uuid, text) is
  'The row filter for one object type: its object security policy if it has one, otherwise its datasource''s restricted view policy. An override rather than a conjunction — "to override data source policies with object security policies" (object-permissioning/object-security-policies). Every reader calls this instead of restricted_view_predicate.';

-- The thirteen call sites, migrated mechanically rather than by retyping five
-- function bodies — object_set_where alone is far too large to retype safely,
-- and CLAUDE.md's rule is pg_get_functiondef then edit the lines that change.
-- CREATE OR REPLACE keeps each function's oid, so its ACL, its COMMENT and its
-- SECURITY DEFINER survive.
DO $patch$
DECLARE r record; src text; out text; n int := 0; sites int := 0; left_over text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
       AND p.proname NOT IN ('restricted_view_predicate', 'object_read_predicate')
       AND pg_get_functiondef(p.oid) LIKE '%public.restricted_view_predicate(%'
  LOOP
    src := pg_get_functiondef(r.oid);
    sites := sites + (length(src) - length(replace(src, 'public.restricted_view_predicate(', '')))
                     / length('public.restricted_view_predicate(');
    out := replace(src, 'public.restricted_view_predicate(', 'public.object_read_predicate(');
    EXECUTE out;
    n := n + 1;
  END LOOP;

  IF n <> 5 THEN
    RAISE EXCEPTION 'PATCH FAILED: expected 5 readers to migrate, migrated %', n;
  END IF;
  IF sites <> 13 THEN
    RAISE EXCEPTION 'PATCH FAILED: expected 13 call sites, found %', sites;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO left_over FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
     AND p.proname NOT IN ('restricted_view_predicate', 'object_read_predicate')
     AND pg_get_functiondef(p.oid) LIKE '%public.restricted_view_predicate(%';
  IF left_over IS NOT NULL THEN
    RAISE EXCEPTION 'PATCH FAILED: % still calls restricted_view_predicate directly', left_over;
  END IF;
  RAISE NOTICE 'PATCHED: % readers, % call sites, none left direct', n, sites;
END $patch$;

-- PROVED BY DOING, as `authenticated`, because a read path proved as the owner
-- proves nothing — the owner bypasses RLS and the predicate would still be
-- applied but every policy around it would be inert.
--
-- The fixture is a real indexed object type with real rows: ExampleDataAircraft,
-- eight instances across four manufacturers. The policy has two rules so it can
-- prove both halves at once — one names a property, so the filter is per ROW;
-- one names a user attribute, so the filter is per CALLER. A policy that proved
-- only the first could be a constant, and a policy that proved only the second
-- could be an all-or-nothing gate. The counts are computed from the data.
DO $$
DECLARE
  v_ot uuid := '47516b65-f965-47b5-bab1-0a31901b641c';
  v_user uuid; v_org uuid; v_role text; v_proj uuid;
  v_pol uuid; v_cat uuid; v_marking uuid;
  v_all int; v_boeing int; v_seen int; v_sql text; v_msg text; v_fired boolean;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT project_id INTO v_proj FROM public.object_types WHERE id = v_ot;
  IF v_user IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user and the fixture object type';
  END IF;
  SELECT count(*) INTO v_all    FROM objects.ot_47516b65f96547b5bab10a31901b641c;
  SELECT count(*) INTO v_boeing FROM objects.ot_47516b65f96547b5bab10a31901b641c
   WHERE manufacturer = 'Boeing';
  IF v_all = 0 OR v_boeing = 0 OR v_boeing = v_all THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the fixture needs a proper subset, found % of %', v_boeing, v_all;
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 1. No policy: every instance is readable, and the seam returns NULL.
  IF public.object_read_predicate(v_ot) IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: an unpolicied object type already filters';
  END IF;
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: expected % instances before any policy, saw %', v_all, v_seen;
  END IF;
  RAISE NOTICE 'PROVED: % instances readable with no policy', v_seen;

  -- 2. A policy whose caller term the caller fails hides EVERY instance, even
  --    the rows whose property term matches.
  INSERT INTO public.object_security_policies (object_type_id, name, policy, created_by)
    VALUES (v_ot, 'zz-proof-821', jsonb_build_object(
      'match', 'all', 'rules', jsonb_build_array(
        jsonb_build_object(
          'left',  jsonb_build_object('column', 'manufacturer'),
          'comparison', 'equal',
          'right', jsonb_build_object('value', 'Boeing')),
        jsonb_build_object(
          'left',  jsonb_build_object('user_attribute', 'user_id'),
          'comparison', 'equal',
          'right', jsonb_build_object('value', gen_random_uuid()::text)))), v_user)
    RETURNING id INTO v_pol;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: a caller the policy excludes saw % instances', v_seen;
  END IF;
  RAISE NOTICE 'PROVED: a policy the caller fails hides every instance';

  -- 3. Naming THIS caller reveals exactly the rows the property term admits and
  --    no more — the half that catches a predicate compiled to constant true.
  UPDATE public.object_security_policies SET policy = jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(
      jsonb_build_object(
        'left',  jsonb_build_object('column', 'manufacturer'),
        'comparison', 'equal',
        'right', jsonb_build_object('value', 'Boeing')),
      jsonb_build_object(
        'left',  jsonb_build_object('user_attribute', 'user_id'),
        'comparison', 'equal',
        'right', jsonb_build_object('value', v_user::text))))
   WHERE id = v_pol;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> v_boeing THEN
    RAISE EXCEPTION 'PROOF FAILED: expected % admitted instances, saw %', v_boeing, v_seen;
  END IF;
  RAISE NOTICE 'PROVED: the policy admits exactly its % instances, not all %', v_boeing, v_all;

  -- 4. The override, not a conjunction: the seam returns the object policy even
  --    though restricted_view_predicate is what it used to return.
  IF public.object_read_predicate(v_ot) IS DISTINCT FROM public.object_security_predicate(v_ot) THEN
    RAISE EXCEPTION 'PROOF FAILED: the seam is not returning the object policy';
  END IF;

  -- 5. An ordering comparison is refused on an object policy, by name, though
  --    483 still accepts it for a restricted view.
  v_fired := false;
  BEGIN
    UPDATE public.object_security_policies SET policy = jsonb_build_object(
      'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
        'left',  jsonb_build_object('column', 'seats'),
        'comparison', 'greater_than',
        'right', jsonb_build_object('user_attribute', 'user_id'))))
     WHERE id = v_pol;
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: greater_than was accepted on an object security policy';
  END IF;
  IF v_msg NOT LIKE 'Policies:ComparisonNotOnObjectPolicies%' THEN
    RAISE EXCEPTION 'PROOF FAILED: refused, but by something else: %', v_msg;
  END IF;
  RAISE NOTICE 'PROVED: an ordering comparison is refused (%)', left(v_msg, 60);

  -- 6. The satisfies comparison compiles, and compiles to the mandatory control
  --    check rather than to set algebra. Proved against a hand-built field list
  --    because no object type here carries a marking property yet — so this
  --    asserts the compiler, and step 7 asserts the semantics.
  v_sql := public.granular_policy_sql(jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('user_attribute', 'marking_ids'),
      'comparison', 'satisfies',
      'right', jsonb_build_object('column', 'vip')))),
    '[{"name": "vip", "type": "MARKING"}]'::jsonb, 'o');
  IF v_sql NOT LIKE '%satisfies_mandatory_control(o.vip)%' THEN
    RAISE EXCEPTION 'PROOF FAILED: satisfies compiled to %', v_sql;
  END IF;
  RAISE NOTICE 'PROVED: satisfies compiles to %', v_sql;

  -- And it refuses the shapes that are not a mandatory control comparison.
  v_fired := false;
  BEGIN
    PERFORM public.granular_policy_sql(jsonb_build_object(
      'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
        'left',  jsonb_build_object('user_attribute', 'marking_ids'),
        'comparison', 'satisfies',
        'right', jsonb_build_object('column', 'plain')))),
      '[{"name": "plain", "type": "STRING"}]'::jsonb, 'o');
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired OR v_msg NOT LIKE 'Policies:SatisfiesTakesAMandatoryControl%' THEN
    RAISE EXCEPTION 'PROOF FAILED: satisfies accepted a non-marking column (%)', coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: satisfies refuses a column that is not a mandatory control';

  -- 7. The semantics: all markings, and NULL is refused rather than waved
  --    through. A fixture marking nobody holds, then held.
  INSERT INTO public.marking_categories (name, description, category_type, visibility)
    VALUES ('zz-proof-821', 'temporary fixture', 'conjunctive', 'visible') RETURNING id INTO v_cat;
  INSERT INTO public.markings (category_id, name)
    VALUES (v_cat, 'zz-proof-821-marking') RETURNING id INTO v_marking;

  SET LOCAL ROLE authenticated;
  IF public.satisfies_mandatory_control(NULL) THEN
    RAISE EXCEPTION 'PROOF FAILED: a null mandatory control admitted the caller';
  END IF;
  IF NOT public.satisfies_mandatory_control('[]'::jsonb) THEN
    RAISE EXCEPTION 'PROOF FAILED: an empty mandatory control refused the caller';
  END IF;
  IF public.satisfies_mandatory_control(jsonb_build_array(v_marking::text)) THEN
    RAISE EXCEPTION 'PROOF FAILED: a marking the caller does not hold admitted them';
  END IF;
  RESET ROLE;

  INSERT INTO public.marking_members (marking_id, user_id) VALUES (v_marking, v_user);
  SET LOCAL ROLE authenticated;
  IF NOT public.satisfies_mandatory_control(jsonb_build_array(v_marking::text)) THEN
    RAISE EXCEPTION 'PROOF FAILED: a marking the caller holds still refused them';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'PROVED: null refused, empty admitted, and a held marking admits';

  -- Fixtures out, and the object type back to reading all eight.
  DELETE FROM public.object_security_policies WHERE id = v_pol;
  DELETE FROM public.marking_members WHERE marking_id = v_marking;
  ALTER TABLE public.markings           DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings           WHERE id = v_marking;
  DELETE FROM public.marking_categories WHERE id = v_cat;
  ALTER TABLE public.markings           ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: % instances readable after cleanup, expected %', v_seen, v_all;
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  IF EXISTS (SELECT 1 FROM public.marking_categories WHERE name = 'zz-proof-821')
     OR EXISTS (SELECT 1 FROM public.object_security_policies WHERE name = 'zz-proof-821') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed, % instances readable again', v_seen;
END $$;
