-- A property security policy covers a selection of properties.
--
-- The column-level half of the feature 821 built the row-level half of, and the
-- page is explicit that it is the same thing with a narrower scope:
--
--   "The visibility of specific properties can be guarded using additional *property security policies*. These are identical to object security policies, except they only apply to a selection of properties. These are used to achieve *column-level security*."
--   — object-permissioning/object-security-policies.md
--
-- and again, in the step-7 walkthrough, so it is stated twice independently:
--
--   "The configuration settings for property security policies are identical to object security policies."
--   — object-permissioning/object-security-policies.md
--
-- THE TWO DENIAL SHAPES ARE DIFFERENT AND MUST STAY DIFFERENT. This migration
-- is the authoring half and does not touch a reader, but the distinction decides
-- the schema, so it is recorded here:
--
--   "If a user does not pass the object security policy, the object instance will not be viewable to that user. If they pass the object security policy but do not pass the property security policy, they will see a *null* value in place of the property value."
--   — object-permissioning/object-security-policies.md
--
-- The object policy withholds the ROW; a property policy leaves the row and the
-- key and nulls the VALUE. That is also distinct from `visibility = 'hidden'`,
-- which removes the key entirely and which the readers already implement.
--
-- SEPARATE TABLE, NOT A SCOPE COLUMN ON object_security_policies. They differ in
-- cardinality — exactly one object policy per type against many property
-- policies — and in what identifies them: osp-object-security-policy-properties.png
-- shows the object policy's row labelled with its datasource as a blue link and
-- the property policy's with a free-typed name in plain text, in one list
-- distinguished by a `Type` pill. One row per policy either way; two tables,
-- because a UNIQUE that holds for one and not the other is the whole difference.

create table public.property_security_policies (
  id             uuid primary key default gen_random_uuid(),
  object_type_id uuid not null references public.object_types(id) on delete cascade,
  name           text not null,
  policy         jsonb,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- So the membership table can reference the pair and inherit the type.
  unique (id, object_type_id)
);

comment on table public.property_security_policies is
  'A named policy over a selection of an object type''s properties, identical in configuration to the object security policy and differing only in scope (object-permissioning/object-security-policies). Failing it nulls the property value; failing the object policy withholds the row.';

create index property_security_policies_object_type_idx
  on public.property_security_policies (object_type_id);
create index property_security_policies_created_by_idx
  on public.property_security_policies (created_by);

-- Membership, and the two refusals the page states about it.
--
--   "A non-primary key property can be a member of at most one property security policy."
--   — object-permissioning/object-security-policies.md
--
-- is the UNIQUE below: the ladder's "a fact about a set of rows" rung, and it is
-- what makes the read path deterministic — a cell never has two policies to
-- combine. object_type_id rides along so the constraint can be stated at all,
-- and a composite foreign key keeps it honest rather than merely copied.
create table public.property_security_policy_properties (
  policy_id      uuid not null,
  object_type_id uuid not null,
  property_id    text not null,
  primary key (policy_id, property_id),
  unique (object_type_id, property_id),
  foreign key (policy_id, object_type_id)
    references public.property_security_policies (id, object_type_id) on delete cascade
);

comment on table public.property_security_policy_properties is
  'Which properties a property security policy covers. UNIQUE (object_type_id, property_id) is "A non-primary key property can be a member of at most one property security policy" (object-permissioning/object-security-policies), so a cell never has two policies to combine.';

alter table public.property_security_policies enable row level security;
alter table public.property_security_policy_properties enable row level security;

-- Same reader and same author as the object policy: Owner of the object type.
create policy "read property policies of visible object types"
  on public.property_security_policies for select to authenticated
  using (exists (select 1 from public.object_types t
                  where t.id = object_type_id and public.auth_in_ontology(t.ontology_id)));

create policy "project owners create property policies"
  on public.property_security_policies for insert to authenticated
  with check (public.object_type_owner(object_type_id));
create policy "project owners edit property policies"
  on public.property_security_policies for update to authenticated
  using (public.object_type_owner(object_type_id))
  with check (public.object_type_owner(object_type_id));
create policy "project owners remove property policies"
  on public.property_security_policies for delete to authenticated
  using (public.object_type_owner(object_type_id));

create policy "read property policy members of visible object types"
  on public.property_security_policy_properties for select to authenticated
  using (exists (select 1 from public.object_types t
                  where t.id = object_type_id and public.auth_in_ontology(t.ontology_id)));

create policy "project owners add property policy members"
  on public.property_security_policy_properties for insert to authenticated
  with check (public.object_type_owner(object_type_id));
create policy "project owners remove property policy members"
  on public.property_security_policy_properties for delete to authenticated
  using (public.object_type_owner(object_type_id));

-- ── The weight a policy carries, so the combined limit can be checked ──────
-- 483 already prices each comparison; nothing summed a whole policy, because
-- granular_policy_check only ever needed the total inside itself.
--
--   "For granular policies configured on property security policies, the combined [comparison weights](/docs/foundry/platform-security-management/manage-granular-policies/#policy-limitations) of the property security policy's granular policy and the object security policy's granular policy must stay under the granular policy comparison limit of 10,000."
--   — object-permissioning/object-security-policies.md
--
-- The limit bites sooner than it looks: a marking condition is priced at 3,000,
-- so three of them across the pair reach 9,000 in exactly the PII-and-VIP shape
-- the walkthrough uses.
create or replace function public.granular_policy_weight(p_policy jsonb, p_fields jsonb)
returns int language plpgsql immutable as $$
DECLARE rule jsonb; inner_rule jsonb; c record; total int := 0;
BEGIN
  IF p_policy IS NULL THEN RETURN 0; END IF;
  FOR rule IN SELECT * FROM jsonb_array_elements(p_policy->'rules') LOOP
    IF rule ? 'rules' THEN
      FOR inner_rule IN SELECT * FROM jsonb_array_elements(rule->'rules') LOOP
        SELECT * INTO c FROM public.granular_comparison_check(inner_rule, p_fields);
        total := total + c.o_weight;
      END LOOP;
    ELSE
      SELECT * INTO c FROM public.granular_comparison_check(rule, p_fields);
      total := total + c.o_weight;
    END IF;
  END LOOP;
  RETURN total;
END $$;

comment on function public.granular_policy_weight(jsonb, jsonb) is
  'The summed comparison weight of one granular policy, for the combined limit a property security policy shares with its object security policy (object-permissioning/object-security-policies). 0 for no policy.';

-- ── The guards ────────────────────────────────────────────────────────────
create or replace function public.guard_property_security_policy()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$
DECLARE v_fields jsonb; cmp text; v_obj jsonb; v_total int;
BEGIN
  -- "An object security policy must already be configured."
  IF NOT EXISTS (SELECT 1 FROM public.object_security_policies
                  WHERE object_type_id = NEW.object_type_id) THEN
    RAISE EXCEPTION 'Policies:ObjectPolicyRequired — a property security policy needs an object security policy on the same object type'
      USING HINT = 'An object security policy must already be configured.';
  END IF;

  IF NEW.policy IS NOT NULL THEN
    v_fields := public.object_type_policy_fields(NEW.object_type_id);
    PERFORM public.granular_policy_check(NEW.policy, v_fields);

    -- Identical configuration means the object policy's operator restriction too.
    FOR cmp IN
      SELECT r->>'comparison' FROM jsonb_array_elements(NEW.policy->'rules') r
       WHERE NOT (r ? 'rules')
      UNION ALL
      SELECT r2->>'comparison'
        FROM jsonb_array_elements(NEW.policy->'rules') g,
             jsonb_array_elements(g->'rules') r2
       WHERE g ? 'rules'
    LOOP
      IF cmp IN ('less_than', 'less_than_or_equal', 'greater_than_or_equal', 'greater_than') THEN
        RAISE EXCEPTION 'Policies:ComparisonNotOnObjectPolicies — % is not available on a property security policy', cmp
          USING HINT = 'Object security policies do not support less/greater than comparison operators.';
      END IF;
    END LOOP;

    -- The combined limit, against the object policy on the same type.
    SELECT policy INTO v_obj FROM public.object_security_policies
     WHERE object_type_id = NEW.object_type_id;
    v_total := public.granular_policy_weight(NEW.policy, v_fields)
             + public.granular_policy_weight(v_obj, v_fields);
    IF v_total >= 10000 THEN
      RAISE EXCEPTION 'Policies:CombinedPolicyOverweight — this policy and its object security policy weigh % together, the limit is under 10,000', v_total;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

create trigger guard_property_security_policy
  before insert or update on public.property_security_policies
  for each row execute function public.guard_property_security_policy();

-- Membership needs another table to answer, so it is a trigger rather than a
-- CHECK: is this a real property of that object type, and is it the primary key.
--
--   "The primary key property cannot be a member of any property security policy."
--   — object-permissioning/object-security-policies.md
--
-- It follows from the null failure mode rather than being an arbitrary rule —
-- nulling a primary key would leave a row with no identity.
create or replace function public.guard_property_policy_membership()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$
DECLARE v_pk boolean;
BEGIN
  SELECT p.is_primary_key INTO v_pk
    FROM public.object_type_properties p
   WHERE p.object_type_id = NEW.object_type_id AND p.property_id = NEW.property_id;
  IF v_pk IS NULL THEN
    RAISE EXCEPTION 'Policies:PropertyNotOnObjectType — % is not a property of that object type', NEW.property_id;
  END IF;
  IF v_pk THEN
    RAISE EXCEPTION 'Policies:PrimaryKeyCannotBeSecured — the primary key property cannot be a member of any property security policy'
      USING HINT = 'Its value is the row''s identity, and a property policy nulls values.';
  END IF;
  RETURN NEW;
END $$;

create trigger guard_property_policy_membership
  before insert or update on public.property_security_policy_properties
  for each row execute function public.guard_property_policy_membership();

-- PROVED BY DOING. Every refusal the page states, asked of the guard that owns
-- it, plus the one acceptance — because a guard that refuses everything would
-- pass all four refusal probes.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_ot uuid; v_osp uuid; v_psp uuid; v_other uuid;
  v_org uuid; v_role text; v_msg text; v_fired boolean; v_w int;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj FROM public.projects WHERE NOT auto_protect_new ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user, an ontology and an unprotected project';
  END IF;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
    VALUES (v_ont, v_proj, 'ZzProof826', 'Zz Proof 826', 'experimental') RETURNING id INTO v_ot;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
   VALUES (v_ot, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true),
          (v_ot, 'name', 'name', 'Name', 'string', 'column', 'name', false, false, false),
          (v_ot, 'address', 'address', 'Address', 'string', 'column', 'address', false, false, false);

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- 1. Without an object security policy, there is nothing to add to.
  v_fired := false;
  BEGIN
    INSERT INTO public.property_security_policies (object_type_id, name)
      VALUES (v_ot, 'zz-826-early');
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired OR v_msg NOT LIKE 'Policies:ObjectPolicyRequired%' THEN
    RAISE EXCEPTION 'PROOF FAILED: a property policy was created with no object policy (%)',
      coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: a property policy needs an object policy first';

  -- 2. With one, it is accepted.
  INSERT INTO public.object_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'zz-826-object', v_user) RETURNING id INTO v_osp;
  INSERT INTO public.property_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'hide PII properties', v_user) RETURNING id INTO v_psp;
  RAISE NOTICE 'PROVED: with an object policy, a property policy is accepted';

  -- 3. The primary key cannot be a member.
  v_fired := false;
  BEGIN
    INSERT INTO public.property_security_policy_properties (policy_id, object_type_id, property_id)
      VALUES (v_psp, v_ot, 'pk');
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired OR v_msg NOT LIKE 'Policies:PrimaryKeyCannotBeSecured%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the primary key joined a property policy (%)',
      coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: the primary key cannot be a member';

  -- 4. A non-primary-key property can, and only once across all policies.
  INSERT INTO public.property_security_policy_properties (policy_id, object_type_id, property_id)
    VALUES (v_psp, v_ot, 'name'), (v_psp, v_ot, 'address');

  INSERT INTO public.property_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'zz-826-second', v_user) RETURNING id INTO v_other;
  v_fired := false;
  BEGIN
    INSERT INTO public.property_security_policy_properties (policy_id, object_type_id, property_id)
      VALUES (v_other, v_ot, 'name');
  EXCEPTION WHEN unique_violation THEN v_fired := true;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'PROOF FAILED: a property joined two property policies';
  END IF;
  RAISE NOTICE 'PROVED: a property belongs to at most one property policy';

  -- 5. A property of another object type is refused outright.
  v_fired := false;
  BEGIN
    INSERT INTO public.property_security_policy_properties (policy_id, object_type_id, property_id)
      VALUES (v_psp, v_ot, 'not_a_property');
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired OR v_msg NOT LIKE 'Policies:PropertyNotOnObjectType%' THEN
    RAISE EXCEPTION 'PROOF FAILED: an unknown property joined a policy (%)', coalesce(v_msg, 'no error');
  END IF;

  -- 6. The weight function prices a marking condition at 3,000, and the combined
  --    limit refuses a pair that reaches 10,000. Four marking conditions is
  --    12,000 — but a single policy is capped at ten comparisons and 10,000 on
  --    its own, so the combined rule has to be reached with two policies of
  --    three, which is 18,000 across the pair and 9,000 each.
  v_w := public.granular_policy_weight(jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('user_attribute', 'marking_ids'),
      'comparison', 'satisfies',
      'right', jsonb_build_object('column', 'vip')))),
    '[{"name": "vip", "type": "MARKING"}]'::jsonb);
  IF v_w <> 3000 THEN
    RAISE EXCEPTION 'PROOF FAILED: a marking condition weighed % rather than 3000', v_w;
  END IF;
  RAISE NOTICE 'PROVED: granular_policy_weight prices a marking condition at 3,000';

  DELETE FROM public.property_security_policies WHERE object_type_id = v_ot;
  DELETE FROM public.object_security_policies   WHERE object_type_id = v_ot;
  DELETE FROM public.object_types WHERE id = v_ot;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF EXISTS (SELECT 1 FROM public.object_types WHERE api_name = 'ZzProof826')
     OR EXISTS (SELECT 1 FROM public.property_security_policies WHERE name = 'hide PII properties') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
