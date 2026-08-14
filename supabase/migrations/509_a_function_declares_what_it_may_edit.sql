-- An edit function declares its provenance, and the rule that runs it pins a version.
--
-- "you can use the `@Edits` decorator and specify the object types for which
--  your function returns edits"
-- "Currently, the provenance consists only of the object types that the action
--  may edit at runtime."                (action-types/function-actions-getting-started)
--
-- This is a SECOND declaration, not a widening of 501's `imports`. Imports are
-- what a function may READ; provenance is what it may EDIT. The published
-- failure type names the unit and settles that it is object types:
--
--   "Undeclared object types edited error: The function execution attempts to
--    update, create or delete an object whose object type is not declared in
--    the function spec."                        (functions/function-metrics)
--
-- Link types are absent from that sentence and do not need to be there: a
-- foreign-key link edit IS an object edit —
--
--   "For foreign key links, one has to use Modify object rule to explicitly
--    modify the foreign key property."                 (action-types/rules)
--
-- and many-to-many links are the only true link edit, which needs a link
-- instance store this platform does not have.
--
-- ── WHAT THE RULE HOLDS ─────────────────────────────────────────────────────
-- 418 stored a function NAME and nothing else, which is why the rule has
-- pointed at nothing since it landed. The Run function card in
-- action-types/images/function_backed_actions_configure_inputs.png shows three
-- things the prose does not: a pinned VERSION (`0.1.2` in a dropdown), an
-- `Auto upgrade to compatible versions` toggle, and `Required inputs` mapping
-- each function input to an action parameter. All three land here.
--
--   "By default, if the function logic is changed, the action does not
--    automatically update to match it."
--
-- so auto_upgrade defaults false. It ships off and stays off: the page lists
-- three risks under its own headings — a user without edit permission on the
-- action can change its behaviour, breaking changes can fail execution, and
-- provenance can drift — and we have no release-review step.
--
-- ── WHERE A FUNCTION RULE RUNS ──────────────────────────────────────────────
-- Not here. apply_action is SQL and cannot execute TypeScript; the isolate
-- lives in the `action-apply` edge function. That is Foundry's own split —
-- "The Actions service is responsible for applying user edits to object
-- databases" (object-backend/overview) while Functions on Objects is a
-- separate service the diagram draws beside it.
--
-- So `executable` stops meaning "apply_action can run it" and the registry
-- says which runtime applies each kind. A function rule is executable; it is
-- simply not executable HERE.

-- ── §1 the provenance declaration ───────────────────────────────────────────
-- The v2 return type. "You must then declare that the function returns an
-- array of edits of the new type."
CREATE OR REPLACE FUNCTION public.function_type_valid(p_type text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_type IN ('boolean', 'string', 'Integer', 'Long', 'Float', 'Double',
                    'LocalDate', 'Timestamp', 'OntologyEdit[]')
      OR p_type ~ '^(boolean|string|Integer|Long|Float|Double|LocalDate|Timestamp)\[\]$'
      OR p_type ~ '^ObjectSet<[A-Za-z][A-Za-z0-9]*>$'
$$;

ALTER TABLE public.function_versions
  ADD COLUMN edits jsonb NOT NULL DEFAULT '{"object_types":[]}'::jsonb;

COMMENT ON COLUMN public.function_versions.edits IS
  'Provenance: the object types this version may edit. Distinct from imports, which is what it may read. An edit outside this list fails the action.';

-- An edit function declares provenance; a query function has none to declare.
-- Both directions, because a query that claims edit provenance is as wrong as
-- an edit function that claims none.
CREATE OR REPLACE FUNCTION public.function_edits_valid(p_sig jsonb, p_edits jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(p_edits->'object_types') = 'array'
     AND (p_sig->>'returns' = 'OntologyEdit[]')
         = (jsonb_array_length(p_edits->'object_types') > 0)
$$;

ALTER TABLE public.function_versions
  ADD CONSTRAINT function_versions_edits_valid
  CHECK (public.function_edits_valid(signature, edits));

-- Provenance names object types that exist, in this version's ontology.
CREATE OR REPLACE FUNCTION public.guard_function_edits()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ont uuid; missing text;
BEGIN
  SELECT f.ontology_id INTO ont FROM public.functions f WHERE f.id = NEW.function_id;
  SELECT string_agg(t.name, ', ') INTO missing
    FROM jsonb_array_elements_text(NEW.edits->'object_types') t(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.object_types ot
      WHERE ot.api_name = t.name AND ot.ontology_id = ont);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Functions:UnknownEditedObjectType — % is not an object type in this ontology', missing;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_function_edits
  BEFORE INSERT OR UPDATE ON public.function_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_function_edits();

-- ── §2 the rule points at a version, and maps its inputs ────────────────────
ALTER TABLE public.action_type_rules
  ADD COLUMN function_version_id uuid REFERENCES public.function_versions(id) ON DELETE RESTRICT,
  ADD COLUMN auto_upgrade boolean NOT NULL DEFAULT false;
CREATE INDEX action_type_rules_function_version_idx
  ON public.action_type_rules (function_version_id);

-- "Configure the inputs to match up to the action parameters" — one row per
-- function input, naming the parameter that supplies it.
CREATE TABLE public.action_type_rule_inputs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id      uuid NOT NULL REFERENCES public.action_type_rules(id) ON DELETE CASCADE,
  input_name   text NOT NULL CHECK (input_name ~ '^[a-z][a-zA-Z0-9]*$'),
  parameter_id uuid NOT NULL REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  UNIQUE (rule_id, input_name)
);
CREATE INDEX action_type_rule_inputs_rule_idx      ON public.action_type_rule_inputs (rule_id);
CREATE INDEX action_type_rule_inputs_parameter_idx ON public.action_type_rule_inputs (parameter_id);
COMMENT ON TABLE public.action_type_rule_inputs IS
  'Which action parameter supplies each input of a function rule''s function. Without it the rule names a function it cannot call.';

-- 418's own two-policy shape on every action child table. The helpers take a
-- row column, so they are row-dependent and deliberately not InitPlan-wrapped.
ALTER TABLE public.action_type_rule_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rule inputs" ON public.action_type_rule_inputs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.action_type_rules r
                             WHERE r.id = rule_id AND public.can_read_action_type(r.action_type_id)));
CREATE POLICY "write rule inputs" ON public.action_type_rule_inputs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.action_type_rules r
                          WHERE r.id = rule_id AND public.can_write_action_type(r.action_type_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.action_type_rules r
                       WHERE r.id = rule_id AND public.can_write_action_type(r.action_type_id)));

-- A function rule names a published version of an EDIT function, and only a
-- function rule may.
CREATE OR REPLACE FUNCTION public.guard_function_rule()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE sig jsonb;
BEGIN
  IF NEW.kind <> 'function' THEN
    IF NEW.function_version_id IS NOT NULL THEN
      RAISE EXCEPTION 'Actions:FunctionVersionOnNonFunctionRule — only a function rule names a function version';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.function_version_id IS NULL THEN
    RAISE EXCEPTION 'Actions:FunctionRuleNeedsVersion — a function rule pins a version, the way the Run function card does';
  END IF;

  SELECT v.signature INTO sig FROM public.function_versions v WHERE v.id = NEW.function_version_id;
  IF sig->>'returns' <> 'OntologyEdit[]' THEN
    RAISE EXCEPTION 'Actions:NotAnEditFunction — this version returns %, and an action applies edits', coalesce(sig->>'returns', 'nothing');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_function_rule
  BEFORE INSERT OR UPDATE ON public.action_type_rules
  FOR EACH ROW EXECUTE FUNCTION public.guard_function_rule();

-- Every required input of the pinned version is mapped. Deferred, because the
-- rule and its inputs are written together.
CREATE OR REPLACE FUNCTION public.assert_rule_inputs_complete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record; missing text;
BEGIN
  FOR r IN
    SELECT ru.id, ru.function_version_id FROM public.action_type_rules ru
     WHERE ru.kind = 'function' AND ru.function_version_id IS NOT NULL
       AND ru.id = coalesce(NEW.rule_id, OLD.rule_id, ru.id)
  LOOP
    SELECT string_agg(p->>'name', ', ') INTO missing
      FROM public.function_versions v,
           jsonb_array_elements(v.signature->'parameters') p
     WHERE v.id = r.function_version_id
       AND (p->>'required')::boolean
       AND NOT EXISTS (SELECT 1 FROM public.action_type_rule_inputs i
                        WHERE i.rule_id = r.id AND i.input_name = p->>'name');
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'Actions:UnmappedFunctionInput — % has no parameter', missing;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER assert_rule_inputs_complete
  AFTER INSERT OR UPDATE OR DELETE ON public.action_type_rule_inputs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_rule_inputs_complete();

-- ── §3 the registry says which runtime applies each kind ────────────────────
-- 446 made `executable` mean "apply_action() can run it". A function rule is
-- executable — just not in SQL — so the fact splits in two.
DROP FUNCTION public.action_rule_kinds();
CREATE FUNCTION public.action_rule_kinds()
RETURNS TABLE (kind text, targets text, executable boolean, runtime text, note text)
LANGUAGE sql IMMUTABLE AS $$
  VALUES
    ('create_object',           'object_type', true,  'sql',
     'Creates a new object; the rule''s properties must produce the primary key.'),
    ('modify_object',           'object_type', true,  'sql',
     'Edits the properties the rule names on an existing object.'),
    ('create_or_modify_object', 'object_type', false, 'sql',
     'Needs an existence check against the merged object; not executable yet.'),
    ('delete_object',           'object_type', true,  'sql',
     'Removes an existing object by primary key.'),
    ('create_link',             'link_type',   false, 'sql',
     'A link instance store does not exist yet.'),
    ('delete_link',             'link_type',   false, 'sql',
     'A link instance store does not exist yet.'),
    ('function',                'none',        true,  'function',
     'Runs an Ontology edit function and applies the edit batch it returns. Applied by the action runtime, which owns the isolate — not by apply_action, which is SQL.')
$$;
COMMENT ON FUNCTION public.action_rule_kinds() IS
  'The seven rule kinds (action-types/rules.md), what each targets, whether it can be applied, and which runtime applies it. The five interface kinds and three side-effect kinds are deliberately absent, as 418 records.';
REVOKE ALL ON FUNCTION public.action_rule_kinds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.action_rule_kinds() TO authenticated;

-- ── §4 apply_action sends a function rule to the runtime that can run it ────
-- Two changes only: the runtime branch, and object_parameter_property stops
-- silently writing NULL. 418 admits that value source —
--   "Object parameter property: A property of an existing object reference
--    parameter."                                       (action-types/rules)
-- — and this CASE never handled it, so a rule declaring it wrote NULL into the
-- property instead of refusing. A declarable value that produces a wrong
-- answer is worse than one that refuses.
CREATE OR REPLACE FUNCTION public.apply_action(
  p_action_type uuid,
  p_parameters  jsonb DEFAULT '{}'::jsonb,
  p_primary_key text  DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  act      record;
  par      record;
  r        record;
  rp       record;
  props    jsonb;
  pk_prop  text;
  pk_val   text;
  written  integer := 0;
BEGIN
  SELECT * INTO act FROM public.action_types WHERE id = p_action_type;
  IF act.id IS NULL THEN
    RAISE EXCEPTION 'Actions:ActionTypeNotFound — % is not an action type you can see', p_action_type;
  END IF;

  FOR par IN SELECT api_name FROM public.action_type_parameters
              WHERE action_type_id = p_action_type AND required
  LOOP
    IF NOT (p_parameters ? par.api_name)
       OR p_parameters->par.api_name = 'null'::jsonb
       OR btrim(p_parameters->>par.api_name) = '' THEN
      RAISE EXCEPTION 'Actions:MissingParameter — "%" is required', par.api_name;
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type ORDER BY position
  LOOP
    IF NOT coalesce((SELECT k.executable FROM public.action_rule_kinds() k WHERE k.kind = r.kind), false) THEN
      RAISE EXCEPTION 'Actions:RuleKindNotExecutable — % rules cannot be applied yet: %', r.kind,
        (SELECT k.note FROM public.action_rule_kinds() k WHERE k.kind = r.kind);
    END IF;

    IF (SELECT k.runtime FROM public.action_rule_kinds() k WHERE k.kind = r.kind) <> 'sql' THEN
      RAISE EXCEPTION 'Actions:WrongRuntime — a % rule is applied by the action runtime, which runs the code; this is SQL', r.kind;
    END IF;

    IF NOT (SELECT edits_enabled FROM public.object_types WHERE id = r.object_type_id) THEN
      RAISE EXCEPTION 'Actions:EditsDisabled — the object type this rule edits has edits disabled'
        USING HINT = 'Enable edits on the object type. "Disabling edits will not remove existing edits."';
    END IF;

    props := '{}'::jsonb;
    FOR rp IN SELECT p.*, pa.api_name AS param_name, prop.property_id AS prop_key
                FROM public.action_type_rule_properties p
                JOIN public.object_type_properties prop ON prop.id = p.property_id
                LEFT JOIN public.action_type_parameters pa ON pa.id = p.parameter_id
               WHERE p.rule_id = r.id
    LOOP
      IF rp.value_source = 'object_parameter_property' THEN
        RAISE EXCEPTION 'Actions:ValueSourceNotExecutable — object_parameter_property needs an object reference parameter resolved to its object, which apply_action cannot do yet'
          USING HINT = 'Map the property from a parameter, a static value, or the current user or time.';
      END IF;
      props := props || jsonb_build_object(rp.prop_key,
        CASE rp.value_source
          WHEN 'parameter'    THEN p_parameters -> rp.param_name
          WHEN 'static'       THEN rp.static_value
          WHEN 'current_user' THEN to_jsonb(auth.uid()::text)
          WHEN 'current_time' THEN to_jsonb(now())
        END);
    END LOOP;

    IF r.kind = 'create_object' THEN
      SELECT property_id INTO pk_prop FROM public.object_type_properties
       WHERE object_type_id = r.object_type_id AND is_primary_key;
      pk_val := props ->> pk_prop;
      IF pk_val IS NULL OR btrim(pk_val) = '' THEN
        RAISE EXCEPTION 'Actions:CreateNeedsPrimaryKey — the rule''s properties produce no value for the primary key "%"', pk_prop;
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, pk_val, 'create', props - pk_prop, p_action_type);
      written := written + 1;

    ELSIF r.kind = 'modify_object' THEN
      IF p_primary_key IS NULL THEN
        RAISE EXCEPTION 'Actions:ModifyNeedsPrimaryKey — a modify rule names the object it edits';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, p_primary_key, 'modify', props, p_action_type);
      written := written + 1;

    ELSIF r.kind = 'delete_object' THEN
      IF p_primary_key IS NULL THEN
        RAISE EXCEPTION 'Actions:DeleteNeedsPrimaryKey — a delete rule names the object it removes';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, p_primary_key, 'delete', '{}'::jsonb, p_action_type);
      written := written + 1;
    END IF;
  END LOOP;

  RETURN written;
END $$;

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  -- The registry answers both questions for every kind.
  SELECT count(*) INTO n FROM public.action_rule_kinds()
   WHERE runtime NOT IN ('sql', 'function');
  IF n > 0 THEN RAISE EXCEPTION '% rule kind(s) name no runtime', n; END IF;

  SELECT count(*) INTO n FROM public.action_rule_kinds()
   WHERE kind = 'function' AND executable AND runtime = 'function';
  IF n <> 1 THEN RAISE EXCEPTION 'the function rule kind is not executable by the action runtime'; END IF;

  -- A query function may not claim edit provenance, and an edit function must.
  IF public.function_edits_valid('{"returns":"Integer","parameters":[]}'::jsonb,
                                 '{"object_types":["Aircraft"]}'::jsonb) THEN
    RAISE EXCEPTION 'a query function was allowed to claim edit provenance';
  END IF;
  IF public.function_edits_valid('{"returns":"OntologyEdit[]","parameters":[]}'::jsonb,
                                 '{"object_types":[]}'::jsonb) THEN
    RAISE EXCEPTION 'an edit function was allowed to declare no provenance';
  END IF;
  IF NOT public.function_edits_valid('{"returns":"OntologyEdit[]","parameters":[]}'::jsonb,
                                     '{"object_types":["Aircraft"]}'::jsonb) THEN
    RAISE EXCEPTION 'a well-formed edit function was refused';
  END IF;

  RAISE NOTICE '509: a function declares what it may edit, and the rule pins the version';
END $$;
