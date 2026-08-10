-- 421 — submission criteria are a tree
--
-- Reading: mirror/action-types/submission-criteria (the whole page this time)
--
-- CORRECTING 418. I built submission criteria from the first half of that page
-- and stopped reading at the Conditions section. The second half contains four
-- things I therefore did not build, and one of them is structural:
--
--   OPERATORS are a named vocabulary of ten, split by whether the parameter
--   holds one value or many. I stored `operator text` with no constraint.
--
--   THE VALUE has three forms — a parameter, a static value, or NO VALUE, where
--   "no value checks whether the first value is empty (or null)". I had one
--   `comparison jsonb` conflating all three.
--
--   LOGICAL OPERATORS nest: "A logical operator can be used to combine different
--   conditions. Logical operators can also be NESTED to create even more complex
--   logic and can require either ALL, ANY, or NO conditions underneath it to be
--   met to pass." I built a flat list, which is a hardcoded AND.
--
--   FAILURE MESSAGES: "Every condition and logical operator on the root level
--   has its own failure message… The failure message will be displayed to the
--   end user across Foundry whenever a condition is not met." I had none.
--
-- So criteria are a TREE of nodes — a leaf is a condition, a branch is a logical
-- operator — and the flat table is replaced rather than extended. Nothing is in
-- it yet, so this is a rebuild, not a migration of data.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.action_type_submission_criteria;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Migration 421: % criteria exist; this replaces the table rather than migrating it', n;
  END IF;
END $$;

DROP TABLE public.action_type_submission_criteria;

-- ── the vocabulary, quoted ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submission_operators()
RETURNS TABLE (operator text, arity text, note text)
LANGUAGE sql IMMUTABLE AS $$
  -- "operators are pre-filtered to only show a selection of operators valid for
  --  the parameter", so arity is the filter.
  VALUES
    ('is',                       'single', 'The left value exactly matches the right value'),
    ('is not',                   'single', 'The left value and right value do not match'),
    ('matches',                  'single', 'The left value matches the Regular Expression'),
    ('is less than',             'single', 'The left value is smaller than the right value'),
    ('is greater than or equals','single', 'The left value is greater than the right value'),
    ('includes',                 'multi',  'At least one of the left values exactly matches the right value'),
    ('includes any',             'multi',  'At least one of the left values exactly matches at least one of the right values'),
    ('is included in',           'multi',  'The left value exactly matches at least one of the right values'),
    ('each is',                  'multi',  'All left values exactly match the right value'),
    ('each is not',              'multi',  'All left values do not exactly match the right value')
$$;

COMMENT ON FUNCTION public.submission_operators() IS
  'The ten operators submission-criteria names, with the descriptions the page gives. `arity` is what "operators are pre-filtered to only show a selection valid for the parameter" means.';

-- ── the tree ─────────────────────────────────────────────────────────────────

CREATE TABLE public.action_type_submission_criteria (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  -- NULL is the root level, which is the level that carries a failure message.
  parent_id      uuid REFERENCES public.action_type_submission_criteria(id) ON DELETE CASCADE,
  position       integer NOT NULL DEFAULT 0,

  -- A leaf is a condition; a branch is a logical operator.
  node_type      text NOT NULL CHECK (node_type IN ('condition','logical')),

  -- "can require either ALL, ANY, or NO conditions underneath it to be met"
  logical_operator text CHECK (logical_operator IN ('all','any','none')),

  -- ── the condition's left side: "based on current user" or "based on parameter"
  template       text CHECK (template IN ('current_user','parameter')),
  parameter_id   uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  -- "The Current User input can be used to check a user's ID, group memberships
  --  via group IDs, or any other multipass attribute available"
  user_field     text CHECK (user_field IN ('user_id','group_ids','attribute')),
  attribute_name text,

  operator       text,

  -- ── the right side. "The value can either be based on an existing parameter,
  --    a static value, or NO VALUE. No value checks whether the first value is
  --    empty (or null)."
  value_source   text CHECK (value_source IN ('parameter','static','none')),
  value_parameter_id uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  static_value   jsonb,

  -- "Every condition and logical operator on the root level has its own failure
  --  message… If conditions of lower levels are not met, the failure message of
  --  the corresponding root level (parent) is displayed."
  failure_message text NOT NULL DEFAULT '',

  -- A branch carries a logical operator and nothing else; a leaf carries a
  -- condition and no logical operator.
  CHECK ((node_type = 'logical')   = (logical_operator IS NOT NULL)),
  CHECK ((node_type = 'condition') = (template IS NOT NULL)),
  CHECK ((node_type = 'condition') = (operator IS NOT NULL)),
  CHECK ((node_type = 'condition') = (value_source IS NOT NULL)),
  -- The template decides which side of the left-hand value is populated.
  CHECK (node_type <> 'condition' OR ((template = 'parameter') = (parameter_id IS NOT NULL))),
  CHECK (node_type <> 'condition' OR ((template = 'current_user') = (user_field IS NOT NULL))),
  -- And the value source decides what the right side carries.
  CHECK (value_source IS DISTINCT FROM 'parameter' OR value_parameter_id IS NOT NULL),
  CHECK (value_source IS DISTINCT FROM 'static'    OR static_value IS NOT NULL),
  CHECK (value_source IS DISTINCT FROM 'none'      OR (value_parameter_id IS NULL AND static_value IS NULL))
);

COMMENT ON TABLE public.action_type_submission_criteria IS
  'A tree: a leaf is a condition, a branch is a logical operator requiring all/any/none of its children. Root-level nodes carry the failure message shown to the user.';
COMMENT ON COLUMN public.action_type_submission_criteria.failure_message IS
  'Shown "across Foundry (Object Explorer, Workshop, or Quiver) whenever a condition is not met". Children fall back to their root ancestor''s message.';

CREATE INDEX idx_criteria_action ON public.action_type_submission_criteria (action_type_id);
CREATE INDEX idx_criteria_parent ON public.action_type_submission_criteria (parent_id);

CREATE OR REPLACE FUNCTION public.guard_submission_criterion()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ar text; parent_action uuid; p_multi boolean;
BEGIN
  IF NEW.node_type = 'condition' THEN
    SELECT o.arity INTO ar FROM public.submission_operators() o WHERE o.operator = NEW.operator;
    IF ar IS NULL THEN
      RAISE EXCEPTION 'Actions:UnknownSubmissionOperator — "%" is not a submission operator', NEW.operator
        USING HINT = 'The ten operators are in submission_operators().';
    END IF;

    -- "operators are pre-filtered to only show a selection of operators valid
    --  for the parameter." Group IDs are a list, so they take the multi-value
    --  operators; a single-valued left side takes the single ones.
    IF NEW.template = 'current_user' THEN
      p_multi := NEW.user_field IN ('group_ids','attribute');
      IF p_multi AND ar <> 'multi' THEN
        RAISE EXCEPTION 'Actions:OperatorArityMismatch — % is a list, so it takes a multi-value operator, not "%"',
          NEW.user_field, NEW.operator
          USING HINT = 'Multipass attributes are treated as string lists; group membership is a list too.';
      END IF;
      IF NOT p_multi AND ar <> 'single' THEN
        RAISE EXCEPTION 'Actions:OperatorArityMismatch — % is a single value, so it takes a single-value operator, not "%"',
          NEW.user_field, NEW.operator;
      END IF;
    END IF;

    -- "Submission criteria do not support attachment and object set parameters."
    IF NEW.parameter_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.action_type_parameters p
          WHERE p.id = NEW.parameter_id AND p.base_type = 'attachment') THEN
      RAISE EXCEPTION 'Actions:ParameterNotSupportedInCriteria — submission criteria do not support attachment parameters';
    END IF;
  END IF;

  -- A node and its parent belong to the same action type.
  IF NEW.parent_id IS NOT NULL THEN
    SELECT action_type_id INTO parent_action
      FROM public.action_type_submission_criteria WHERE id = NEW.parent_id;
    IF parent_action IS DISTINCT FROM NEW.action_type_id THEN
      RAISE EXCEPTION 'Actions:CriterionCrossesActionTypes — a criterion sits under a node of its own action type';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER guard_submission_criterion
  BEFORE INSERT OR UPDATE ON public.action_type_submission_criteria
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_criterion();

-- The message a user is shown: "If conditions of lower levels are not met, the
-- failure message of the corresponding ROOT LEVEL (parent) is displayed."
CREATE OR REPLACE FUNCTION public.criterion_failure_message(p_node uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  WITH RECURSIVE up AS (
    SELECT id, parent_id, failure_message
      FROM public.action_type_submission_criteria WHERE id = p_node
    UNION ALL
    SELECT c.id, c.parent_id, c.failure_message
      FROM public.action_type_submission_criteria c JOIN up ON up.parent_id = c.id
  )
  SELECT failure_message FROM up WHERE parent_id IS NULL
$$;

COMMENT ON FUNCTION public.criterion_failure_message(uuid) IS
  'The message shown when this criterion fails: its own if it is root-level, otherwise its root ancestor''s.';

REVOKE ALL ON FUNCTION public.criterion_failure_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criterion_failure_message(uuid) TO authenticated;

-- ── access, as 418 had it ────────────────────────────────────────────────────

ALTER TABLE public.action_type_submission_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read criteria" ON public.action_type_submission_criteria
  FOR SELECT USING (public.can_read_action_type(action_type_id));
CREATE POLICY "write criteria" ON public.action_type_submission_criteria
  FOR ALL USING (public.can_write_action_type(action_type_id))
  WITH CHECK (public.can_write_action_type(action_type_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_type_submission_criteria TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────
-- The page's own worked example: an airline lets only flight controllers change
-- the aircraft on a flight, and only while the aircraft is still operational.

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; act uuid; aircraft uuid;
  p_aircraft uuid; root uuid; c1 uuid; c2 uuid;
  usr uuid := gen_random_uuid(); claims text; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '421@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m421') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m421') RETURNING id INTO sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'm421', 'm421') RETURNING id INTO ont;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Aircraft', 'Aircraft') RETURNING id INTO aircraft;
  INSERT INTO public.action_types (ontology_id, organization_id, api_name, label)
       VALUES (ont, org, 'change-aircraft', 'Change aircraft') RETURNING id INTO act;
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, object_type_id)
  VALUES (act, 'aircraft', 'Aircraft', aircraft) RETURNING id INTO p_aircraft;

  -- The root: "require ALL conditions underneath it".
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, node_type, logical_operator, failure_message)
  VALUES (act, 'logical', 'all',
          'You must be a flight controller, and the aircraft must be operational.')
  RETURNING id INTO root;

  -- "we need to select the `includes` operator to check for an overlap" —
  -- group membership is a list, so the operator is a multi-value one.
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, parent_id, node_type, template, user_field, operator,
     value_source, static_value)
  VALUES (act, root, 'condition', 'current_user', 'group_ids', 'includes',
          'static', '"flight-controllers"'::jsonb)
  RETURNING id INTO c1;

  -- "the operating status needs to exactly match an expected status, so the
  --  `is` operator must be set."
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, parent_id, node_type, template, parameter_id, operator,
     value_source, static_value)
  VALUES (act, root, 'condition', 'parameter', p_aircraft, 'is',
          'static', '"Yes"'::jsonb)
  RETURNING id INTO c2;

  -- "the failure message of the corresponding root level (parent) is displayed"
  IF public.criterion_failure_message(c1) NOT LIKE 'You must be a flight controller%' THEN
    RAISE EXCEPTION 'Migration 421: a child did not inherit its root''s failure message';
  END IF;

  -- Group IDs are a list; a single-value operator on them is the misconfiguration
  -- the page's example exists to prevent.
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, node_type, template, user_field, operator,
       value_source, static_value)
    VALUES (act, root, 'condition', 'current_user', 'group_ids', 'is',
            'static', '"flight-controllers"'::jsonb);
    RAISE EXCEPTION 'Migration 421: a single-value operator was accepted on a list';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Actions:OperatorArityMismatch%' THEN RAISE; END IF;
  END;

  -- An operator that is not one of the ten.
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, node_type, template, parameter_id, operator,
       value_source, static_value)
    VALUES (act, root, 'condition', 'parameter', p_aircraft, 'sort of resembles',
            'static', '"Yes"'::jsonb);
    RAISE EXCEPTION 'Migration 421: an invented operator was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Actions:UnknownSubmissionOperator%' THEN RAISE; END IF;
  END;

  -- "No value checks whether the first value is empty (or null)" — and carries
  -- neither a parameter nor a static value.
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, parent_id, node_type, template, parameter_id, operator, value_source)
  VALUES (act, root, 'condition', 'parameter', p_aircraft, 'is not', 'none');
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, node_type, template, parameter_id, operator,
       value_source, static_value)
    VALUES (act, root, 'condition', 'parameter', p_aircraft, 'is', 'none', '"x"'::jsonb);
    RAISE EXCEPTION 'Migration 421: a no-value condition carried a value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A branch carries a logical operator and no condition; a leaf the reverse.
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, node_type, logical_operator, template, operator, value_source)
    VALUES (act, 'logical', 'any', 'parameter', 'is', 'none');
    RAISE EXCEPTION 'Migration 421: a logical node carried a condition';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Nesting: "logical operators can also be nested".
  DECLARE nested uuid;
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, node_type, logical_operator)
    VALUES (act, root, 'logical', 'any') RETURNING id INTO nested;
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, node_type, template, user_field, operator,
       value_source, static_value)
    VALUES (act, nested, 'condition', 'current_user', 'user_id', 'is',
            'static', '"someone"'::jsonb);
    -- Two levels down, the root's message is still the one shown.
    IF public.criterion_failure_message(
         (SELECT id FROM public.action_type_submission_criteria WHERE parent_id = nested)
       ) NOT LIKE 'You must be a flight controller%' THEN
      RAISE EXCEPTION 'Migration 421: a grandchild did not reach the root message';
    END IF;
  END;

  -- Readable as the role the product runs as.
  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.action_type_submission_criteria WHERE action_type_id = act;
  IF n <> 6 THEN
    RAISE EXCEPTION 'Migration 421: authenticated sees % criteria nodes, expected 6', n;
  END IF;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.action_types WHERE ontology_id = ont;
  DELETE FROM public.object_types WHERE ontology_id = ont;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
