-- A create-or-modify rule compiles to the edit it means.
--
--   "3. **Create or modify object(s):** Can be used to modify an existing object based on an object reference parameter. If an object is not selected, a new object will be created with either an automatically generated unique ID, or with a user submitted primary key."
--   — action-types/rules.md
--
-- The kind has sat in action_rule_kinds() since 418 as not executable — "Needs
-- an existence check against the merged object" (446). Both halves exist now:
-- 748's object_before_state reads the merged object (index row with the edit
-- overlay), and 755 resolves an object reference parameter to the primary key
-- it carries — the api encodes an object reference as
--
--   "| Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`"
--   — api/ontologies-v2-resources-actions-apply-action.md
--
-- WHAT THE RULE COMPILES TO is the page's own word: the api's LogicRule union
-- has createObject, modifyObject and deleteObject and no upsert member (the
-- nine members of api/ontologies-v2-resources-action-types-get-action-type
-- were counted, applyScenario the ninth), and
--
--   "When multiple rules are defined, the actions backend compiles rules to generate a single edit per object (e.g., **Add object**, **Modify object(s)**, or **Delete object(s)**)."
--   — action-types/rules.md
--
-- So an Ontology Manager rule kind, kept in the prose vocabulary we build,
-- writes an object_edits row of instruction 'create' or 'modify' — the two
-- arms apply_action already has, chosen by whether an object was selected.
-- Nothing new is stored per edit; 469's assert_rule_order already counts the
-- kind as both halves.
--
-- WHAT THE RULE CARD HOLDS is on the Gaia walkthrough, the one place the
-- mirror shows this rule configured. Its wizard spells the kind the other way
-- round and puts the create branch's key source on the card:
--
--   "Select **Modify or create object** under **Object actions** before choosing **Next**."
--   "Select **Auto-generated primary key** from the **Or create a new object with** dropdown menu."
--   — object-link-types/create-ontology-objects-from-gaia.md
--
-- Five captures on that page were parsed for this: configure-milsym-action-
-- type.png (the Rules tab: a card titled 1. Modify or create object with two
-- rows, Modify existing selected holding a chip, and Or create a new object
-- with holding Auto-generated primary key, over one PROPERTY → MAP TO table);
-- configure-create-or-modify-action-type-properties.png and configure-milsym-
-- action-type-properties.png (the same card inside the wizard's Map action
-- parameters step, the chip greyed); configure-milsym-classification-
-- parameter.png (a parameter's Default value sourced as Object parameter
-- property from a chip drawn identically — cube icon, blurred prefix, the
-- type's name — which there can only be an object reference parameter: that
-- capture decides what the card's chip is); and configure-create-object-type.png,
-- which despite the prose is a plain Create object card, its PROPERTY → MAP TO
-- table mapping Object Id → Unique Identifier 1, a key-iconed parameter. Read
-- with the walkthrough's step:
--
--   "4. Select **Back to Form** and remove `Object Id` from **Form content** by selecting the **X** icon on the far right side of the **Object Id** panel. Foundry will automatically generate a unique ID for each object created from Gaia."
--   — object-link-types/create-ontology-objects-from-gaia.md
--
-- the auto-generated ID is a PARAMETER — one the author hides from the form —
-- and the mirror names the type class that makes a parameter behave so:
--
--   "|	|Action type	|actions	|generate\_uuid	| Replaces a string parameter with a UUID. |"
--   — object-link-types/metadata-typeclasses.md
--
-- which 666 already fills server-side before the rules run. So the card
-- COMPILES INTO PARAMETERS, the way 592/594 generate the parameters an
-- interface rule needs:
--
-- - "Modify existing selected" is an object reference parameter of the rule's
--   type. The author may name one (object_parameter_api_name); otherwise the
--   save generates it, named after the type. Its value at submission is the
--   selected object; blank, the create branch runs. INFERENCE, scoped: when
--   the parameter is blank and the caller passed a primary key (the Explorer's
--   selection, which is how modify_object has always been told its object),
--   that key is the selection — the divergence 445 took, not widened.
-- - "Or create a new object with" is a column holding one of the dropdown's two
--   values, snake_cased: auto_generated_primary_key (the captured option, and
--   the wizard's shown default) or user_submitted_primary_key (the prose's "a
--   user submitted primary key"; no capture shows the dropdown open, so the
--   second label is the prose's). Auto-generation compiles into a hidden string
--   parameter carrying generate_uuid, mapped onto the primary key property —
--   the capture's Object Id → Unique Identifier 1 — so the create arm's
--   existing props ->> pk_prop receives the UUID 666 filled. A user-submitted
--   key is the create_object contract unchanged: the rule's properties must
--   produce it, refused by Actions:CreateNeedsPrimaryKey otherwise. No page
--   prints the two-value set, so — as 676 did for the cover-page radios — the
--   CHECK carries no `Values from` declaration; it is written in the IN form
--   check:readings' declaration regex does not match, and the platform suite's
--   undeclared-set count rises by one. readings/api-action-type.md §3.1 is the
--   trace.
--
-- Selecting an object that does not exist is not a create — an object
-- reference parameter's value "must be the primary key of an object found
-- within an object set" (the api's objectQueryResult constraint, same page as
-- the encoding above), so it is refused by name. Existence is asked of the
-- merged object the way a reader sees it: the index row, then the edit log's
-- four-step decision (422's object_state), which says deleted for a latest
-- delete and for nothing ever created.
--
-- INFERENCE, marked: on the modify branch a primary-key mapping on the rule
-- (there for the create it may perform — the generated UUID parameter, or a
-- user's key) is skipped rather than refused, because
--
--   "Note that primary key values *cannot be modified* by any action type."
--   — action-types/actions-on-interfaces.md
--
-- says what may not happen, and the mapped value has no object to apply to
-- but the one already chosen. Refusing would make every create-or-modify rule
-- unusable on its modify path.
--
-- FOUND WHILE PATCHING, fixed in passing: (a) the required-properties fallback
-- read `object_current_value(target, p_primary_key, …)` for every modify kind —
-- the INDEX row under the caller's key — so an interface modify, whose object
-- comes from the interface reference parameter and whose p_primary_key is
-- NULL, fell back to nothing, and so did any object that exists only in the
-- edit log (created by an action, not yet built): both could be refused a
-- required property the object already holds. It now reads the merged object
-- (748's object_before_state) under the key the rule edits — the proof below
-- modifies an unbuilt object whose required title only the edit log holds.
-- (b) apply_action_type resolved a rule's
-- parameter sides only through api names, while a label-only re-save replays
-- rules from the stored row, which carries the raw ids — 755's source and
-- target sides would have dropped on such a re-save; both now fall back to the
-- id, whose value the parameter upsert preserves.
--
-- Residuals, recorded not built: 469 refuses create_object + create_or_modify
-- on one type in one action ("Objects cannot be created twice in one form
-- submission"), and the page attaches "cannot reference an object created as a
-- part of the current action" to Modify and Delete, not to this kind — here a
-- key the same action created earlier is simply seen as existing; the existence
-- check is the ontology-visibility one every edit path uses, not the
-- restricted-view gate the readers carry; an object visible only in an index
-- that is not ready (unbuilt, or a rebuild RUNNING — the Explorer reindexes
-- after every apply) does not exist to this rule until the build completes,
-- the window 748's before-image shares; 748's object_before_state compares the
-- index key column without the ::text cast 670 uses, so a non-string key with a
-- ready index raises there — object_exists casts, 748 is corrected forward
-- separately; and "object(s)" is one apply per selection here, as the Explorer
-- already does for modify.

-- ── the two things the rule card holds ──────────────────────────────────────

ALTER TABLE public.action_type_rules
  ADD COLUMN object_parameter_id uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  ADD COLUMN create_new_object_with text
    CONSTRAINT action_type_rules_create_new_object_with_check
    CHECK (create_new_object_with IS NULL
           OR create_new_object_with IN ('auto_generated_primary_key', 'user_submitted_primary_key'));
CREATE INDEX action_type_rules_object_parameter_idx
  ON public.action_type_rules (object_parameter_id) WHERE object_parameter_id IS NOT NULL;

-- A rule of the kind authored before 760 could carry no card choice; the
-- neutral reading of one is the create_object contract it was refused under.
UPDATE public.action_type_rules SET create_new_object_with = 'user_submitted_primary_key'
 WHERE kind = 'create_or_modify_object' AND create_new_object_with IS NULL;
ALTER TABLE public.action_type_rules
  ADD CONSTRAINT action_type_rules_create_or_modify_columns_check CHECK (
    (object_parameter_id IS NULL OR kind = 'create_or_modify_object')
    AND ((kind = 'create_or_modify_object') = (create_new_object_with IS NOT NULL)));

COMMENT ON COLUMN public.action_type_rules.object_parameter_id IS
  'For create_or_modify_object: the object reference parameter the card''s "Modify existing selected" chip is — named by the author or generated by the save, after the type (760). Its value at submission is the selected object; blank means create. Cascades with the parameter, as 755''s link sides do.';
COMMENT ON COLUMN public.action_type_rules.create_new_object_with IS
  'For create_or_modify_object, the card''s "Or create a new object with" dropdown: auto_generated_primary_key (compiled into a hidden generate_uuid parameter mapped onto the key) or user_submitted_primary_key (the rule''s properties produce the key, as create_object requires). Required on that kind, NULL on every other — the CHECK says so (760).';
COMMENT ON CONSTRAINT action_type_rules_create_new_object_with_check ON public.action_type_rules IS
  'The two ways rules.md says a new object gets its key — "either an automatically generated unique ID, or with a user submitted primary key" — snake_cased from the dropdown option read off object-link-types/images/configure-milsym-action-type.png (Auto-generated primary key) and the prose. No page prints the set, so no Values-from declaration is possible; readings/api-action-type.md §3.1 carries the trace.';
COMMENT ON CONSTRAINT action_type_rules_create_or_modify_columns_check ON public.action_type_rules IS
  'The card''s two fields belong to create_or_modify_object alone, and the key-source choice is never absent there (760).';

-- ── does the merged object exist ────────────────────────────────────────────

CREATE FUNCTION public.object_exists(p_object_type uuid, p_primary_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE ont uuid; tbl text; pk_col text; base jsonb; gone boolean;
BEGIN
  SELECT t.ontology_id, x.index_table INTO ont, tbl
    FROM public.object_types t
    LEFT JOIN public.object_type_indexes x
      ON x.object_type_id = t.id AND public.object_type_index_ready(x.object_type_id)
   WHERE t.id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;
  SELECT p.property_id INTO pk_col FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.is_primary_key;
  IF tbl IS NOT NULL AND pk_col IS NOT NULL THEN
    -- ::text as 670 compares: an integer key column against the text key
    EXECUTE format('SELECT to_jsonb(o) FROM objects.%I o WHERE o.%I::text = $1', tbl, pk_col)
      INTO base USING p_primary_key;
  END IF;
  -- 422's four steps, with the index row standing as the datasource row: a
  -- latest delete, or nothing created over no row, is "deleted".
  SELECT s.deleted INTO gone FROM public.object_state(p_object_type, p_primary_key, base) s;
  RETURN coalesce(NOT gone, false);
END $fn$;
COMMENT ON FUNCTION public.object_exists(uuid, text) IS
  'Whether a reader currently sees an object with this primary key: the built index row with the edit log replayed over it, per object-edits/how-edits-applied''s four steps. What a create-or-modify rule asks before choosing its edit (760).';
REVOKE ALL ON FUNCTION public.object_exists(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_exists(uuid, text) TO authenticated, service_role;

-- ── the card compiles into parameters ───────────────────────────────────────

CREATE FUNCTION public.generate_create_or_modify_parameters(p_action_type uuid)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE r record; ty record; pk record; n int := 0; pos int; api text; pid uuid;
BEGIN
  SELECT coalesce(max(position), -1) + 1 INTO pos
    FROM public.action_type_parameters WHERE action_type_id = p_action_type;

  FOR r IN SELECT * FROM public.action_type_rules
            WHERE action_type_id = p_action_type AND kind = 'create_or_modify_object'
            ORDER BY position
  LOOP
    SELECT * INTO ty FROM public.object_types WHERE id = r.object_type_id;
    CONTINUE WHEN ty.id IS NULL;

    -- "Modify existing selected": an object reference parameter of the type,
    -- named after it when the author named none (594 names an interface's so)
    IF r.object_parameter_id IS NULL THEN
      SELECT pa.id INTO pid FROM public.action_type_parameters pa
       WHERE pa.action_type_id = p_action_type AND pa.data_kind = 'object'
         AND pa.object_type_id = ty.id
       ORDER BY pa.position LIMIT 1;
      IF pid IS NULL THEN
        api := regexp_replace(ty.api_name, '[^A-Za-z0-9]', '', 'g');
        api := lower(left(api, 1)) || right(api, -1);
        IF EXISTS (SELECT 1 FROM public.action_type_parameters
                    WHERE action_type_id = p_action_type AND api_name = api) THEN
          api := api || 'Object';
        END IF;
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, object_type_id, data_kind,
           required, exposed, editable, position)
        VALUES (p_action_type, api, ty.label, NULL, ty.id, 'object', false, true, true, pos)
        RETURNING id INTO pid;
        pos := pos + 1; n := n + 1;
      END IF;
      UPDATE public.action_type_rules SET object_parameter_id = pid WHERE id = r.id;
    END IF;

    -- Or create a new object with → Auto-generated primary key: a hidden
    -- generate_uuid parameter mapped onto the key, the capture's Object Id →
    -- Unique Identifier 1; 666 fills it before the rules run
    IF r.create_new_object_with = 'auto_generated_primary_key' THEN
      SELECT * INTO pk FROM public.object_type_properties
       WHERE object_type_id = ty.id AND is_primary_key;
      IF pk.id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.action_type_rule_properties rp
            WHERE rp.rule_id = r.id AND rp.property_id = pk.id) THEN
        SELECT pa.id INTO pid FROM public.action_type_parameters pa
         WHERE pa.action_type_id = p_action_type AND 'generate_uuid' = ANY (pa.type_classes)
           AND pa.base_type = 'string'
         ORDER BY pa.position LIMIT 1;
        IF pid IS NULL THEN
          api := regexp_replace(pk.api_name, '[^A-Za-z0-9]', '', 'g');
          api := lower(left(api, 1)) || right(api, -1);
          IF EXISTS (SELECT 1 FROM public.action_type_parameters
                      WHERE action_type_id = p_action_type AND api_name = api) THEN
            api := api || 'Generated';
          END IF;
          INSERT INTO public.action_type_parameters
            (action_type_id, api_name, display_name, base_type, data_kind,
             required, exposed, editable, position, type_classes)
          VALUES (p_action_type, api, 'Unique Identifier', 'string', 'base_type',
                  false, false, false, pos, ARRAY['generate_uuid'])
          RETURNING id INTO pid;
          pos := pos + 1; n := n + 1;
        END IF;
        INSERT INTO public.action_type_rule_properties (rule_id, property_id, value_source, parameter_id)
        VALUES (r.id, pk.id, 'parameter', pid);
      END IF;
    END IF;
  END LOOP;
  RETURN n;
END $fn$;
COMMENT ON FUNCTION public.generate_create_or_modify_parameters(uuid) IS
  'What a create-or-modify rule card compiles into (760): the object reference parameter its "Modify existing selected" chip is, generated after the type when the author named none; and, for "Auto-generated primary key", a hidden string parameter carrying generate_uuid mapped onto the primary key — the way object-link-types/create-ontology-objects-from-gaia shows Foundry doing it. Idempotent: a re-save adds nothing.';

-- ── the registry says it runs ───────────────────────────────────────────────

DO $$
DECLARE src text; a1 text; a2 text;
BEGIN
  src := replace(pg_get_functiondef('public.action_rule_kinds()'::regprocedure), chr(13), '');
  a1 := '(''create_or_modify_object'', ''object_type'', false, ''sql'',';
  a2 := '''Needs an existence check against the merged object; not executable yet.''';
  IF (length(src) - length(replace(src, a1, ''))) / length(a1) <> 1
     OR (length(src) - length(replace(src, a2, ''))) / length(a2) <> 1 THEN
    RAISE EXCEPTION '760: the registry row is not the text 446 wrote';
  END IF;
  src := replace(src, a1, '(''create_or_modify_object'', ''object_type'', true, ''sql'',');
  src := replace(src, a2,
    '''Modifies the object its object reference parameter selects; when none is selected, creates one with an auto-generated or a user-submitted key. Compiles to a create or a modify edit, as the page says the backend does (760).''');
  EXECUTE src;
END $$;

-- ── apply_action: the arm, in the two branches it already has ───────────────
-- Patched, never retyped: each anchor must be exactly once in the live text.

DO $$
DECLARE src text; anchors text[]; a text; i int;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure), chr(13), '');
  anchors := ARRAY[
    '  sched_run uuid;',
    '    -- ── the properties, resolved onto the target type ──────────────────────',
    '      -- "primary key values cannot be modified by any action type."',
    '      IF reqv IS NULL AND r.kind IN (''modify_object'', ''modify_object_of_interface'') THEN
        reqv := public.object_current_value(target, p_primary_key, rq.property_id);',
    '    IF r.kind IN (''create_object'', ''create_object_of_interface'') THEN',
    '    ELSIF r.kind IN (''modify_object'', ''modify_object_of_interface'') THEN'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: apply_action is not the text 760 read: %', left(a, 70);
    END IF;
  END LOOP;

  src := replace(src, anchors[1], anchors[1] || '
  com_par  record;   -- a create-or-modify rule''s object reference parameter (760)');

  src := replace(src, anchors[2],
'-- ── create or modify (760): the object reference parameter selects ──────
    -- "modify an existing object based on an object reference parameter. If an
    -- object is not selected, a new object will be created"
    IF r.kind = ''create_or_modify_object'' THEN
      SELECT pa.api_name, pa.data_kind, pa.object_type_id INTO com_par
        FROM public.action_type_parameters pa WHERE pa.id = r.object_parameter_id;
      IF com_par.api_name IS NULL THEN
        RAISE EXCEPTION ''Actions:CreateOrModifyNeedsObjectParameter — the rule''''s object reference parameter is missing; saving the action type generates one'';
      END IF;
      IF com_par.data_kind <> ''object'' OR com_par.object_type_id IS DISTINCT FROM target THEN
        RAISE EXCEPTION ''Actions:ObjectParameterTypeMismatch — the rule''''s object reference parameter must reference %'',
          (SELECT api_name FROM public.object_types WHERE id = target);
      END IF;
      -- the parameter selects; blank, the caller''s selection stands (the
      -- Explorer''s, as modify_object reads it — inference, scoped in 760)
      ref_pk := coalesce(nullif(btrim(coalesce(p_parameters ->> com_par.api_name, '''')), ''''),
                         nullif(btrim(coalesce(p_primary_key, '''')), ''''));
      IF ref_pk IS NOT NULL AND NOT public.object_exists(target, ref_pk) THEN
        RAISE EXCEPTION ''Actions:ObjectNotFound — "%" is not the primary key of an existing %: the parameter value must be the primary key of an object found within an object set'',
          ref_pk, (SELECT api_name FROM public.object_types WHERE id = target);
      END IF;
    END IF;

' || anchors[2]);

  src := replace(src, anchors[3],
'-- A create-or-modify rule maps the primary key for the create it may
      -- perform (the generated UUID, or a user''s key); once an object is
      -- selected, that mapping has nothing left to name (760, inference).
      CONTINUE WHEN rp.is_pk AND r.kind = ''create_or_modify_object'' AND ref_pk IS NOT NULL;
' || anchors[3]);

  src := replace(src, anchors[4],
'      IF reqv IS NULL AND (r.kind IN (''modify_object'', ''modify_object_of_interface'')
                           OR (r.kind = ''create_or_modify_object'' AND ref_pk IS NOT NULL)) THEN
        -- the key the rule edits, and the MERGED object — index row with the
        -- edit overlay — not the index alone, so an object that exists only in
        -- the edit log has its fallback too (760; 670 read the index, and read
        -- it under p_primary_key, which an interface modify leaves NULL)
        SELECT coalesce(s.properties -> rq.property_id, s.properties -> rq.api_name) INTO reqv
          FROM public.object_before_state(target, coalesce(ref_pk, p_primary_key)) s;');

  src := replace(src, anchors[5],
'    IF r.kind IN (''create_object'', ''create_object_of_interface'')
       OR (r.kind = ''create_or_modify_object'' AND ref_pk IS NULL) THEN');

  src := replace(src, anchors[6],
'    ELSIF r.kind IN (''modify_object'', ''modify_object_of_interface'')
       OR (r.kind = ''create_or_modify_object'' AND ref_pk IS NOT NULL) THEN');

  EXECUTE src;
END $$;

-- ── apply_action_type: the authoring upsert carries the card, and re-saves keep it ──

DO $$
DECLARE src text; a1 text; a2 text; a3 text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action_type(jsonb,jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');
  a1 := '       source_parameter_id, target_parameter_id)';
  a2 := '            (param_id->>(e->>''source_parameter_api_name''))::uuid,
            (param_id->>(e->>''target_parameter_api_name''))::uuid)';
  a3 := '  PERFORM public.generate_interface_parameters(t);';
  IF (length(src) - length(replace(src, a1, ''))) / length(a1) <> 1
     OR (length(src) - length(replace(src, a2, ''))) / length(a2) <> 1
     OR (length(src) - length(replace(src, a3, ''))) / length(a3) <> 1 THEN
    RAISE EXCEPTION '760: apply_action_type is not the text 755/595 wrote';
  END IF;
  src := replace(src, a1,
    '       source_parameter_id, target_parameter_id, object_parameter_id, create_new_object_with)');
  -- a name when the payload came from the builder; the id when a re-save
  -- replayed the stored row (whose parameters keep their ids through the upsert)
  src := replace(src, a2,
'            coalesce((param_id->>(e->>''source_parameter_api_name''))::uuid, nullif(e->>''source_parameter_id'','''')::uuid),
            coalesce((param_id->>(e->>''target_parameter_api_name''))::uuid, nullif(e->>''target_parameter_id'','''')::uuid),
            coalesce((param_id->>(e->>''object_parameter_api_name''))::uuid, nullif(e->>''object_parameter_id'','''')::uuid),
            CASE WHEN e->>''kind'' = ''create_or_modify_object''
                 THEN coalesce(nullif(e->>''create_new_object_with'',''''), ''auto_generated_primary_key'') END)');
  src := replace(src, a3, a3 || '
  PERFORM public.generate_create_or_modify_parameters(t);');
  EXECUTE src;
END $$;

-- ── PROVED BY DOING — both branches, both keys, through the front door ──────

DO $$
DECLARE n int; src text;
BEGIN
  SELECT count(*) INTO n FROM public.action_rule_kinds() WHERE executable AND runtime = 'sql';
  IF n <> 10 THEN RAISE EXCEPTION 'ten SQL rule kinds should execute now, % do', n; END IF;
  SELECT count(*) INTO n FROM public.action_rule_kinds();
  IF n <> 13 THEN RAISE EXCEPTION 'the registry should still hold thirteen kinds, holds %', n; END IF;
  src := pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure);
  IF (length(src) - length(replace(src, 'object_before_state(target, coalesce(ref_pk, p_primary_key))', '')))
     / length('object_before_state(target, coalesce(ref_pk, p_primary_key))') <> 1 THEN
    RAISE EXCEPTION 'the required-properties fallback should read the merged object under the edited key once';
  END IF;
END $$;

DO $$
DECLARE
  org uuid; usr uuid; space uuid; ont uuid; proj uuid; ds uuid; br uuid;
  ty uuid; act uuid; act2 uuid; objp text; key text; n int; err text;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m760 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm760-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm760-' || usr || '@beacon.test', 'admin', org);
  SELECT public.create_space('M760 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm760p', 'm760 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm760ds', 'm760ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;

  -- a type with a string key, a required title and an optional status, edits
  -- on. The key saves with the datasource; the other two are bound to it
  -- afterwards, since a non-key property must name the datasource it comes from.
  SELECT public.save_object_type(
    jsonb_build_object('api_name', 'M760Task', 'label', 'M760 Task', 'ontology_id', ont,
      'datasources', jsonb_build_array(jsonb_build_object('dataset_id', ds, 'branch_id', br))),
    jsonb_build_array(
      jsonb_build_object('property_id', 'task_id', 'display_name', 'Task Id', 'api_name', 'taskId',
        'base_type', 'string', 'source', 'column', 'backing_column', 'task_id',
        'is_primary_key', true, 'is_title_key', true, 'required', true)))
    INTO ty;
  PERFORM public.save_working_state();
  UPDATE public.object_types SET edits_enabled = true WHERE id = ty;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column,
     datasource_id, required)
  SELECT ty, v.pid, v.dn, v.an, 'string', 'column', v.pid,
         (SELECT d.id FROM public.object_type_datasources d WHERE d.object_type_id = ty), v.req
    FROM (VALUES ('title', 'Title', 'title', true), ('status', 'Status', 'status', false))
         AS v(pid, dn, an, req);

  -- the card as the wizard shows it: Auto-generated primary key, no object
  -- parameter named — both are generated by the save
  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm760-upsert', 'label', 'M760 upsert', 'ontology_id', ont,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'title', 'display_name', 'Title', 'base_type', 'string', 'required', false, 'position', 0),
      jsonb_build_object('api_name', 'status', 'display_name', 'Status', 'base_type', 'string', 'required', true, 'position', 1)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'create_or_modify_object', 'position', 0, 'object_type_id', ty,
      'create_new_object_with', 'auto_generated_primary_key',
      'properties', jsonb_build_array(
        jsonb_build_object('property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ty AND property_id = 'title'),
                           'value_source', 'parameter', 'parameter_api_name', 'title'),
        jsonb_build_object('property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ty AND property_id = 'status'),
                           'value_source', 'parameter', 'parameter_api_name', 'status')))))) INTO act;
  PERFORM public.save_working_state();

  SELECT pa.api_name INTO objp FROM public.action_type_rules r
    JOIN public.action_type_parameters pa ON pa.id = r.object_parameter_id
   WHERE r.action_type_id = act;
  IF objp IS DISTINCT FROM 'm760Task' THEN
    RAISE EXCEPTION 'the save should generate the object reference parameter after the type, got %', objp;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.action_type_rule_properties rp
                  JOIN public.action_type_parameters pa ON pa.id = rp.parameter_id
                  JOIN public.object_type_properties p ON p.id = rp.property_id
                 WHERE p.object_type_id = ty AND p.is_primary_key
                   AND 'generate_uuid' = ANY (pa.type_classes) AND NOT pa.exposed) THEN
    RAISE EXCEPTION 'the save should map the key onto a hidden generate_uuid parameter';
  END IF;

  -- nothing selected: a create, keyed by the generated UUID
  IF public.apply_action(act, '{"title":"first","status":"open"}'::jsonb) <> 1 THEN
    RAISE EXCEPTION 'the create should write one edit';
  END IF;
  SELECT primary_key INTO key FROM public.object_edits
   WHERE action_type_id = act AND instruction = 'create';
  IF key IS NULL OR length(key) <> 36 THEN
    RAISE EXCEPTION 'the create should carry a generated UUID key, got %', key;
  END IF;

  -- selected through the parameter: a modify, and the key mapping stands aside
  IF public.apply_action(act, jsonb_build_object(objp, key, 'title', 'first', 'status', 'closed')) <> 1 THEN
    RAISE EXCEPTION 'the modify should write one edit';
  END IF;
  IF (SELECT "before" ->> 'status' FROM public.object_edits
       WHERE action_type_id = act AND instruction = 'modify') IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'the modify should carry the before-image the create left';
  END IF;

  -- the parameter blank, the caller's selection stands
  IF public.apply_action(act, '{"title":"first","status":"reopened"}'::jsonb, key) <> 1 THEN
    RAISE EXCEPTION 'the selection should modify';
  END IF;
  SELECT count(*) INTO n FROM public.object_edits WHERE action_type_id = act AND instruction = 'create';
  IF n <> 1 THEN RAISE EXCEPTION 'exactly one object should have been created, % were', n; END IF;

  -- a second card that maps only the status: modifying the object it selects
  -- passes because the required title is found on the MERGED object — the
  -- fallback (a) fixed, on an object no index has built; creating through it
  -- is refused, as a create has nothing to fall back to
  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm760-close', 'label', 'M760 close', 'ontology_id', ont,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'status', 'display_name', 'Status', 'base_type', 'string', 'required', true, 'position', 0)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'create_or_modify_object', 'position', 0, 'object_type_id', ty,
      'create_new_object_with', 'auto_generated_primary_key',
      'properties', jsonb_build_array(
        jsonb_build_object('property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ty AND property_id = 'status'),
                           'value_source', 'parameter', 'parameter_api_name', 'status')))))) INTO act2;
  PERFORM public.save_working_state();
  IF public.apply_action(act2, jsonb_build_object('m760Task', key, 'status', 'closed')) <> 1 THEN
    RAISE EXCEPTION 'the close should modify the selected object';
  END IF;
  IF (SELECT properties FROM public.object_edits WHERE action_type_id = act2) <> '{"status":"closed"}'::jsonb THEN
    RAISE EXCEPTION 'the close should write only the status';
  END IF;
  BEGIN
    PERFORM public.apply_action(act2, '{"status":"x"}'::jsonb);
    RAISE EXCEPTION 'a create without the required title should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Actions:RequiredPropertyMissing%' THEN RAISE; END IF;
  END;

  -- a key naming no object is refused, not created
  BEGIN
    PERFORM public.apply_action(act, jsonb_build_object(objp, 'NOPE', 'status', 'x'));
    RAISE EXCEPTION 'an unknown key should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Actions:ObjectNotFound%' THEN RAISE; END IF;
  END;

  -- the other dropdown value: a user-submitted key from the rule's properties
  SELECT public.save_action_type(jsonb_build_object(
    'api_name', 'm760-upsert-keyed', 'label', 'M760 upsert keyed', 'ontology_id', ont,
    'parameters', jsonb_build_array(
      jsonb_build_object('api_name', 'taskId', 'display_name', 'Task', 'base_type', 'string', 'required', false, 'position', 0),
      jsonb_build_object('api_name', 'title', 'display_name', 'Title', 'base_type', 'string', 'required', false, 'position', 1)),
    'rules', jsonb_build_array(jsonb_build_object(
      'kind', 'create_or_modify_object', 'position', 0, 'object_type_id', ty,
      'create_new_object_with', 'user_submitted_primary_key',
      'properties', jsonb_build_array(
        jsonb_build_object('property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ty AND property_id = 'task_id'),
                           'value_source', 'parameter', 'parameter_api_name', 'taskId'),
        jsonb_build_object('property_id', (SELECT id FROM public.object_type_properties WHERE object_type_id = ty AND property_id = 'title'),
                           'value_source', 'parameter', 'parameter_api_name', 'title')))))) INTO act2;
  PERFORM public.save_working_state();
  BEGIN
    PERFORM public.apply_action(act2, '{"title":"t"}'::jsonb);
    RAISE EXCEPTION 'a create with no key should be refused';
  EXCEPTION WHEN raise_exception THEN
    err := SQLERRM;
    IF err NOT LIKE 'Actions:CreateNeedsPrimaryKey%' THEN RAISE; END IF;
  END;
  IF public.apply_action(act2, '{"taskId":"K1","title":"t"}'::jsonb) <> 1 THEN
    RAISE EXCEPTION 'the submitted key should create';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.object_edits
                  WHERE action_type_id = act2 AND instruction = 'create' AND primary_key = 'K1') THEN
    RAISE EXCEPTION 'the created object should carry the submitted key';
  END IF;

  RAISE EXCEPTION USING errcode = 'P0760', message = 'rollback the probe';
EXCEPTION WHEN sqlstate 'P0760' THEN
  NULL;
END $$;
