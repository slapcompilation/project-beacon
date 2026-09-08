-- An interface link rule writes the foreign key on the many side.
--
-- The last two kinds `action_rule_kinds()` refuses. 768 built what they read —
-- which concrete link keeps an interface link type constraint. This builds the
-- rules themselves, and with them the registry's list of unexecutable kinds
-- becomes empty.
--
-- The rule names the CONSTRAINT, never a link type:

--   "rules allow you to create links using an interface link constraint
--    defined on an interface"
--   — action-types/actions-on-interfaces.md

-- and one sentence, printed identically under both kinds, settles what
-- parameters are generated and which side is which:

--   "Select the interface link constraint defined on the interface. If the
--    link constraint is between two interfaces, both the source and
--    destination parameters will be automatically generated as interface
--    reference parameters. If the link constraint is between an interface and
--    an object type, the source will be an interface reference parameter and
--    the destination will be an object reference parameter."
--   — action-types/actions-on-interfaces.md

-- The interface is always the SOURCE. The destination follows the constraint's
-- target kind. Both are generated, and `generate_interface_parameters` now
-- writes the rule's `source_parameter_id` / `target_parameter_id` at the same
-- time — 761's shape, where the generator points the rule at what it made.
-- It cannot be left to be re-found by data kind: a constraint from an
-- interface to ITSELF needs two `interfaceObject` parameters and the existing
-- lookup takes one with LIMIT 1.
--
-- ── the part that makes these different from every other link rule ─────────
--
-- A plain `create_link` refuses anything but a join table, and quotes its
-- reason — the sentence is already inside `apply_rule_link_edit`:

--   "For foreign key links, one has to use **Modify object** rule to
--    explicitly modify the foreign key property."
--   — action-types/rules.md

-- An interface link rule does NOT refuse it. Its own callout says the rule
-- writes that column, and warns that another rule in the same action type can
-- collide with it:

--   "Additionally, creating a one-to-many link modifies the foreign key on the
--    many side of the relationship. Ensure there are no conflicts if your
--    action type also modifies the foreign key using a"
--   — action-types/actions-on-interfaces.md

-- — and it goes on to name a Create object or Modify object(s) rule.

-- There is no conflict to warn about unless the rule writes it. And an
-- interface link constraint can only be ONE or MANY —

--   "Interface link types can further be specified to have a `ONE` or `MANY`
--    cardinality. These cardinalities are analogous to one-to-one and
--    one-to-many modeling, respectively."
--   — interfaces/interface-link-types-overview.md

-- — so the foreign-key case is the documented one, not the exception. What the
-- edit IS, the api prints as code: linking sets the many side's foreign-key
-- property to the one side's primary key, and unlinking sets it to nothing.

--   "For one-to-one and one-to-many links, use the `update` method available
--    on the created batch to modify the foreign key property of the source
--    object."
--   — functions/typescript-v2-ontology-edits.md

-- 417 says where that property lives: a foreign-key link's `backing_column`
-- names the TARGET's primary-key column and the reader finds the property of
-- that name on the SOURCE. So the edited object is always the link's source,
-- the value written is always the target's primary key, and a delete writes
-- JSON null. That is a `modify` row in `object_edits` — the same row an object
-- rule writes, which is why 605's window, 713's scenario redirect and 742's
-- revert all keep working with nothing added.
--
-- A join-table link still goes through 755's `write_link_edit`, because a MANY
-- constraint may be kept by a many-to-many link and 768 does not forbid it.
-- An object-backed one is refused by name: creating the object in the middle is
-- an edit no page describes.
--
-- ── the asymmetry, kept rather than smoothed ───────────────────────────────

--   "If there are multiple concrete link implementations on the object type
--    for the link constraint, the action will fail."
--   — action-types/actions-on-interfaces.md

--   "If there are multiple concrete link implementations on the object type
--    for the link constraint, the action will attempt to delete all the
--    concrete link implementations."
--   — action-types/actions-on-interfaces.md

-- Create refuses; delete fans out. 768's key is what makes both reachable.
--
-- ── what is NOT built, said plainly ────────────────────────────────────────
--
-- The create rule's third binding form is refused, and the refusal names
-- itself as ours. The page grants it:

--   "rule within the same action type"
--   — action-types/actions-on-interfaces.md

-- — the destination being an object created by a Create object or Create
-- object(s) of interface rule.

-- One rule referencing another rule's output inside one action type is a
-- dependency `action_type_rules` cannot express. The delete rule does not
-- grant it, so this is a create-only gap; the error says so rather than
-- quoting the delete rule's stricter sentence at the create rule, which is
-- what an earlier draft of this migration did.
--
-- Both ends accept EITHER parameter kind, because the manual-binding sentences
-- do — the generated-kind law above is scoped to generation. What is checked
-- is the resolved OBJECT TYPE against the constraint, not the parameter's kind.
--
-- `assert_rule_order` (469) filters `object_type_id IS NOT NULL`, so interface
-- rules have always been outside it and the create callout's conflict warning
-- is unguarded here. Recorded, not silently inherited.

-- ── 1. the rule names its constraint ───────────────────────────────────────

ALTER TABLE public.action_type_rules
  ADD COLUMN interface_link_constraint_id uuid
    REFERENCES public.interface_link_constraints(id) ON DELETE RESTRICT;

ALTER TABLE public.action_type_rules
  ADD CONSTRAINT action_type_rules_interface_link_columns_check
  CHECK ((interface_link_constraint_id IS NOT NULL)
         = (kind IN ('create_link_on_object_of_interface',
                     'delete_link_on_object_of_interface')));

COMMENT ON CONSTRAINT action_type_rules_interface_link_columns_check ON public.action_type_rules IS
  'Values from action-types/rules — the two interface link kinds name an interface link type constraint, and no other kind names one.';

COMMENT ON COLUMN public.action_type_rules.interface_link_constraint_id IS
  'The interface link type constraint this rule links through: "Select the interface link constraint defined on the interface." Which concrete links keep it, per implementing type, is interface_link_satisfactions (768).';

CREATE INDEX action_type_rules_interface_link_constraint_idx
  ON public.action_type_rules (interface_link_constraint_id)
  WHERE interface_link_constraint_id IS NOT NULL;

-- ── 2. and it must be a constraint of the interface it names ───────────────

DO $mig$
DECLARE src text; anchor text;
BEGIN
  src := replace(pg_get_functiondef('public.guard_action_type_rule()'::regprocedure), chr(13), '');
  anchor :=
'  IF targets = ''interface'' AND (NEW.object_type_id IS NOT NULL OR NEW.link_type_id IS NOT NULL) THEN
    RAISE EXCEPTION ''Ontology:ActionRuleTargetMismatch — % names an interface, not an object or link type'', NEW.kind;
  END IF;';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected the interface target-mismatch arm exactly once';
  END IF;
  EXECUTE replace(src, anchor, anchor || '

  -- The constraint is a clause of the interface the rule names, or of one of
  -- its ancestors — the link clause is inherited the way the action one is.
  IF NEW.interface_link_constraint_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.interface_link_constraints c
                      WHERE c.id = NEW.interface_link_constraint_id
                        AND c.interface_id IN (SELECT public.interface_ancestors(NEW.interface_id)
                                               UNION SELECT NEW.interface_id)) THEN
    RAISE EXCEPTION ''Ontology:LinkConstraintNotOnThisInterface — the constraint this rule links through is not a clause of the interface it names'';
  END IF;');
END $mig$;

-- ── 3. the authoring door carries it ───────────────────────────────────────
-- `apply_action_type` is the ONLY writer of `action_type_rules`, and it deletes
-- and re-inserts, so this cannot be written back by a generator the way 760
-- wrote `object_parameter_id`. It goes in the INSERT, resolved by api name
-- first with a raw-id fallback — 760's shape.

DO $mig$
DECLARE src text; cols text; vals text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action_type(jsonb,jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');
  cols := '       source_parameter_id, target_parameter_id, object_parameter_id, create_new_object_with)';
  vals := '            CASE WHEN e->>''kind'' = ''create_or_modify_object''
                 THEN coalesce(nullif(e->>''create_new_object_with'',''''), ''auto_generated_primary_key'') END)';
  IF (length(src) - length(replace(src, cols, ''))) / length(cols) <> 1 THEN
    RAISE EXCEPTION 'expected the rule column list exactly once';
  END IF;
  IF (length(src) - length(replace(src, vals, ''))) / length(vals) <> 1 THEN
    RAISE EXCEPTION 'expected the create_new_object_with values tail exactly once';
  END IF;
  src := replace(src, cols,
'       source_parameter_id, target_parameter_id, object_parameter_id, create_new_object_with,
       interface_link_constraint_id)');
  -- The anchor ends with the VALUES list's own closing paren, so the new
  -- expression goes INSIDE it: the paren moves, it is not appended past.
  src := replace(src, vals, rtrim(vals, ')') || ',
            coalesce((SELECT c.id FROM public.interface_link_constraints c
                       WHERE c.api_name = e->>''interface_link_constraint_api_name''
                         AND c.interface_id IN (
                               SELECT public.interface_ancestors(nullif(e->>''interface_id'','''')::uuid)
                               UNION SELECT nullif(e->>''interface_id'','''')::uuid)),
                     nullif(e->>''interface_link_constraint_id'','''')::uuid))');
  EXECUTE src;
END $mig$;

-- ── 4. the generated parameters, and the rule pointed at them ──────────────

-- `action_type_parameters` is UNIQUE (action_type_id, api_name) and a
-- constraint's api name has no format CHECK at all, so a generated name is
-- sanitised and suffixed rather than trusted.
CREATE OR REPLACE FUNCTION public.unique_parameter_api_name(p_action_type uuid, p_wanted text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE base text; try text; i int := 2;
BEGIN
  base := regexp_replace(coalesce(nullif(btrim(p_wanted), ''), 'parameter'), '[^A-Za-z0-9]', '', 'g');
  IF base = '' THEN base := 'parameter'; END IF;
  base := lower(left(base, 1)) || right(base, -1);
  try := base;
  WHILE EXISTS (SELECT 1 FROM public.action_type_parameters
                 WHERE action_type_id = p_action_type AND api_name = try) LOOP
    try := base || i::text;
    i := i + 1;
  END LOOP;
  RETURN try;
END $$;

COMMENT ON FUNCTION public.unique_parameter_api_name(uuid, text) IS
  'A generated parameter name that will not collide: non-alphanumerics stripped, lowerCamel, suffixed until free. action_type_parameters is UNIQUE (action_type_id, api_name) and interface_link_constraints.api_name carries no format CHECK.';

REVOKE ALL ON FUNCTION public.unique_parameter_api_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unique_parameter_api_name(uuid, text) TO authenticated, service_role;

-- The generator needs two more locals and a name minter. Declared by patching
-- the DECLARE line rather than retyping the body.
DO $mig$
DECLARE src text; anchor text;
BEGIN
  src := replace(pg_get_functiondef('public.generate_interface_parameters(uuid)'::regprocedure), chr(13), '');
  anchor := 'DECLARE r record; n int := 0; iface record; api text; pos int;';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected the generator DECLARE line exactly once';
  END IF;
  EXECUTE replace(src, anchor,
    'DECLARE r record; n int := 0; iface record; api text; pos int; src_id uuid;');
END $mig$;

DO $mig$
DECLARE src text; anchor text;
BEGIN
  src := replace(pg_get_functiondef('public.generate_interface_parameters(uuid)'::regprocedure), chr(13), '');
  anchor := '  RETURN n;
END';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected one RETURN n tail in generate_interface_parameters';
  END IF;
  EXECUTE replace(src, anchor,
'  -- The two link kinds, per RULE rather than per (kind, interface): each rule
  -- has two ends, and a constraint whose target is its own interface needs two
  -- interface reference parameters. The rule is pointed at both, so nothing
  -- has to re-find them by data kind.
  FOR r IN
    SELECT ru.id, ru.interface_id, ru.source_parameter_id, ru.target_parameter_id,
           c.api_name AS c_api, c.target_kind, c.target_interface_id, c.target_object_type_id
      FROM public.action_type_rules ru
      JOIN public.interface_link_constraints c ON c.id = ru.interface_link_constraint_id
     WHERE ru.action_type_id = p_action_type
       AND ru.kind IN (''create_link_on_object_of_interface'', ''delete_link_on_object_of_interface'')
  LOOP
    SELECT * INTO iface FROM public.ontology_interfaces WHERE id = r.interface_id;

    IF r.source_parameter_id IS NULL THEN
      api := public.unique_parameter_api_name(p_action_type,
               lower(left(iface.api_name, 1)) || right(iface.api_name, -1));
      INSERT INTO public.action_type_parameters
        (action_type_id, api_name, display_name, base_type, data_kind, interface_id, required, position)
      VALUES (p_action_type, api, iface.label, NULL, ''interfaceObject'', r.interface_id, true, pos)
      RETURNING id INTO src_id;
      UPDATE public.action_type_rules SET source_parameter_id = src_id WHERE id = r.id;
      pos := pos + 1; n := n + 1;
    END IF;

    IF r.target_parameter_id IS NULL THEN
      api := public.unique_parameter_api_name(p_action_type, r.c_api);
      IF r.target_kind = ''interface'' THEN
        SELECT * INTO iface FROM public.ontology_interfaces WHERE id = r.target_interface_id;
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, data_kind, interface_id, required, position)
        VALUES (p_action_type, api, iface.label, NULL, ''interfaceObject'', r.target_interface_id, true, pos)
        RETURNING id INTO src_id;
      ELSE
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, data_kind, object_type_id, required, position)
        VALUES (p_action_type, api, (SELECT label FROM public.object_types WHERE id = r.target_object_type_id),
                NULL, ''object'', r.target_object_type_id, true, pos)
        RETURNING id INTO src_id;
      END IF;
      UPDATE public.action_type_rules SET target_parameter_id = src_id WHERE id = r.id;
      pos := pos + 1; n := n + 1;
    END IF;
  END LOOP;

' || anchor);
END $mig$;

-- ── 5. resolving one end of the link ───────────────────────────────────────
-- Either parameter kind at either end, because the manual-binding sentences
-- allow either and only the GENERATED kinds are fixed by the page.

CREATE OR REPLACE FUNCTION public.action_reference_object(
  p_parameter uuid, p_parameters jsonb, p_ontology uuid)
RETURNS TABLE (object_type_id uuid, primary_key text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE pa.data_kind
           WHEN 'interfaceObject'
             THEN public.interface_reference_type(p_parameters -> pa.api_name, p_ontology)
           WHEN 'object' THEN pa.object_type_id
         END,
         CASE pa.data_kind
           WHEN 'interfaceObject' THEN (p_parameters -> pa.api_name) ->> 'primaryKeyValue'
           WHEN 'object' THEN p_parameters ->> pa.api_name
         END
    FROM public.action_type_parameters pa
   WHERE pa.id = p_parameter
$$;

COMMENT ON FUNCTION public.action_reference_object(uuid, jsonb, uuid) IS
  'One end of an interface link rule, resolved to (object type, primary key). "An interface reference or object reference parameter referencing an existing object" — either kind, at either end; an interface reference carries both halves, an object reference takes its type from the parameter.';

REVOKE ALL ON FUNCTION public.action_reference_object(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.action_reference_object(uuid, jsonb, uuid)
  TO authenticated, service_role;

-- ── 6. the edit ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_rule_interface_link_edit(
  p_rule uuid, p_action_type uuid, p_parameters jsonb, p_application uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record; c record; ont uuid; lk record;
  near_t uuid; near_k text; far_t uuid; far_k text;
  src_t uuid; src_k text; tgt_k text; val jsonb;
  hits int; n int := 0;
BEGIN
  SELECT * INTO r FROM public.action_type_rules WHERE id = p_rule;
  SELECT ontology_id INTO ont FROM public.action_types WHERE id = p_action_type;
  SELECT * INTO c FROM public.interface_link_constraints WHERE id = r.interface_link_constraint_id;

  IF c.id IS NULL OR r.source_parameter_id IS NULL OR r.target_parameter_id IS NULL THEN
    RAISE EXCEPTION 'Actions:InterfaceLinkRuleIncomplete — a % rule names an interface link constraint and both of its ends', r.kind;
  END IF;

  SELECT a.object_type_id, a.primary_key INTO near_t, near_k
    FROM public.action_reference_object(r.source_parameter_id, p_parameters, ont) a;
  SELECT a.object_type_id, a.primary_key INTO far_t, far_k
    FROM public.action_reference_object(r.target_parameter_id, p_parameters, ont) a;

  IF near_t IS NULL OR near_k IS NULL THEN
    RAISE EXCEPTION 'Actions:InterfaceLinkRuleNeedsASource — the source names the object of the interface this rule links from';
  END IF;
  IF far_t IS NULL OR far_k IS NULL THEN
    IF r.kind = 'create_link_on_object_of_interface' THEN
      -- Ours, and only for create. The page allows a destination that is an
      -- object created by a Create object or Create object(s) of interface
      -- rule within the same action type; one rule naming another rule's
      -- output is a dependency action_type_rules cannot express. Scoped in
      -- the header, with the sentence it departs from.
      RAISE EXCEPTION 'Actions:InterfaceLinkSiblingRuleNotSupported — the destination must name an existing object; a destination created by another rule in the same action type is not built here'
        USING HINT = 'Bind the destination to an interface reference or object reference parameter.';
    END IF;
    RAISE EXCEPTION 'Actions:InterfaceLinkRuleNeedsADestination — the destination names the object at the other end';
  END IF;

  -- The same two gates every interface rule passes (450, 571).
  IF NOT EXISTS (SELECT 1 FROM public.object_type_interfaces oti
                  WHERE oti.object_type_id = near_t AND oti.interface_id = r.interface_id) THEN
    RAISE EXCEPTION 'Actions:TypeDoesNotImplement — % does not implement this interface',
      (SELECT api_name FROM public.object_types WHERE id = near_t);
  END IF;
  IF NOT (SELECT oti.interface_actions_enabled FROM public.object_type_interfaces oti
           WHERE oti.object_type_id = near_t AND oti.interface_id = r.interface_id) THEN
    RAISE EXCEPTION 'Actions:InterfaceActionsDisabled — % has interface actions turned off',
      (SELECT api_name FROM public.object_types WHERE id = near_t);
  END IF;

  -- The far end is checked against the CONSTRAINT, not against the parameter's
  -- kind: the page fixes the kinds only for the generated parameters.
  IF c.target_kind = 'object_type' THEN
    IF far_t <> c.target_object_type_id THEN
      RAISE EXCEPTION 'Actions:InterfaceLinkTargetMismatch — "%" links to %, and the destination is %',
        c.api_name, (SELECT api_name FROM public.object_types WHERE id = c.target_object_type_id),
        (SELECT api_name FROM public.object_types WHERE id = far_t);
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.object_type_interfaces oti
                     WHERE oti.object_type_id = far_t
                       AND c.target_interface_id = ANY (ARRAY(
                             SELECT public.interface_ancestors(oti.interface_id)
                             UNION SELECT oti.interface_id))) THEN
    RAISE EXCEPTION 'Actions:InterfaceLinkTargetMismatch — the destination % does not implement %',
      (SELECT api_name FROM public.object_types WHERE id = far_t),
      (SELECT api_name FROM public.ontology_interfaces WHERE id = c.target_interface_id);
  END IF;

  SELECT count(*) INTO hits FROM public.interface_link_satisfactions s
   WHERE s.object_type_id = near_t AND s.constraint_id = c.id;
  IF hits = 0 THEN
    RAISE EXCEPTION 'Actions:InterfaceLinkNotImplemented — % names no concrete link for "%"',
      (SELECT api_name FROM public.object_types WHERE id = near_t), c.api_name
      USING HINT = 'Select a link type on the object type that satisfies the constraint, on its Interfaces tab.';
  END IF;
  -- "the action will fail" — create only. Delete goes on to do all of them.
  IF hits > 1 AND r.kind = 'create_link_on_object_of_interface' THEN
    RAISE EXCEPTION 'Actions:MultipleLinkImplementations — % keeps "%" with % concrete links, and a create rule cannot choose between them',
      (SELECT api_name FROM public.object_types WHERE id = near_t), c.api_name, hits;
  END IF;

  FOR lk IN
    SELECT l.* FROM public.interface_link_satisfactions s
      JOIN public.link_types l ON l.id = s.link_type_id
     WHERE s.object_type_id = near_t AND s.constraint_id = c.id
     ORDER BY l.api_name
  LOOP
    IF lk.backing_kind = 'join_table' THEN
      -- 755's core, with the ends put the way the pair store stores them.
      PERFORM public.write_link_edit(lk.id,
        CASE WHEN lk.source_object_type_id = near_t THEN near_k ELSE far_k END,
        CASE WHEN lk.source_object_type_id = near_t THEN far_k ELSE near_k END,
        CASE r.kind WHEN 'create_link_on_object_of_interface' THEN 'addLink' ELSE 'deleteLink' END,
        p_action_type, p_application);
      n := n + 1;

    ELSIF lk.backing_kind = 'foreign_key' THEN
      -- 417: `backing_column` names the TARGET's primary-key column and the
      -- property of that name lives on the SOURCE. So the edited object is the
      -- link's source and the value is the target's key — "the foreign key on
      -- the many side".
      IF lk.source_object_type_id = near_t THEN
        src_t := near_t; src_k := near_k; tgt_k := far_k;
      ELSE
        src_t := far_t;  src_k := far_k;  tgt_k := near_k;
      END IF;
      IF NOT (SELECT edits_enabled FROM public.object_types WHERE id = src_t) THEN
        RAISE EXCEPTION 'Actions:EditsDisabled — the object type this link''s foreign key lives on has edits disabled'
          USING HINT = 'Enable edits on the object type. "Disabling edits will not remove existing edits."';
      END IF;
      val := CASE r.kind WHEN 'create_link_on_object_of_interface'
                         THEN to_jsonb(tgt_k) ELSE 'null'::jsonb END;
      INSERT INTO public.object_edits
        (object_type_id, primary_key, instruction, properties, action_type_id, application_id, "before")
      VALUES (src_t, src_k, 'modify', jsonb_build_object(lk.backing_column, val),
              p_action_type, p_application,
              coalesce((SELECT jsonb_object_agg(k, coalesce(s.properties -> k, 'null'::jsonb))
                          FROM jsonb_object_keys(jsonb_build_object(lk.backing_column, val)) k,
                               LATERAL public.object_before_state(src_t, src_k) s),
                       '{}'::jsonb));
      n := n + 1;

    ELSE
      RAISE EXCEPTION 'Actions:InterfaceLinkBackingUnsupported — "%" is %, and this rule writes a foreign key or a join table',
        lk.api_name, coalesce(lk.backing_kind, 'not backed');
    END IF;
  END LOOP;

  RETURN n;
END $$;

COMMENT ON FUNCTION public.apply_rule_interface_link_edit(uuid, uuid, jsonb, uuid) IS
  'A "Create/Delete interface link" rule, applied. Resolves the constraint to the concrete links the implementing type named as satisfying it (768), then writes each: a join table through 755''s link edit, a foreign key as a modify on the link''s source object — "creating a one-to-many link modifies the foreign key on the many side of the relationship". Create refuses more than one implementation; delete does all of them.';

REVOKE ALL ON FUNCTION public.apply_rule_interface_link_edit(uuid, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_rule_interface_link_edit(uuid, uuid, jsonb, uuid)
  TO authenticated, service_role;

-- ── 7. apply_action dispatches to it, and stops taking its parameters ──────

DO $mig$
DECLARE src text; anchor text; near text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action(uuid,jsonb,text,text)'::regprocedure), chr(13), '');

  anchor :=
'    -- ── link rules (755): both sides from object reference parameters ──────
    IF r.kind IN (''create_link'', ''delete_link'') THEN';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected 755''s link dispatch exactly once';
  END IF;
  -- Inserted BEFORE the anchor, which survives in the replacement.
  src := replace(src, anchor,
'    -- ── interface link rules (769): the constraint resolves to the concrete
    -- links the implementing type keeps it with, and each is written.
    IF r.kind IN (''create_link_on_object_of_interface'', ''delete_link_on_object_of_interface'') THEN
      written := written + public.apply_rule_interface_link_edit(r.id, p_action_type, p_parameters, app);
      CONTINUE;
    END IF;

' || anchor);

  -- An interface OBJECT rule finds its near side by data kind with LIMIT 1.
  -- A link rule now generates its own interface reference parameters, so that
  -- lookup must not pick one of them — and it is ordered, so which one it does
  -- pick stops depending on the row order.
  near :=
'         AND pa.data_kind = ''interfaceObject''
         AND (pa.interface_id IS NULL OR pa.interface_id = r.interface_id)
       LIMIT 1;';
  IF (length(src) - length(replace(src, near, ''))) / length(near) <> 1 THEN
    RAISE EXCEPTION 'expected the near-side interfaceObject lookup exactly once';
  END IF;
  src := replace(src, near,
'         AND pa.data_kind = ''interfaceObject''
         AND (pa.interface_id IS NULL OR pa.interface_id = r.interface_id)
         AND NOT EXISTS (SELECT 1 FROM public.action_type_rules lr
                          WHERE lr.action_type_id = p_action_type
                            AND (lr.source_parameter_id = pa.id
                              OR lr.target_parameter_id = pa.id))
       ORDER BY pa.position, pa.id
       LIMIT 1;');

  EXECUTE src;
END $mig$;

-- ── 8. the registry says they run, and why ─────────────────────────────────

DO $mig$
DECLARE src text; a text; b text;
BEGIN
  src := replace(pg_get_functiondef('public.action_rule_kinds()'::regprocedure), chr(13), '');
  a :=
'    (''create_link_on_object_of_interface'', ''interface'', false, ''sql'',
     ''A link instance store does not exist yet, and the rule must name an interface link constraint, which no rule column points at.'')';
  b :=
'    (''delete_link_on_object_of_interface'', ''interface'', false, ''sql'',
     ''A link instance store does not exist yet, and the rule must name an interface link constraint, which no rule column points at.'')';
  IF (length(src) - length(replace(src, a, ''))) / length(a) <> 1
     OR (length(src) - length(replace(src, b, ''))) / length(b) <> 1 THEN
    RAISE EXCEPTION 'expected each unexecutable link kind exactly once';
  END IF;
  src := replace(src, a,
'    (''create_link_on_object_of_interface'', ''interface'', true, ''sql'',
     ''Links the object named by the generated interface reference parameter to the destination, through the concrete link the implementing type named as satisfying the constraint. Fails when the type keeps the constraint with more than one link. A foreign-key link is written as the foreign key on the many side (769).'')');
  src := replace(src, b,
'    (''delete_link_on_object_of_interface'', ''interface'', true, ''sql'',
     ''Unlinks through the constraint, and when the implementing type keeps it with several concrete links it attempts all of them. A foreign-key link is unlinked by clearing the foreign key on the many side (769).'')');
  EXECUTE src;
END $mig$;

-- ── PROVED BY DOING — through the front door, not around it ────────────────

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid;
  ds uuid; br uuid;
  airport uuid; airline uuid; facility uuid;
  serves uuid; c_air uuid; at_id uuid; rule_id uuid;
  src_p record; tgt_p record; n int; err text; before_edits int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m769 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm769-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm769-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M769 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm769p', 'm769 probe') RETURNING id INTO proj;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M769Airport', 'Airport') RETURNING id INTO airport;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M769Airline', 'Airline') RETURNING id INTO airline;
  -- The airport carries the foreign key: many airports serve one airline here,
  -- so 417 puts `airline_pk` on the airport and names it after the target's key.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (airport, 'airport_pk', 'Airport Pk', 'airportPk', 'string', 'column', 'airport_pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column)
  VALUES (airport, 'airline_pk', 'Airline Pk', 'airlinePk', 'string', 'column', 'airline_pk');
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     is_primary_key, is_title_key, required)
  VALUES (airline, 'airline_pk', 'Airline Pk', 'airlinePk', 'string', 'column', 'airline_pk', true, true, true);

  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, airport, airline, 'm769-serves', 'Serves', 'many_to_one', 'foreign_key', 'airline_pk')
  RETURNING id INTO serves;

  INSERT INTO public.ontology_interfaces (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M769Facility', 'Facility') RETURNING id INTO facility;
  INSERT INTO public.interface_link_constraints
    (interface_id, api_name, display_name, cardinality, target_kind, target_object_type_id)
  VALUES (facility, 'airlines', 'Airlines', 'ONE', 'object_type', airline)
  RETURNING id INTO c_air;

  -- The foreign key is written as an object edit on the airport, so the
  -- airport has to allow edits — the same gate an object rule passes.
  UPDATE public.object_types SET edits_enabled = true WHERE id = airport;

  PERFORM public.implement_interface(airport, facility);
  PERFORM public.satisfy_link_constraint(airport, facility, c_air, ARRAY[serves]);

  -- THE FRONT DOOR: save_action_type, which is the only writer of rules.
  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm769-link', 'label', 'M769 Link', 'ontology_id', ont, 'project_id', proj,
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'create_link_on_object_of_interface',
      'interface_id', facility,
      'interface_link_constraint_api_name', 'airlines')))) INTO at_id;
  PERFORM public.save_working_state();

  SELECT id INTO rule_id FROM public.action_type_rules WHERE action_type_id = at_id;
  IF (SELECT interface_link_constraint_id FROM public.action_type_rules WHERE id = rule_id)
     IS DISTINCT FROM c_air THEN
    RAISE EXCEPTION 'the authoring door did not carry the constraint';
  END IF;

  -- and it generated both ends, and pointed the rule at them
  SELECT * INTO src_p FROM public.action_type_parameters
   WHERE id = (SELECT source_parameter_id FROM public.action_type_rules WHERE id = rule_id);
  SELECT * INTO tgt_p FROM public.action_type_parameters
   WHERE id = (SELECT target_parameter_id FROM public.action_type_rules WHERE id = rule_id);
  IF src_p.data_kind <> 'interfaceObject' OR src_p.interface_id <> facility THEN
    RAISE EXCEPTION 'the source should be an interface reference parameter, got %', src_p.data_kind;
  END IF;
  IF tgt_p.data_kind <> 'object' OR tgt_p.object_type_id <> airline THEN
    RAISE EXCEPTION 'an object-type target makes the destination an object reference, got %', tgt_p.data_kind;
  END IF;

  -- APPLY IT, and read the edit it made.
  SELECT count(*) INTO before_edits FROM public.object_edits WHERE object_type_id = airport;
  SELECT public.apply_action(at_id, jsonb_build_object(
    src_p.api_name, jsonb_build_object('objectTypeApiName', 'M769Airport', 'primaryKeyValue', 'LHR'),
    tgt_p.api_name, 'BA'), NULL, 'm769') INTO n;
  IF n <> 1 THEN RAISE EXCEPTION 'one edit should have been written, got %', n; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.object_edits e
                  WHERE e.object_type_id = airport AND e.primary_key = 'LHR'
                    AND e.instruction = 'modify'
                    AND e.properties ->> 'airline_pk' = 'BA') THEN
    RAISE EXCEPTION 'creating the link should set the foreign key on the airport to the airline''s key';
  END IF;

  -- and the delete rule clears it
  UPDATE public.action_type_rules SET kind = 'delete_link_on_object_of_interface' WHERE id = rule_id;
  PERFORM public.apply_action(at_id, jsonb_build_object(
    src_p.api_name, jsonb_build_object('objectTypeApiName', 'M769Airport', 'primaryKeyValue', 'LHR'),
    tgt_p.api_name, 'BA'), NULL, 'm769');
  IF NOT EXISTS (SELECT 1 FROM public.object_edits e
                  WHERE e.object_type_id = airport AND e.primary_key = 'LHR'
                    AND e.instruction = 'modify'
                    AND e.properties -> 'airline_pk' = 'null'::jsonb) THEN
    RAISE EXCEPTION 'deleting the link should clear the foreign key';
  END IF;

  -- a type that named no concrete link for the constraint. The clause is
  -- optional, so 768's conformance trigger has nothing to say about it — the
  -- refusal is the rule's, at apply time, which is where it belongs.
  DELETE FROM public.interface_link_satisfactions
   WHERE object_type_id = airport AND constraint_id = c_air;
  BEGIN
    PERFORM public.apply_action(at_id, jsonb_build_object(
      src_p.api_name, jsonb_build_object('objectTypeApiName', 'M769Airport', 'primaryKeyValue', 'LHR'),
      tgt_p.api_name, 'BA'), NULL, 'm769');
    RAISE EXCEPTION 'a constraint with no concrete link should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Actions:InterfaceLinkNotImplemented%' THEN RAISE; END IF;
  END;
  PERFORM public.satisfy_link_constraint(airport, facility, c_air, ARRAY[serves]);

  -- create refuses more than one concrete implementation
  UPDATE public.action_type_rules SET kind = 'create_link_on_object_of_interface' WHERE id = rule_id;
  INSERT INTO public.link_types (ontology_id, project_id, source_object_type_id, target_object_type_id,
                                 api_name, label, cardinality, backing_kind, backing_column)
  VALUES (ont, proj, airport, airline, 'm769-also', 'Also serves', 'many_to_one', 'foreign_key', 'airline_pk');
  PERFORM public.satisfy_link_constraint(airport, facility, c_air,
    ARRAY[serves, (SELECT id FROM public.link_types WHERE api_name = 'm769-also')]);
  BEGIN
    PERFORM public.apply_action(at_id, jsonb_build_object(
      src_p.api_name, jsonb_build_object('objectTypeApiName', 'M769Airport', 'primaryKeyValue', 'LHR'),
      tgt_p.api_name, 'BA'), NULL, 'm769');
    RAISE EXCEPTION 'a create rule should refuse two implementations';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Actions:MultipleLinkImplementations%' THEN RAISE; END IF;
  END;

  -- delete does all of them
  UPDATE public.action_type_rules SET kind = 'delete_link_on_object_of_interface' WHERE id = rule_id;
  SELECT public.apply_action(at_id, jsonb_build_object(
    src_p.api_name, jsonb_build_object('objectTypeApiName', 'M769Airport', 'primaryKeyValue', 'LHR'),
    tgt_p.api_name, 'BA'), NULL, 'm769') INTO n;
  IF n <> 2 THEN
    RAISE EXCEPTION 'delete should have attempted both implementations, got %', n;
  END IF;

  -- and the registry now refuses nothing
  IF EXISTS (SELECT 1 FROM public.action_rule_kinds() k WHERE NOT k.executable) THEN
    RAISE EXCEPTION 'every rule kind should now be executable';
  END IF;

  RAISE EXCEPTION USING errcode = 'P0769', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0769' THEN
  NULL;
END $$;
