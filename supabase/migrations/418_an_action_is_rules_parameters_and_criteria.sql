-- 418 — an action is rules, parameters and submission criteria
--
-- Reading: mirror/action-types/{overview,rules,parameter-overview,submission-criteria}
--          docs/foundry-reference/readings/deep-dive-ontology.md (§11)
--          docs/ONTOLOGY-BUILD-MAP.md, phase C
--
--   "An action is a SINGLE TRANSACTION that changes the properties of one or
--    more objects, based on a user-defined logic."
--
--   "An ACTION TYPE is the definition of a set of changes or edits to objects,
--    property values, and links that a user can take at once."
--
-- Three parts, and the pages name them as the three things to learn:
--
--   RULES                "define the logic of the action type that transform the
--                         parameters into Ontology edits or other effects"
--   PARAMETERS           "the inputs of an action type… the interface between the
--                         Rules and other Foundry applications"
--   SUBMISSION CRITERIA  "the conditions that determine whether an action can be
--                         submitted… Actions can only be submitted if ALL the
--                         submission criteria are met"
--
-- AND THE SENTENCE THAT IS THE WHOLE DESIGN, from the training course:
--
--   "Because we've only defined one action that touches only the Root Cause
--    property, THIS IS THE ONLY PROPERTY THAT USERS CAN EDIT."
--
-- A rule's declared property set is the edit permission. Nothing else may write.
--
-- ── SCOPE, and what is deliberately left ─────────────────────────────────────
-- `rules.md` lists twelve Ontology rule kinds. Five are object and link rules on
-- concrete types; five more are the `…of interface` variants, which need B5
-- (interface link constraints) first; one is the function rule; one is
-- create-or-modify. Built here: the six that need nothing we do not have.
--
-- The three side-effect rules — notification, webhook, schedule — each name a
-- system we have no counterpart for. Left out rather than stubbed.
--
-- No RID column. An action type's RID form is not attested anywhere in the
-- corpus; the deep dive screenshot shows a bare uuid where one would be. Same
-- call as link types in 417: a missing RID is a gap, a wrong one is a lie in
-- every row.

BEGIN;

-- ── the action type ──────────────────────────────────────────────────────────

CREATE TABLE public.action_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_id     uuid NOT NULL DEFAULT public.default_ontology(),
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- The deep dive shows `API username-assign-root-cause` beside a display name
  -- of "[username] Assign root cause".
  api_name        text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9-]*$'),
  label           text NOT NULL CHECK (length(btrim(label)) > 0),
  description     text NOT NULL DEFAULT '',

  status          text NOT NULL DEFAULT 'experimental'
                    CHECK (status IN ('active','experimental','deprecated')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (ontology_id, api_name),
  FOREIGN KEY (ontology_id, organization_id)
    REFERENCES public.ontologies (id, organization_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.action_types IS
  'The definition of a set of edits a user can take at once. "An action is a single transaction that changes the properties of one or more objects."';

-- ── parameters ───────────────────────────────────────────────────────────────
--   "Parameters are treated like variables that contain external values. Each
--    parameter is defined by a type… Each parameter can be individually
--    configured as to whether they are EXPOSED in the form or not, or whether
--    they can be CHANGED by the user or not."

CREATE TABLE public.action_type_parameters (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,

  api_name       text NOT NULL CHECK (api_name ~ '^[a-z][A-Za-z0-9]*$'),
  display_name   text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description    text NOT NULL DEFAULT '',

  -- A parameter is either a value of a base type, or a reference to an object.
  -- "A parameter can take the form of a `Ticket` object type in an action type
  --  which allows users to modify the status of a selected ticket."
  base_type      text CHECK (base_type = ANY (public.property_base_types())),
  object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  CHECK ((base_type IS NOT NULL) <> (object_type_id IS NOT NULL)),

  required       boolean NOT NULL DEFAULT true,
  -- The two the page calls out by name.
  exposed        boolean NOT NULL DEFAULT true,
  editable       boolean NOT NULL DEFAULT true,
  position       integer NOT NULL DEFAULT 0,

  UNIQUE (action_type_id, api_name)
);

COMMENT ON COLUMN public.action_type_parameters.exposed IS
  'Whether the parameter appears in the form. A hidden parameter still carries a value — the page''s example passes `previous_status` into one.';
COMMENT ON COLUMN public.action_type_parameters.editable IS
  'Whether the user may change it. Exposed-but-not-editable shows the value without offering to alter it.';

-- ── rules ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.action_rule_kinds()
RETURNS TABLE (kind text, targets text, note text)
LANGUAGE sql IMMUTABLE AS $$
  -- Quoted from action-types/rules. The five `…of interface` kinds and the three
  -- side-effect kinds are not here: see the header.
  VALUES
    ('create_object',           'object_type',
       'Create an object of a predefined type. The primary key is a required property which has to be filled'),
    ('modify_object',           'object_type',
       'Modify an existing object whose primary key is derived from object reference parameters. This cannot reference an object created as a part of the current action'),
    ('create_or_modify_object', 'object_type',
       'Modify an existing object based on an object reference parameter. If an object is not selected, a new object will be created'),
    ('delete_object',           'object_type',
       'Delete an existing object whose primary key is derived from object reference parameters. This cannot reference an object created as a part of the current action'),
    ('create_link',             'link_type',
       'Create a many-to-many link between objects passed via object reference parameters. For foreign key links, use Modify object to modify the foreign key property'),
    ('delete_link',             'link_type',
       'Delete a many-to-many link between objects passed via object reference parameters'),
    ('function',                'none',
       'Reference an Ontology edit function whose inputs are derived from parameters. When this rule is present, NO OTHER RULE may be configured')
$$;

CREATE TABLE public.action_type_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  kind           text NOT NULL,
  -- "The order of rules affects the final object edit."
  position       integer NOT NULL DEFAULT 0,

  object_type_id uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  link_type_id   uuid REFERENCES public.link_types(id) ON DELETE CASCADE,
  function_name  text,

  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.action_type_rules IS
  'The logic that turns parameters into Ontology edits. Ordered, because "the order of rules affects the final object edit".';

-- ── the properties a rule touches — and the permission they constitute ───────
--   "Each property in return is mapped to a value provided by one of multiple
--    options": From parameter · Object parameter property · Static value ·
--    Current User/Time.

CREATE TABLE public.action_type_rule_properties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id      uuid NOT NULL REFERENCES public.action_type_rules(id) ON DELETE CASCADE,
  property_id  uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE CASCADE,

  value_source text NOT NULL CHECK (value_source IN
    ('parameter','object_parameter_property','static','current_user','current_time')),
  parameter_id uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  static_value jsonb,

  -- "From parameter" and "Object parameter property" both name one; the two
  -- contextual sources name none, and neither carries a static value.
  CHECK ((value_source IN ('parameter','object_parameter_property')) = (parameter_id IS NOT NULL)),
  CHECK ((value_source = 'static') = (static_value IS NOT NULL)),

  UNIQUE (rule_id, property_id)
);

COMMENT ON TABLE public.action_type_rule_properties IS
  'Which properties a rule writes, and where each value comes from. THIS IS THE EDIT PERMISSION: "because we have only defined one action that touches only the Root Cause property, this is the only property that users can edit".';

-- ── submission criteria ──────────────────────────────────────────────────────
--   "Conditions are single statements governing the values of parameters or user
--    properties." Two templates: "based on current user" or "based on parameter".

CREATE TABLE public.action_type_submission_criteria (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  position       integer NOT NULL DEFAULT 0,

  template       text NOT NULL CHECK (template IN ('current_user','parameter')),
  -- What is being compared, and to what.
  parameter_id   uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  user_field     text CHECK (user_field IN ('user_id','group_ids','attribute')),
  attribute_name text,
  operator       text NOT NULL,
  comparison     jsonb NOT NULL DEFAULT 'null'::jsonb,

  -- The template decides which side is populated.
  CHECK ((template = 'parameter')    = (parameter_id IS NOT NULL)),
  CHECK ((template = 'current_user') = (user_field   IS NOT NULL))
);

COMMENT ON TABLE public.action_type_submission_criteria IS
  'The conditions that decide whether an action may be submitted. ALL must pass. Independent of who may edit the action type itself.';

-- ── the rules the pages state ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_action_type_rule()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE targets text; n int; act_ont uuid; tgt_ont uuid;
BEGIN
  SELECT k.targets INTO targets FROM public.action_rule_kinds() k WHERE k.kind = NEW.kind;
  IF targets IS NULL THEN
    RAISE EXCEPTION 'Ontology:UnknownActionRuleKind — % is not a rule kind', NEW.kind
      USING HINT = 'Kinds come from action_rule_kinds(), which mirrors action-types/rules.';
  END IF;

  -- Each kind names exactly the target it operates on.
  IF targets = 'object_type' AND NEW.object_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsObjectType — % operates on an object type', NEW.kind;
  END IF;
  IF targets = 'link_type' AND NEW.link_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsLinkType — % operates on a link type', NEW.kind;
  END IF;
  IF targets = 'none' AND NEW.function_name IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsFunction — a function rule names a function';
  END IF;

  -- "When this rule is present, NO OTHER RULE may be configured since function
  --  code alone is capable of handling everything that other rules can do."
  SELECT count(*) INTO n FROM public.action_type_rules r
   WHERE r.action_type_id = NEW.action_type_id AND r.id IS DISTINCT FROM NEW.id;
  IF NEW.kind = 'function' AND n > 0 THEN
    RAISE EXCEPTION 'Ontology:FunctionRuleIsExclusive — a function rule is the only rule an action may have';
  END IF;
  IF NEW.kind <> 'function' AND EXISTS (
       SELECT 1 FROM public.action_type_rules r
        WHERE r.action_type_id = NEW.action_type_id AND r.kind = 'function'
          AND r.id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'Ontology:FunctionRuleIsExclusive — this action is already backed by a function rule';
  END IF;

  -- An action edits its own ontology.
  SELECT ontology_id INTO act_ont FROM public.action_types WHERE id = NEW.action_type_id;
  IF NEW.object_type_id IS NOT NULL THEN
    SELECT ontology_id INTO tgt_ont FROM public.object_types WHERE id = NEW.object_type_id;
  ELSIF NEW.link_type_id IS NOT NULL THEN
    SELECT ontology_id INTO tgt_ont FROM public.link_types WHERE id = NEW.link_type_id;
  END IF;
  IF tgt_ont IS NOT NULL AND tgt_ont IS DISTINCT FROM act_ont THEN
    RAISE EXCEPTION 'Ontology:ActionCrossesOntologies — an action type edits its own ontology';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER guard_action_type_rule
  BEFORE INSERT OR UPDATE ON public.action_type_rules
  FOR EACH ROW EXECUTE FUNCTION public.guard_action_type_rule();

-- A rule writes properties of the object type it targets, and nothing else.
CREATE OR REPLACE FUNCTION public.guard_action_rule_property()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rule_target uuid; prop_owner uuid; rule_kind text;
BEGIN
  SELECT r.object_type_id, r.kind INTO rule_target, rule_kind
    FROM public.action_type_rules r WHERE r.id = NEW.rule_id;
  IF rule_target IS NULL THEN
    RAISE EXCEPTION 'Ontology:RuleWritesNoProperties — % does not write object properties', rule_kind;
  END IF;

  SELECT p.object_type_id INTO prop_owner
    FROM public.object_type_properties p WHERE p.id = NEW.property_id;
  IF prop_owner IS DISTINCT FROM rule_target THEN
    RAISE EXCEPTION 'Ontology:PropertyNotOnRuleTarget — a rule writes properties of the object type it edits';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_action_rule_property
  BEFORE INSERT OR UPDATE ON public.action_type_rule_properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_action_rule_property();

-- ── what an action may edit, as one query ────────────────────────────────────
-- The design sentence, made answerable.

CREATE OR REPLACE FUNCTION public.action_editable_properties(p_action uuid)
RETURNS TABLE (object_type text, property text, rule_kind text)
LANGUAGE sql STABLE AS $$
  SELECT t.api_name, p.api_name, r.kind
    FROM public.action_type_rules r
    JOIN public.action_type_rule_properties rp ON rp.rule_id = r.id
    JOIN public.object_type_properties p ON p.id = rp.property_id
    JOIN public.object_types t ON t.id = p.object_type_id
   WHERE r.action_type_id = p_action
   ORDER BY r.position, p.position
$$;

COMMENT ON FUNCTION public.action_editable_properties(uuid) IS
  'Every property this action type can write. "Because we have only defined one action that touches only the Root Cause property, this is the only property that users can edit."';

REVOKE ALL ON FUNCTION public.action_editable_properties(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.action_editable_properties(uuid) TO authenticated;

-- ── access ───────────────────────────────────────────────────────────────────

ALTER TABLE public.action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_type_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_type_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_type_rule_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_type_submission_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read action types in scope" ON public.action_types
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id()));
CREATE POLICY "admins author action types" ON public.action_types
  FOR ALL USING (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
                 AND public.auth_role() IN ('owner','admin'))
  WITH CHECK (NOT (organization_id IS DISTINCT FROM public.auth_org_id())
              AND public.auth_role() IN ('owner','admin'));

-- The three children follow their action type, the way a property follows its
-- object type (408). One rule, composed, not restated four times.
CREATE OR REPLACE FUNCTION public.can_read_action_type(p_action uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.action_types a
                  WHERE a.id = p_action
                    AND a.organization_id IS NOT DISTINCT FROM public.auth_org_id())
$$;
CREATE OR REPLACE FUNCTION public.can_write_action_type(p_action uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_read_action_type(p_action) AND public.auth_role() IN ('owner','admin')
$$;

REVOKE ALL ON FUNCTION public.can_read_action_type(uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_action_type(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_action_type(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_action_type(uuid) TO authenticated;

CREATE POLICY "read parameters" ON public.action_type_parameters
  FOR SELECT USING (public.can_read_action_type(action_type_id));
CREATE POLICY "write parameters" ON public.action_type_parameters
  FOR ALL USING (public.can_write_action_type(action_type_id))
  WITH CHECK (public.can_write_action_type(action_type_id));

CREATE POLICY "read rules" ON public.action_type_rules
  FOR SELECT USING (public.can_read_action_type(action_type_id));
CREATE POLICY "write rules" ON public.action_type_rules
  FOR ALL USING (public.can_write_action_type(action_type_id))
  WITH CHECK (public.can_write_action_type(action_type_id));

CREATE POLICY "read criteria" ON public.action_type_submission_criteria
  FOR SELECT USING (public.can_read_action_type(action_type_id));
CREATE POLICY "write criteria" ON public.action_type_submission_criteria
  FOR ALL USING (public.can_write_action_type(action_type_id))
  WITH CHECK (public.can_write_action_type(action_type_id));

CREATE POLICY "read rule properties" ON public.action_type_rule_properties
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.action_type_rules r
                             WHERE r.id = rule_id AND public.can_read_action_type(r.action_type_id)));
CREATE POLICY "write rule properties" ON public.action_type_rule_properties
  FOR ALL USING (EXISTS (SELECT 1 FROM public.action_type_rules r
                          WHERE r.id = rule_id AND public.can_write_action_type(r.action_type_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.action_type_rules r
                       WHERE r.id = rule_id AND public.can_write_action_type(r.action_type_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_types                     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_type_parameters           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_type_rules                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_type_rule_properties      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_type_submission_criteria  TO authenticated;

CREATE INDEX idx_action_types_ontology ON public.action_types (ontology_id);
CREATE INDEX idx_action_rules_action   ON public.action_type_rules (action_type_id);
CREATE INDEX idx_action_params_action  ON public.action_type_parameters (action_type_id);

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; ds uuid; br uuid; bind uuid;
  alert uuid; other uuid; act uuid; rule uuid; p_root uuid; p_alert uuid;
  prop_root uuid; prop_title uuid; prop_other uuid; fn_rule uuid;
  usr uuid := gen_random_uuid(); claims text; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '418@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m418') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m418') RETURNING id INTO sp;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'm418', 'm418') RETURNING id INTO ont;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm418', 'm418') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'alerts', 'alerts') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'FlightAlert', 'Flight Alert') RETURNING id INTO alert;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Flight', 'Flight') RETURNING id INTO other;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
       VALUES (alert, ds, br) RETURNING id INTO bind;

  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source)
  VALUES (alert, 'root_cause', 'Root Cause', 'rootCause', 'string', 'user_input')
  RETURNING id INTO prop_root;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, backing_column, datasource_id)
  VALUES (alert, 'alert_title', 'Alert Title', 'alertTitle', 'string', 'title', bind)
  RETURNING id INTO prop_title;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source)
  VALUES (other, 'callsign', 'Callsign', 'callsign', 'string', 'user_input')
  RETURNING id INTO prop_other;

  -- The course's own action, built as the course builds it: Modify object,
  -- touching exactly one property.
  INSERT INTO public.action_types (ontology_id, organization_id, api_name, label)
       VALUES (ont, org, 'assign-root-cause', 'Assign root cause') RETURNING id INTO act;
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, object_type_id)
  VALUES (act, 'flightAlert', 'Flight Alert', alert) RETURNING id INTO p_alert;
  INSERT INTO public.action_type_parameters
    (action_type_id, api_name, display_name, base_type)
  VALUES (act, 'rootCause', 'Root Cause', 'string') RETURNING id INTO p_root;

  INSERT INTO public.action_type_rules (action_type_id, kind, object_type_id)
       VALUES (act, 'modify_object', alert) RETURNING id INTO rule;
  INSERT INTO public.action_type_rule_properties
    (rule_id, property_id, value_source, parameter_id)
  VALUES (rule, prop_root, 'parameter', p_root);

  -- "this is the only property that users can edit"
  SELECT count(*) INTO n FROM public.action_editable_properties(act);
  IF n <> 1 THEN
    RAISE EXCEPTION 'Migration 418: the action reports % editable properties, expected 1', n;
  END IF;
  IF (SELECT property FROM public.action_editable_properties(act)) <> 'rootCause' THEN
    RAISE EXCEPTION 'Migration 418: the wrong property is editable';
  END IF;

  -- A parameter is a value OR an object reference, never both and never neither.
  BEGIN
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, object_type_id)
    VALUES (act, 'both', 'Both', 'string', alert);
    RAISE EXCEPTION 'Migration 418: a parameter was both a value and an object reference';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A rule writes properties of the object type it edits, and nothing else.
  BEGIN
    INSERT INTO public.action_type_rule_properties
      (rule_id, property_id, value_source, parameter_id)
    VALUES (rule, prop_other, 'parameter', p_root);
    RAISE EXCEPTION 'Migration 418: a rule wrote another object type''s property';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:PropertyNotOnRuleTarget%' THEN RAISE; END IF;
  END;

  -- A static value carries one; a parameter source names one. Neither borrows.
  BEGIN
    INSERT INTO public.action_type_rule_properties
      (rule_id, property_id, value_source, parameter_id)
    VALUES (rule, prop_title, 'static', p_root);
    RAISE EXCEPTION 'Migration 418: a static source named a parameter';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.action_type_rule_properties
    (rule_id, property_id, value_source, static_value)
  VALUES (rule, prop_title, 'static', '"Resolved"'::jsonb);

  -- "When this rule is present, no other rule may be configured."
  BEGIN
    INSERT INTO public.action_type_rules (action_type_id, kind, function_name)
         VALUES (act, 'function', 'resolveAlert');
    RAISE EXCEPTION 'Migration 418: a function rule joined an action that already had rules';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:FunctionRuleIsExclusive%' THEN RAISE; END IF;
  END;

  -- And the same rule from the other direction.
  DECLARE act2 uuid;
  BEGIN
    INSERT INTO public.action_types (ontology_id, organization_id, api_name, label)
         VALUES (ont, org, 'by-function', 'By function') RETURNING id INTO act2;
    INSERT INTO public.action_type_rules (action_type_id, kind, function_name)
         VALUES (act2, 'function', 'resolveAlert') RETURNING id INTO fn_rule;
    BEGIN
      INSERT INTO public.action_type_rules (action_type_id, kind, object_type_id)
           VALUES (act2, 'modify_object', alert);
      RAISE EXCEPTION 'Migration 418: a rule joined a function-backed action';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:FunctionRuleIsExclusive%' THEN RAISE; END IF;
    END;
    DELETE FROM public.action_types WHERE id = act2;
  END;

  -- Each kind names the target it operates on.
  BEGIN
    INSERT INTO public.action_type_rules (action_type_id, kind) VALUES (act, 'create_link');
    RAISE EXCEPTION 'Migration 418: a link rule was accepted with no link type';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:ActionRuleNeedsLinkType%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.action_type_rules (action_type_id, kind, object_type_id)
         VALUES (act, 'teleport_object', alert);
    RAISE EXCEPTION 'Migration 418: an invented rule kind was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:UnknownActionRuleKind%' THEN RAISE; END IF;
  END;

  -- Submission criteria: "based on current user" or "based on parameter".
  INSERT INTO public.action_type_submission_criteria
    (action_type_id, template, user_field, operator, comparison)
  VALUES (act, 'current_user', 'group_ids', 'contains', '"flight-controllers"'::jsonb);
  BEGIN
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, template, operator, comparison)
    VALUES (act, 'parameter', 'eq', '"x"'::jsonb);
    RAISE EXCEPTION 'Migration 418: a parameter criterion named no parameter';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Readable and writable as the role the product runs as.
  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.action_editable_properties(act);
  IF n <> 2 THEN
    RAISE EXCEPTION 'Migration 418: authenticated sees % editable properties, expected 2', n;
  END IF;
  IF (SELECT count(*) FROM public.action_type_rules WHERE action_type_id = act) <> 1 THEN
    RAISE EXCEPTION 'Migration 418: authenticated cannot read the action''s rules';
  END IF;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.action_types WHERE ontology_id = ont;
  DELETE FROM public.object_type_properties
   WHERE object_type_id IN (SELECT id FROM public.object_types WHERE ontology_id = ont);
  DELETE FROM public.object_type_datasources WHERE object_type_id = alert;
  DELETE FROM public.object_types WHERE ontology_id = ont;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.dataset_branches WHERE dataset_id = ds;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
