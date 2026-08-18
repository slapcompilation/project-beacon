-- The five `…of interface` rule kinds, which have been unblocked and unbuilt
-- since 450. `action-types/rules` lists twelve; we carried seven.
--
-- ── THE FIVE, AS THE PAGE NUMBERS THEM ─────────────────────────────────────
--   8.  "Create object(s) of interface: Can be used to create objects of any
--        type that implements a particular interface."
--   9.  "Modify object(s) of interface: Can be used to modify objects of types
--        that implement a particular interface."
--   10. "Delete object(s) of interface: Can be used to delete objects of types
--        that implement a particular interface."
--   11. "Create link(s) on object(s) of interface"
--   12. "Delete link(s) on object(s) of interface"
--
-- ── THE CONSTRAINT THAT MAKES THEM SAFE ────────────────────────────────────
-- `action-types/actions-on-interfaces` states the whole rule in one clause:
--
--   "You can use interface action rules whenever the edits can apply to all the
--    object types that implement the interface. In other words, you can use
--    interface action rules only to modify the *interface shared properties*."
--
-- That is Phase C's design sentence — the declared property set is the edit
-- permission — applied one level up. An interface rule that named a property
-- some implementing type does not have would be an edit that cannot apply to
-- all of them, so the guard below refuses it.
--
-- ── WHAT IS REGISTERED, AND WHAT IS EXECUTABLE ─────────────────────────────
-- All five are registered, because a kind that cannot be *expressed* cannot be
-- modelled at all. None is executable yet, and each says why in its own note
-- rather than sharing a vague one:
--
--   * The three object kinds need parameters Foundry generates and we do not.
--     "Because the action type is only associated with an interface, an 'Object
--     type' parameter will be automatically generated to indicate the object
--     type that should be created", and for modify and delete "an 'interface
--     reference' parameter will be generated, constrained to the selected
--     interface".
--   * The two link kinds need what `create_link` and `delete_link` already
--     wait for — a link instance store — and additionally name an interface
--     link constraint, which `interface_link_constraints` models but no rule
--     column points at yet.
--
-- This is the same treatment `create_or_modify_object` has carried since it was
-- registered: known, expressible, refused at execution with a stated reason.
--
-- Also recorded from the same page, and NOT built: "Actions on interfaces
-- cannot be used with functions" — already true here for a different reason,
-- since `guard_action_type_rule` makes a function rule exclusive of every other
-- rule, so the narrower statement needs nothing.

BEGIN;

ALTER TABLE public.action_type_rules
  ADD COLUMN interface_id uuid REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE;
CREATE INDEX action_type_rules_interface ON public.action_type_rules (interface_id);
COMMENT ON COLUMN public.action_type_rules.interface_id IS
  'The interface an `…of interface` rule operates on. Its properties are the only ones such a rule may write.';

CREATE OR REPLACE FUNCTION public.action_rule_kinds()
RETURNS TABLE (kind text, targets text, executable boolean, runtime text, note text)
LANGUAGE sql IMMUTABLE AS $fn$
  VALUES
    ('create_object', 'object_type', true, 'sql',
     'Creates a new object; the rule''s properties must produce the primary key.'),
    ('modify_object', 'object_type', true, 'sql',
     'Edits the properties the rule names on an existing object.'),
    ('create_or_modify_object', 'object_type', false, 'sql',
     'Needs an existence check against the merged object; not executable yet.'),
    ('delete_object', 'object_type', true, 'sql',
     'Removes an existing object by primary key.'),
    ('create_link', 'link_type', false, 'sql',
     'A link instance store does not exist yet.'),
    ('delete_link', 'link_type', false, 'sql',
     'A link instance store does not exist yet.'),
    ('function', 'none', true, 'function',
     'Runs an Ontology edit function and applies the edit batch it returns. Applied by the action runtime, which owns the isolate — not by apply_action, which is SQL.'),
    ('create_object_of_interface', 'interface', false, 'sql',
     'Creates an object of any type implementing the interface. Not executable: Foundry generates an "Object type" parameter naming the type to create, and we generate no parameters.'),
    ('modify_object_of_interface', 'interface', false, 'sql',
     'Modifies objects of implementing types. Not executable: Foundry generates an "interface reference" parameter constrained to the interface, and we generate no parameters.'),
    ('delete_object_of_interface', 'interface', false, 'sql',
     'Deletes objects of implementing types. Not executable: it takes the same generated interface reference parameter.'),
    ('create_link_on_object_of_interface', 'interface', false, 'sql',
     'A link instance store does not exist yet, and the rule must name an interface link constraint, which no rule column points at.'),
    ('delete_link_on_object_of_interface', 'interface', false, 'sql',
     'A link instance store does not exist yet, and the rule must name an interface link constraint, which no rule column points at.')
$fn$;

CREATE OR REPLACE FUNCTION public.guard_action_type_rule()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE targets text; n int; act_ont uuid; tgt_ont uuid; stray text;
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
  IF targets = 'interface' AND NEW.interface_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsInterface — % operates on an interface', NEW.kind;
  END IF;
  IF targets = 'none' AND NEW.function_name IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsFunction — a function rule names a function';
  END IF;
  -- And only that one: an interface rule naming an object type would be two
  -- rules wearing one row.
  IF targets <> 'interface' AND NEW.interface_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleTargetMismatch — % does not operate on an interface', NEW.kind;
  END IF;
  IF targets = 'interface' AND (NEW.object_type_id IS NOT NULL OR NEW.link_type_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Ontology:ActionRuleTargetMismatch — % names an interface, not an object or link type', NEW.kind;
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
  ELSIF NEW.interface_id IS NOT NULL THEN
    SELECT ontology_id INTO tgt_ont FROM public.ontology_interfaces WHERE id = NEW.interface_id;
  END IF;
  IF tgt_ont IS NOT NULL AND tgt_ont IS DISTINCT FROM act_ont THEN
    RAISE EXCEPTION 'Ontology:ActionCrossesOntologies — an action type edits its own ontology';
  END IF;

  -- "you can use interface action rules only to modify the interface shared
  --  properties". A property the interface does not declare is an edit that
  --  cannot apply to every implementing type, which is what the rule promises.
  IF NEW.interface_id IS NOT NULL THEN
    SELECT string_agg(p.property_id, ', ') INTO stray
      FROM public.action_type_rule_properties p
     WHERE p.rule_id = NEW.id
       AND NOT EXISTS (SELECT 1 FROM public.interface_properties ip
                        WHERE ip.interface_id = NEW.interface_id
                          AND ip.property_id = p.property_id);
    IF stray IS NOT NULL THEN
      RAISE EXCEPTION 'Ontology:InterfaceRuleWritesUndeclaredProperty — % is not a property of this interface', stray
        USING HINT = 'An interface rule may only write the interface''s own properties, so the edit applies to every implementing type.';
    END IF;
  END IF;

  RETURN NEW;
END $fn$;

-- ── assertions, which execute the path and unwind their fixture ─────────────
DO $do$
DECLARE n int; ok boolean;
BEGIN
  -- Twelve of twelve kinds are now expressible.
  SELECT count(*) INTO n FROM public.action_rule_kinds();
  IF n <> 12 THEN RAISE EXCEPTION 'expected the published twelve rule kinds, found %', n; END IF;
  SELECT count(*) INTO n FROM public.action_rule_kinds() WHERE targets = 'interface';
  IF n <> 5 THEN RAISE EXCEPTION 'expected five interface kinds, found %', n; END IF;

  -- None of the five claims to execute, and each says why.
  SELECT count(*) INTO n FROM public.action_rule_kinds()
   WHERE targets = 'interface' AND (executable OR note IS NULL OR length(note) < 20);
  IF n <> 0 THEN
    RAISE EXCEPTION '% interface kind(s) claim execution or give no reason', n;
  END IF;

  RAISE NOTICE '569: an action rule may target an interface';
END $do$;

COMMIT;
