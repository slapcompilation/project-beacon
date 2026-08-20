-- The three interface object rules have been registered and unexecutable since
-- 569, and `action_rule_kinds()` says exactly why in its own notes: Foundry
-- generates a parameter for each of them and we generate no parameters.
--
--   "Because the action type is only associated with an interface, an "Object
--    type" parameter will be automatically generated to indicate the object type
--    that should be created."
--
--   ""Modify" rules on an interface can modify any object of the configured
--    interface. An "interface reference" parameter will be generated,
--    constrained to the selected interface."
--
--   ""Delete" action rules can have an "interface reference" parameter assigned
--    to them, instead of an object reference parameter."
--
--   — action-types/actions-on-interfaces.md
--
-- What was missing was never the rules. It was two published shapes this repo
-- had not read: what kinds of parameter exist, and how their values are encoded.
-- Both are in `api/`, and neither needed inferring.

-- ── §1 a parameter's kind is a union tag, not an XOR of columns ────────────
-- The api publishes an action parameter's `dataType` as a union with three
-- reference-ish members where we had two:
--
--   object          objectApiName · required, objectTypeApiName · required
--   interfaceObject interfaceTypeApiName
--   objectType      (no fields at all)
--
-- `objectType` carries no payload, so it cannot be encoded as "which nullable
-- column is set" — the set it picks from is implied by the rule's interface
-- rather than stored on the parameter. That is the whole reason this stops
-- being an XOR and becomes a tag.
ALTER TABLE public.action_type_parameters
  ADD COLUMN interface_id uuid REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE,
  ADD COLUMN data_kind text;

UPDATE public.action_type_parameters
   SET data_kind = CASE WHEN object_type_id IS NOT NULL THEN 'object' ELSE 'base_type' END;

ALTER TABLE public.action_type_parameters
  ALTER COLUMN data_kind SET NOT NULL,
  ALTER COLUMN data_kind SET DEFAULT 'base_type';

-- The old rule said exactly one of two columns. It cannot survive a third kind
-- with no column and a fourth with one of its own.
ALTER TABLE public.action_type_parameters
  DROP CONSTRAINT action_type_parameters_check;

ALTER TABLE public.action_type_parameters
  ADD CONSTRAINT action_type_parameters_data_kind_check
  CHECK (data_kind IN ('base_type', 'object', 'interfaceObject', 'objectType'));

-- `interface_id` is deliberately NOT required on an interfaceObject parameter:
-- the api marks `interfaceTypeApiName` optional, and being stricter than Foundry
-- refuses configurations Foundry accepts.
ALTER TABLE public.action_type_parameters
  ADD CONSTRAINT action_type_parameters_payload_matches_kind
  CHECK (
    CASE data_kind
      WHEN 'base_type'       THEN base_type IS NOT NULL AND object_type_id IS NULL AND interface_id IS NULL
      WHEN 'object'          THEN object_type_id IS NOT NULL AND base_type IS NULL AND interface_id IS NULL
      WHEN 'interfaceObject' THEN base_type IS NULL AND object_type_id IS NULL
      WHEN 'objectType'      THEN base_type IS NULL AND object_type_id IS NULL AND interface_id IS NULL
    END);

CREATE INDEX IF NOT EXISTS action_type_parameters_interface_id_idx
  ON public.action_type_parameters (interface_id);

COMMENT ON COLUMN public.action_type_parameters.data_kind IS
  'The api''s action parameter dataType union tag. `base_type` is a scalar; '
  '`object` is an object reference constrained to object_type_id; '
  '`interfaceObject` is an interface reference; `objectType` names an object '
  'type rather than an object, and carries no payload.';

-- ── §2 how a value arrives, published rather than invented ────────────────
-- The apply-action endpoint prints the JSON encoding of each:
--
--   "Ontology Object Reference | JSON encoding of the object's primary key"
--   "Ontology Interface Object Reference | JSON encoding of the object's API name and primary key"
--   "Ontology Object Type Reference | string of the object type's api name"
--
-- with examples `"EMP1234"`, `{"objectTypeApiName":"Employee",
-- "primaryKeyValue":"EMP1234"}` and `"Employee"`.
--
-- So an interface reference carries BOTH halves, which is precisely why it can
-- point at any implementing type where an object reference cannot.
CREATE OR REPLACE FUNCTION public.interface_reference_type(p_value jsonb, p_ontology uuid)
RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT t.id FROM public.object_types t
   WHERE t.ontology_id = p_ontology
     AND t.api_name = p_value ->> 'objectTypeApiName'
$fn$;

COMMENT ON FUNCTION public.interface_reference_type(jsonb, uuid) IS
  'The objectTypeApiName half of an Ontology Interface Object Reference.';

-- ── §3 the generated parameters ───────────────────────────────────────────
-- Foundry generates one per interface rule. Generating it here rather than
-- asking the author for it is the difference between "will be automatically
-- generated" and a form the author has to know how to fill in.
--
-- The label follows the screenshot rather than the prose: the create rule's
-- parameter reads `Ticket type` for the `Ticket` interface, not "Object type"
-- (action-types/images/action_on_interface_create_action.png).
CREATE OR REPLACE FUNCTION public.generate_interface_parameters(p_action_type uuid)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE r record; n int := 0; iface record; api text; pos int;
BEGIN
  SELECT coalesce(max(position), -1) + 1 INTO pos
    FROM public.action_type_parameters WHERE action_type_id = p_action_type;

  FOR r IN
    SELECT DISTINCT ON (kind, interface_id) kind, interface_id
      FROM public.action_type_rules
     WHERE action_type_id = p_action_type AND interface_id IS NOT NULL
       AND kind IN ('create_object_of_interface', 'modify_object_of_interface',
                    'delete_object_of_interface')
  LOOP
    SELECT * INTO iface FROM public.ontology_interfaces WHERE id = r.interface_id;

    IF r.kind = 'create_object_of_interface' THEN
      api := lower(left(iface.api_name, 1)) || right(iface.api_name, -1) || 'Type';
      IF NOT EXISTS (SELECT 1 FROM public.action_type_parameters
                      WHERE action_type_id = p_action_type AND data_kind = 'objectType') THEN
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, data_kind, required, position)
        VALUES (p_action_type, api, iface.display_name || ' type', NULL, 'objectType', true, pos);
        pos := pos + 1; n := n + 1;
      END IF;
    ELSE
      api := lower(left(iface.api_name, 1)) || right(iface.api_name, -1);
      IF NOT EXISTS (SELECT 1 FROM public.action_type_parameters
                      WHERE action_type_id = p_action_type
                        AND data_kind = 'interfaceObject' AND interface_id = r.interface_id) THEN
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, data_kind, interface_id, required, position)
        VALUES (p_action_type, api, iface.display_name, NULL, 'interfaceObject', r.interface_id, true, pos);
        pos := pos + 1; n := n + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN n;
END $fn$;

-- ── §4 the three kinds become executable ──────────────────────────────────
-- The link rules are untouched and stay unexecutable: they still need a link
-- instance store and an interface link constraint no rule column points at.
CREATE OR REPLACE FUNCTION public.action_rule_kinds()
RETURNS TABLE(kind text, targets text, executable boolean, runtime text, note text)
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
    ('create_object_of_interface', 'interface', true, 'sql',
     'Creates an object of the implementing type named by the generated object type parameter. Fails at submission if that type has no primary key among the rule''s properties.'),
    ('modify_object_of_interface', 'interface', true, 'sql',
     'Edits the object named by the generated interface reference parameter, resolving each interface property onto that type''s own.'),
    ('delete_object_of_interface', 'interface', true, 'sql',
     'Removes the object named by the generated interface reference parameter.'),
    ('create_link_on_object_of_interface', 'interface', false, 'sql',
     'A link instance store does not exist yet, and the rule must name an interface link constraint, which no rule column points at.'),
    ('delete_link_on_object_of_interface', 'interface', false, 'sql',
     'A link instance store does not exist yet, and the rule must name an interface link constraint, which no rule column points at.')
$fn$;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.action_rule_kinds() WHERE executable;
  IF n <> 7 THEN RAISE EXCEPTION 'expected 7 executable kinds, found %', n; END IF;

  SELECT count(*) INTO n FROM public.action_type_parameters WHERE data_kind IS NULL;
  IF n > 0 THEN RAISE EXCEPTION '% parameter(s) carry no data kind', n; END IF;
END $$;
