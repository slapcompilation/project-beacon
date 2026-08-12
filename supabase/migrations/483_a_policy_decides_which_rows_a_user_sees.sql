-- Granular policies as data, and the restricted view that carries one.
--
-- "A granular policy is a set of rules and logical operators that compare user
-- attributes, columns or properties, and values to determine which data the
-- user can see." (platform-security-management/manage-granular-policies.md)
--
-- "Restricted views limit dataset access to only the rows that a user has
-- permission to see. A restricted view is built on top of a backing dataset
-- and cannot be used as an input for transforms."
-- (security/restricted-views.md)
--
-- The grammar lives here as jsonb the way the exploration filter grammar does:
--   policy     := { "match": "all"|"any", "rules": [ rule, … ] }
--   rule       := comparison | { "match": "all"|"any", "rules": [ comparison, … ] }
--   comparison := { "left": term, "comparison": <one of eight>, "right": term }
--   term       := { "user_attribute": a } | { "column": name } | { "value": v }
-- One nesting level, matching the editor's "Match any|all" header with nested
-- operators. Key names are ours; no page prints the JSON. The error namespace
-- Policies: is ours too — no page names the owning service.

-- ── the caller-independent half: is this policy well-formed? ────────────────
-- Classifies one term. p_fields is the backing dataset's schema (fields jsonb):
-- "Column name: A column in the restricted views backing dataset."
CREATE OR REPLACE FUNCTION public.granular_term_shape(p_term jsonb, p_fields jsonb)
RETURNS TABLE (kind text, is_collection boolean, is_marking boolean)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  attr text; col text; f jsonb;
BEGIN
  IF p_term IS NULL OR jsonb_typeof(p_term) <> 'object' OR
     (SELECT count(*) FROM jsonb_object_keys(p_term)) <> 1 THEN
    RAISE EXCEPTION 'Policies:MalformedPolicy — a term is one of user_attribute, column, value';
  END IF;

  IF p_term ? 'user_attribute' THEN
    attr := p_term->>'user_attribute';
    -- The list from "User attributes", minus custom attributes (no identity
    -- provider posts any here). Collections are the plural ones by their own
    -- wording: "The IDs of all the groups…", "The Marking IDs of all
    -- organizations…", "The IDs of all Markings…".
    IF attr NOT IN ('user_id', 'username', 'group_ids', 'group_names',
                    'authorized_group_ids', 'organization_marking_ids', 'marking_ids') THEN
      RAISE EXCEPTION 'Policies:UnknownUserAttribute — % is not a supported user attribute', attr;
    END IF;
    RETURN QUERY SELECT 'user_attribute',
      attr NOT IN ('user_id', 'username'),
      attr IN ('organization_marking_ids', 'marking_ids');

  ELSIF p_term ? 'column' THEN
    col := p_term->>'column';
    SELECT x INTO f FROM jsonb_array_elements(COALESCE(p_fields, '[]'::jsonb)) x
     WHERE x->>'name' = col;
    IF f IS NULL THEN
      RAISE EXCEPTION 'Policies:ColumnNotInBackingDataset — % is not a column of the backing dataset', col;
    END IF;
    -- A marking-backed column "must be of type STRING ARRAY".
    RETURN QUERY SELECT 'column', (f->>'type') = 'ARRAY', false;

  ELSIF p_term ? 'value' THEN
    -- "Specific value: A string, Boolean, number, or array."
    IF jsonb_typeof(p_term->'value') = 'object' THEN
      RAISE EXCEPTION 'Policies:MalformedPolicy — a value is a string, boolean, number, or array';
    END IF;
    RETURN QUERY SELECT 'value', jsonb_typeof(p_term->'value') = 'array', false;

  ELSE
    RAISE EXCEPTION 'Policies:MalformedPolicy — a term is one of user_attribute, column, value';
  END IF;
END $$;

-- One comparison: arity per "Policy comparisons", weight per "Policy
-- limitations". Returns its weight; whether a user attribute appears rides out
-- through o_user_attr.
CREATE OR REPLACE FUNCTION public.granular_comparison_check(
  p_comp jsonb, p_fields jsonb, OUT o_weight int, OUT o_user_attr boolean)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  cmp text; l record; r record;
BEGIN
  IF p_comp ? 'not' THEN
    -- Foundry says "Avoid using NOT conditions with group, marking, or
    -- organization memberships … causing the condition to pass and grant more
    -- access than intended." Ours refuses NOT outright — stricter than the
    -- warning, and deliberately so.
    RAISE EXCEPTION 'Policies:NotUnsupported — NOT conditions are refused: a scoped token missing the attribute would pass them';
  END IF;
  cmp := p_comp->>'comparison';
  IF cmp IS NULL OR cmp NOT IN ('equal', 'intersects', 'subset_of', 'superset_of',
    'less_than', 'less_than_or_equal', 'greater_than_or_equal', 'greater_than') THEN
    RAISE EXCEPTION 'Policies:UnknownComparison — % is not a supported comparison', COALESCE(cmp, 'nothing');
  END IF;

  SELECT * INTO l FROM public.granular_term_shape(p_comp->'left', p_fields);
  SELECT * INTO r FROM public.granular_term_shape(p_comp->'right', p_fields);

  -- "Equal / Less Than / Less Than or Equal / Greater Than or Equal / Greater
  -- Than: Both the left and right side of the comparison must be single-valued
  -- (not a collection) and of the same type."
  IF cmp IN ('equal', 'less_than', 'less_than_or_equal', 'greater_than_or_equal', 'greater_than')
     AND (l.is_collection OR r.is_collection) THEN
    RAISE EXCEPTION 'Policies:ComparisonNeedsScalars — % takes single values on both sides', cmp;
  END IF;
  -- "Intersects: At least one side must be a collection…"
  IF cmp = 'intersects' AND NOT (l.is_collection OR r.is_collection) THEN
    RAISE EXCEPTION 'Policies:ComparisonNeedsACollection — intersects takes a collection on at least one side';
  END IF;
  -- "Subset of: At least right side must be a collection…"
  IF cmp = 'subset_of' AND NOT r.is_collection THEN
    RAISE EXCEPTION 'Policies:ComparisonNeedsACollection — subset_of takes a collection on the right side';
  END IF;
  -- "Superset of: At least left side must be a collection…"
  IF cmp = 'superset_of' AND NOT l.is_collection THEN
    RAISE EXCEPTION 'Policies:ComparisonNeedsACollection — superset_of takes a collection on the left side';
  END IF;

  -- "A comparison of a constant against a field is given a weight of 1. A
  -- comparison of a collection against a field is given a weight of 1,000. A
  -- marking condition is given a weight of 3,000."
  o_weight := CASE
    WHEN l.is_marking OR r.is_marking THEN 3000
    WHEN l.is_collection OR r.is_collection THEN 1000
    ELSE 1 END;
  o_user_attr := l.kind = 'user_attribute' OR r.kind = 'user_attribute';
END $$;

CREATE OR REPLACE FUNCTION public.granular_policy_check(p_policy jsonb, p_fields jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  rule jsonb; inner_rule jsonb; c record;
  n int := 0; total int := 0; has_attr boolean := false;
BEGIN
  IF p_policy IS NULL OR jsonb_typeof(p_policy) <> 'object'
     OR p_policy->>'match' NOT IN ('all', 'any')
     OR jsonb_typeof(p_policy->'rules') <> 'array'
     OR jsonb_array_length(p_policy->'rules') = 0 THEN
    RAISE EXCEPTION 'Policies:MalformedPolicy — a policy matches all or any of at least one rule';
  END IF;
  IF p_policy ? 'not' THEN
    RAISE EXCEPTION 'Policies:NotUnsupported — NOT conditions are refused: a scoped token missing the attribute would pass them';
  END IF;

  FOR rule IN SELECT * FROM jsonb_array_elements(p_policy->'rules') LOOP
    IF rule ? 'rules' THEN
      -- One nesting level: the editor's nested AND/OR group.
      IF rule->>'match' NOT IN ('all', 'any')
         OR jsonb_typeof(rule->'rules') <> 'array'
         OR jsonb_array_length(rule->'rules') = 0 THEN
        RAISE EXCEPTION 'Policies:MalformedPolicy — a nested group matches all or any of at least one comparison';
      END IF;
      FOR inner_rule IN SELECT * FROM jsonb_array_elements(rule->'rules') LOOP
        IF inner_rule ? 'rules' THEN
          RAISE EXCEPTION 'Policies:MalformedPolicy — rules nest one level deep';
        END IF;
        SELECT * INTO c FROM public.granular_comparison_check(inner_rule, p_fields);
        n := n + 1; total := total + c.o_weight; has_attr := has_attr OR c.o_user_attr;
      END LOOP;
    ELSE
      SELECT * INTO c FROM public.granular_comparison_check(rule, p_fields);
      n := n + 1; total := total + c.o_weight; has_attr := has_attr OR c.o_user_attr;
    END IF;
  END LOOP;

  -- "A single policy can have up to ten comparisons."
  IF n > 10 THEN
    RAISE EXCEPTION 'Policies:TooManyComparisons — a policy has up to ten comparisons, this one has %', n;
  END IF;
  -- "The sum of the weights across all the comparisons in a policy must be
  -- under 10,000."
  IF total >= 10000 THEN
    RAISE EXCEPTION 'Policies:PolicyOverweight — comparison weights sum to %, the limit is under 10,000', total;
  END IF;
  -- "At least one such term is necessary for user-based permissioning."
  IF NOT has_attr THEN
    RAISE EXCEPTION 'Policies:PolicyNeedsAUserAttribute — at least one term must compare a user attribute';
  END IF;
END $$;

COMMENT ON FUNCTION public.granular_policy_check(jsonb, jsonb) IS
  'Validates a granular policy against the backing dataset''s schema: the eight comparisons with their arity, the 1/1,000/3,000 weights capped under 10,000, at most ten comparisons, at least one user attribute, and no NOT.';

-- The backing dataset's current committed schema, for column terms.
CREATE OR REPLACE FUNCTION public.dataset_current_fields(p_dataset uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT s.fields
    FROM public.dataset_schemas s
    JOIN public.dataset_transactions t ON t.id = s.transaction_id
   WHERE s.dataset_id = p_dataset AND t.status = 'COMMITTED'
   ORDER BY t.committed_at DESC
   LIMIT 1
$$;

-- ── the resource ────────────────────────────────────────────────────────────
-- "Users interact with restricted view resources in Foundry, and restricted
-- views are powered by granular policies." The RID form is inferred from the
-- dataset's — no page prints a restricted-view RID.
CREATE TABLE public.restricted_views (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid              text GENERATED ALWAYS AS (public.rid_of('foundry', 'restricted-view', id)) STORED,
  organization_id  uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- "Save as: Choose a name and location where the restricted view will live
  -- in the file system." The save-apart guidance ("Typically, you will want to
  -- save your restricted view in a different Project from the input dataset")
  -- is advice, not a constraint; both placements are legal.
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  -- "A restricted view is built on top of a backing dataset…"
  input_dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE RESTRICT,
  api_name         text NOT NULL,
  name             text NOT NULL,
  -- "The policy is the core of a restricted view."
  policy           jsonb NOT NULL,
  -- The 462 protection flag, same as every other protectable resource.
  protected        boolean NOT NULL DEFAULT false,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);
CREATE UNIQUE INDEX restricted_views_rid_key ON public.restricted_views (rid);
CREATE INDEX restricted_views_input_idx ON public.restricted_views (input_dataset_id);
COMMENT ON TABLE public.restricted_views IS
  'A special kind of dataset where granular access to the data within the file is controlled based on defined rules — read-only, evaluated per caller at read time, never an input to transforms.';

CREATE OR REPLACE FUNCTION public.guard_restricted_view()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- "To build a restricted view, you must have view access on the input
  -- dataset." (platform-security-management/manage-restricted-views.md)
  IF auth.uid() IS NOT NULL AND NOT public.can_read_dataset(NEW.input_dataset_id) THEN
    RAISE EXCEPTION 'Policies:InputDatasetNotVisible — a restricted view takes view access on its input dataset';
  END IF;
  PERFORM public.granular_policy_check(NEW.policy, public.dataset_current_fields(NEW.input_dataset_id));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_restricted_view BEFORE INSERT OR UPDATE ON public.restricted_views
FOR EACH ROW EXECUTE FUNCTION public.guard_restricted_view();

-- ── severed markings ────────────────────────────────────────────────────────
-- "Review access requirements: Review the existing file and transaction-level
-- Markings on both the upstream dataset and downstream restricted view. With
-- appropriate permissions, you can un-mark (remove) Markings from the
-- restricted view." (security/restricted-views.md) Severing is a removal, so
-- it takes the remove permission from 399's vocabulary.
CREATE TABLE public.restricted_view_marking_stops (
  restricted_view_id uuid NOT NULL REFERENCES public.restricted_views(id) ON DELETE CASCADE,
  marking_id         uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  stopped_by         uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  stopped_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restricted_view_id, marking_id)
);

CREATE OR REPLACE FUNCTION public.guard_rv_marking_stop()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.marking_permissions p
     WHERE p.marking_id = NEW.marking_id AND p.user_id = auth.uid() AND p.permission = 'remove')
  THEN
    RAISE EXCEPTION 'Markings:CannotRemove — un-marking the restricted view takes the remove permission on that marking';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_rv_marking_stop BEFORE INSERT ON public.restricted_view_marking_stops
FOR EACH ROW EXECUTE FUNCTION public.guard_rv_marking_stop();

-- What still marks the view: everything the input dataset carries — its own
-- file markings and the data markings that flowed to it — minus what was
-- severed at creation review. effective_data_markings holds only the flowed
-- half by design, so both halves union here.
CREATE OR REPLACE FUNCTION public.restricted_view_markings(p_view uuid)
RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(m), '{}')
    FROM (
      SELECT unnest(public.effective_file_markings('dataset', v.input_dataset_id)
                    || public.effective_data_markings(v.input_dataset_id)) AS m
        FROM public.restricted_views v WHERE v.id = p_view
      EXCEPT
      SELECT s.marking_id FROM public.restricted_view_marking_stops s
       WHERE s.restricted_view_id = p_view
    ) x
$$;

-- ── visibility and management ───────────────────────────────────────────────
ALTER TABLE public.restricted_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restricted_view_marking_stops ENABLE ROW LEVEL SECURITY;

-- "This ensures users consuming the restricted view can have View permissions
-- on the downstream Project."
CREATE POLICY "project members see restricted views" ON public.restricted_views FOR SELECT
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
         AND public.project_role(project_id) IS NOT NULL);

-- "Users with an Owner role or the necessary permissions can create restricted
-- views" — and the policy "is typically defined by a user with the Owner role
-- upon creation".
CREATE POLICY "project owners author restricted views" ON public.restricted_views FOR ALL
  USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
         AND public.role_rank(public.project_role(project_id)) >= public.role_rank('owner'))
  WITH CHECK (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
              AND public.role_rank(public.project_role(project_id)) >= public.role_rank('owner'));

CREATE POLICY "view stops with the view" ON public.restricted_view_marking_stops FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.restricted_views v
                  WHERE v.id = restricted_view_id
                    AND NOT (v.organization_id IS DISTINCT FROM public.auth_org_id())
                    AND public.project_role(v.project_id) IS NOT NULL));
CREATE POLICY "owners sever markings" ON public.restricted_view_marking_stops FOR ALL
  USING (EXISTS (SELECT 1 FROM public.restricted_views v
                  WHERE v.id = restricted_view_id
                    AND NOT (v.organization_id IS DISTINCT FROM public.auth_org_id())
                    AND public.role_rank(public.project_role(v.project_id)) >= public.role_rank('owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restricted_views v
                       WHERE v.id = restricted_view_id
                         AND NOT (v.organization_id IS DISTINCT FROM public.auth_org_id())
                         AND public.role_rank(public.project_role(v.project_id)) >= public.role_rank('owner')));

-- ── assertions: the grammar refuses what the pages refuse ───────────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ds uuid; br uuid; txn uuid; rv uuid;
  u1 uuid := gen_random_uuid(); before text;
  fields jsonb; cat uuid; mk uuid; n int;
  ok jsonb := '{"match":"all","rules":[
    {"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}';
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('policies-483') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p483@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (u1, 'p483@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

  SET LOCAL ROLE authenticated;
  sp := public.create_space('P483');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'p483', 'P483') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, u1, 'owner', org);
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'crm483', 'CRM') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields) VALUES (ds, txn, '[
    {"name":"owner_id","type":"STRING"},
    {"name":"branch","type":"STRING"},
    {"name":"markings","type":"ARRAY","arraySubType":{"type":"STRING"}}]'::jsonb);
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;

  fields := public.dataset_current_fields(ds);

  -- 1. The documented shapes pass: constant-vs-field (weight 1), the user's
  --    groups against a field (1,000), the marking-backed rule (3,000).
  PERFORM public.granular_policy_check(ok, fields);
  PERFORM public.granular_policy_check('{"match":"any","rules":[
    {"left":{"user_attribute":"group_ids"},"comparison":"intersects","right":{"value":["g-1"]}},
    {"match":"all","rules":[
      {"left":{"user_attribute":"marking_ids"},"comparison":"superset_of","right":{"column":"markings"}},
      {"left":{"column":"branch"},"comparison":"equal","right":{"value":"ATH"}}]}]}', fields);

  -- 2. Refusals, one per rule.
  BEGIN
    PERFORM public.granular_policy_check('{"match":"all","rules":[
      {"left":{"user_attribute":"group_ids"},"comparison":"equal","right":{"column":"branch"}}]}', fields);
    RAISE EXCEPTION 'equal accepted a collection';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:ComparisonNeedsScalars%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.granular_policy_check('{"match":"all","rules":[
      {"left":{"user_attribute":"user_id"},"comparison":"subset_of","right":{"column":"branch"}}]}', fields);
    RAISE EXCEPTION 'subset_of accepted a scalar right side';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:ComparisonNeedsACollection%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.granular_policy_check('{"match":"all","rules":[
      {"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"ghost"}}]}', fields);
    RAISE EXCEPTION 'a ghost column validated';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:ColumnNotInBackingDataset%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.granular_policy_check('{"match":"all","rules":[
      {"left":{"column":"branch"},"comparison":"equal","right":{"value":"ATH"}}]}', fields);
    RAISE EXCEPTION 'a policy with no user attribute validated';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:PolicyNeedsAUserAttribute%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.granular_policy_check('{"match":"all","not":true,"rules":[
      {"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}', fields);
    RAISE EXCEPTION 'NOT validated';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:NotUnsupported%' THEN RAISE; END IF;
  END;
  -- Four marking conditions weigh 12,000: over the documented cap of 10,000.
  BEGIN
    PERFORM public.granular_policy_check('{"match":"all","rules":[
      {"left":{"user_attribute":"marking_ids"},"comparison":"superset_of","right":{"column":"markings"}},
      {"left":{"user_attribute":"marking_ids"},"comparison":"intersects","right":{"column":"markings"}},
      {"left":{"user_attribute":"organization_marking_ids"},"comparison":"intersects","right":{"column":"markings"}},
      {"left":{"user_attribute":"organization_marking_ids"},"comparison":"superset_of","right":{"column":"markings"}}]}', fields);
    RAISE EXCEPTION 'an overweight policy validated';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:PolicyOverweight%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.granular_policy_check(
      (SELECT jsonb_build_object('match', 'all', 'rules', jsonb_agg(
        '{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}'::jsonb))
       FROM generate_series(1, 11)), fields);
    RAISE EXCEPTION 'eleven comparisons validated';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:TooManyComparisons%' THEN RAISE; END IF;
  END;

  -- 3. The resource lands for a project owner, and validates its policy.
  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'crm_by_owner', 'CRM by owner', ok) RETURNING id INTO rv;
  BEGIN
    UPDATE public.restricted_views
       SET policy = '{"match":"all","rules":[
         {"left":{"column":"branch"},"comparison":"equal","right":{"value":"ATH"}}]}'
     WHERE id = rv;
    RAISE EXCEPTION 'the resource accepted an invalid policy';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Policies:PolicyNeedsAUserAttribute%' THEN RAISE; END IF;
  END;

  -- 4. Severed markings subtract from the inherited set, and severing takes
  --    the remove permission.
  RESET ROLE;
  INSERT INTO public.marking_categories (name, category_type, organization_id)
  VALUES ('P483', 'conjunctive', org) RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name)
  VALUES (cat, 'P483 Secret') RETURNING id INTO mk;
  -- Applying takes the apply permission (399); removing is granted later, so
  -- the severing refusal below is real.
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
  VALUES (mk, u1, 'apply');
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
  VALUES (mk, 'dataset', ds);
  SET LOCAL ROLE authenticated;

  IF NOT (public.restricted_view_markings(rv) @> ARRAY[mk]) THEN
    RAISE EXCEPTION 'the view did not inherit the input dataset''s marking';
  END IF;
  BEGIN
    INSERT INTO public.restricted_view_marking_stops (restricted_view_id, marking_id) VALUES (rv, mk);
    RAISE EXCEPTION 'a marking was severed without the remove permission';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Markings:CannotRemove%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
  VALUES (mk, u1, 'remove');
  SET LOCAL ROLE authenticated;
  INSERT INTO public.restricted_view_marking_stops (restricted_view_id, marking_id) VALUES (rv, mk);
  IF public.restricted_view_markings(rv) @> ARRAY[mk] THEN
    RAISE EXCEPTION 'a severed marking still marks the view';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '483: a policy decides which rows a user sees, and the grammar refuses what the pages refuse';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
