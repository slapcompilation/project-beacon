-- Which rule kinds execute is the database's fact, not the client's.
--
-- The action surface needed to disable the four kinds apply_action() refuses,
-- and the only way it had was a constant restated in TypeScript — the
-- vocabulary-existing-twice smell this repo has paid for before. The registry
-- says it now: action_rule_kinds() carries `executable`, apply_action() reads
-- it instead of its own hardcoded list, and the picker's disabled state is
-- `NOT executable` — one source, three consumers.

DROP FUNCTION public.action_rule_kinds();
CREATE FUNCTION public.action_rule_kinds()
RETURNS TABLE (kind text, targets text, executable boolean, note text)
LANGUAGE sql IMMUTABLE AS $$
  VALUES
    ('create_object',           'object_type', true,
     'Creates a new object; the rule''s properties must produce the primary key.'),
    ('modify_object',           'object_type', true,
     'Edits the properties the rule names on an existing object.'),
    ('create_or_modify_object', 'object_type', false,
     'Needs an existence check against the merged object; not executable yet.'),
    ('delete_object',           'object_type', true,
     'Removes an existing object by primary key.'),
    ('create_link',             'link_type',   false,
     'A link instance store does not exist yet.'),
    ('delete_link',             'link_type',   false,
     'A link instance store does not exist yet.'),
    ('function',                'none',        false,
     'Backed by a function, which needs a function runtime (G2).')
$$;

COMMENT ON FUNCTION public.action_rule_kinds() IS
  'The seven rule kinds (action-types/rules.md), what each targets, and whether apply_action() can run it today. The five interface kinds and three side-effect kinds are deliberately absent, as 418 records.';

REVOKE ALL ON FUNCTION public.action_rule_kinds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.action_rule_kinds() TO authenticated;

-- apply_action reads the registry instead of restating it.
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
      props := props || jsonb_build_object(rp.prop_key,
        CASE rp.value_source
          WHEN 'parameter'    THEN p_parameters -> rp.param_name
          WHEN 'static'       THEN rp.static_value
          WHEN 'current_user' THEN to_jsonb(auth.uid()::text)
          WHEN 'current_time' THEN to_jsonb(now())
          ELSE NULL
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
      VALUES (r.object_type_id, pk_val, 'create', props, p_action_type);

    ELSIF r.kind = 'modify_object' THEN
      IF p_primary_key IS NULL THEN
        RAISE EXCEPTION 'Actions:ModifyNeedsTarget — a modify rule edits an existing object; pass its primary key';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, p_primary_key, 'modify', props, p_action_type);

    ELSE  -- delete_object
      IF p_primary_key IS NULL THEN
        RAISE EXCEPTION 'Actions:DeleteNeedsTarget — a delete rule removes an existing object; pass its primary key';
      END IF;
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (r.object_type_id, p_primary_key, 'delete', '{}'::jsonb, p_action_type);
    END IF;

    written := written + 1;
  END LOOP;

  IF written = 0 THEN
    RAISE EXCEPTION 'Actions:NoRules — this action type has no rules, so applying it would do nothing';
  END IF;

  RETURN written;
END $$;

-- ── assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.action_rule_kinds() WHERE executable;
  IF n <> 3 THEN RAISE EXCEPTION 'expected exactly three executable kinds, found %', n; END IF;
  SELECT count(*) INTO n FROM public.action_rule_kinds();
  IF n <> 7 THEN RAISE EXCEPTION 'the registry lost a kind'; END IF;
  -- The guard that consumes targets still resolves.
  IF (SELECT targets FROM public.action_rule_kinds() WHERE kind = 'create_link') <> 'link_type' THEN
    RAISE EXCEPTION 'targets drifted in the rewrite';
  END IF;
  RAISE NOTICE '446: three kinds execute, and the registry is the one place that says so';
END $$;
