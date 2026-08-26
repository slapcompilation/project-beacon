-- 682: action reverts — one submission, its before-image, and a
-- compensating append.
--
--   "Action reverts in [Ontology Manager](/docs/foundry/ontology-manager/overview/) allow an action to be reverted (that is, undone) immediately after the action has been applied."
--   — action-types/action-reverts.md
--
--   "New actions are revertible by default."
--   — action-types/action-reverts.md
--
--   "Currently, actions can only be reverted by the user who applied the action."
--   — action-types/action-reverts.md
--
--   "An action on an object cannot be reverted once any subsequent edit has been made to the object, even if the edit is on a different property. In other words, an action on an object can only be reverted if the action is the most recent edit to an object."
--   — action-types/action-reverts.md
--
--   "An action cannot be reverted if action reverts have been toggled off after action submission, even if action reverts have been toggled on again."
--   — action-types/action-reverts.md
--
-- That last sentence is why revertibility is a stored column on the
-- application and not a live read of the action type: re-enabling the
-- toggle must NOT bring back what turning it off destroyed.
--
-- A revert is more log, never less. 422's table comment already carries the
-- reason: "There is no mechanism to directly undo a single user edit" — so
-- a create is compensated by a delete, a modify by a modify back to its
-- before-image, and a delete by a create from it.
--
--   "An action revert only reverts the edits to the object instance, but it will not revert side effects, such as notifications or webhooks, nor will it call them in the same way that the applied action would have."
--   — action-types/action-reverts.md
--
-- so this touches object_edits and nothing else, which is Foundry's own
-- divergence rather than one of ours.
--
-- The identity was missing: apply_action stamped action_type_id but nothing
-- naming ONE submission, so two applications of the same action were
-- indistinguishable and a revert had nothing to name.

ALTER TABLE public.action_types ADD COLUMN allow_revert boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.action_types.allow_revert IS
  'The Form tab''s Allow-revert-after-action-submission toggle (action-types/action-reverts): "New actions are revertible by default." Turning it off also clears revertibility on submissions that already happened, and turning it back on does not restore them.';

CREATE TABLE public.action_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id     uuid NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  applied_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- captured at submission, never re-read from the action type
  revertible         boolean NOT NULL DEFAULT false,
  reverted_at        timestamptz,
  reverted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.action_applications IS
  'One row per action submission — the identity a revert names (action-types/action-reverts). revertible is captured here at submission because toggling the action type''s allow_revert off destroys it for existing applications and toggling back on does not restore it.';
CREATE INDEX action_applications_action_type_idx
  ON public.action_applications (action_type_id);
CREATE INDEX action_applications_applied_by_idx
  ON public.action_applications (applied_by_user_id);

ALTER TABLE public.object_edits ADD COLUMN application_id uuid
  REFERENCES public.action_applications(id) ON DELETE SET NULL;
CREATE INDEX object_edits_application_idx ON public.object_edits (application_id);
COMMENT ON COLUMN public.object_edits.application_id IS
  'Which submission wrote this edit. NULL for edits written outside an action, and for everything before 682.';

ALTER TABLE public.object_edits ADD COLUMN "before" jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.object_edits."before" IS
  'The values these properties held before the edit, captured at apply time so a revert can write them back: empty for a create, the touched properties for a modify, the whole object for a delete. Captured rather than replayed — one column cannot drift from what happened.';

-- Read like the log; only the platform writes.
ALTER TABLE public.action_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see applications of visible actions" ON public.action_applications
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.action_types a WHERE a.id = action_type_id));
GRANT SELECT ON public.action_applications TO authenticated;

-- "even if action reverts have been toggled on again" — off is destructive.
CREATE FUNCTION public.clear_revertible_on_toggle_off()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF OLD.allow_revert AND NOT NEW.allow_revert THEN
    UPDATE public.action_applications
       SET revertible = false
     WHERE action_type_id = NEW.id AND reverted_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clear_revertible_on_toggle_off
  AFTER UPDATE OF allow_revert ON public.action_types
  FOR EACH ROW EXECUTE FUNCTION public.clear_revertible_on_toggle_off();

-- ── the revert ──────────────────────────────────────────────────────────────

CREATE FUNCTION public.revert_action(p_application uuid)
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE app record; e record; written integer := 0;
        v_ot uuid; v_pk text; v_latest bigint; v_mine bigint;
        v_instr text; v_before jsonb; v_action uuid;
BEGIN
  SELECT * INTO app FROM public.action_applications WHERE id = p_application;
  IF app.id IS NULL THEN
    RAISE EXCEPTION 'Actions:ApplicationNotFound — % is not an action application you can see', p_application;
  END IF;
  IF app.applied_by_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actions:NotTheApplier — actions can only be reverted by the user who applied the action';
  END IF;
  IF app.reverted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Actions:AlreadyReverted — this application was reverted at %', app.reverted_at;
  END IF;
  IF NOT app.revertible THEN
    RAISE EXCEPTION 'Actions:NotRevertible — reverts are not enabled for this submission';
  END IF;

  -- "an action on an object can only be reverted if the action is the most
  -- recent edit to an object" — any later edit, on any property, blocks it.
  FOR e IN SELECT DISTINCT oe.object_type_id AS ot, oe.primary_key AS pk
             FROM public.object_edits oe WHERE oe.application_id = p_application
  LOOP
    v_ot := e.ot; v_pk := e.pk;
    SELECT max(oe.seq) INTO v_latest FROM public.object_edits oe
     WHERE oe.object_type_id = v_ot AND oe.primary_key = v_pk;
    SELECT max(oe.seq) INTO v_mine FROM public.object_edits oe
     WHERE oe.application_id = p_application
       AND oe.object_type_id = v_ot AND oe.primary_key = v_pk;
    IF v_latest > v_mine THEN
      RAISE EXCEPTION 'Actions:ObjectEditedSince — "%" has been edited since, so this action is no longer its most recent edit', v_pk;
    END IF;
  END LOOP;

  -- the compensating append, newest edit first so a multi-edit application
  -- unwinds in reverse
  PERFORM set_config('beacon.applying_action', 'on', true);
  v_action := app.action_type_id;
  FOR e IN SELECT oe.object_type_id AS ot, oe.primary_key AS pk,
                  oe.instruction AS instr, oe."before" AS bef
             FROM public.object_edits oe
            WHERE oe.application_id = p_application ORDER BY oe.seq DESC
  LOOP
    v_ot := e.ot; v_pk := e.pk; v_instr := e.instr; v_before := e.bef;
    IF v_instr = 'create' THEN
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction,
                                       properties, action_type_id, application_id)
      VALUES (v_ot, v_pk, 'delete', '{}'::jsonb, v_action, NULL);
    ELSIF v_instr = 'modify' THEN
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction,
                                       properties, action_type_id, application_id)
      VALUES (v_ot, v_pk, 'modify', v_before, v_action, NULL);
    ELSE
      INSERT INTO public.object_edits (object_type_id, primary_key, instruction,
                                       properties, action_type_id, application_id)
      VALUES (v_ot, v_pk, 'create', v_before, v_action, NULL);
    END IF;
    written := written + 1;
  END LOOP;
  PERFORM set_config('beacon.applying_action', '', true);

  UPDATE public.action_applications
     SET reverted_at = clock_timestamp(), reverted_by_user_id = auth.uid()
   WHERE id = p_application;
  RETURN written;
END $$;
COMMENT ON FUNCTION public.revert_action(uuid) IS
  'Reverts one action submission by appending compensating edits — create answered by delete, modify by a modify back to its before-image, delete by a create from it (action-types/action-reverts). Refuses a caller who is not the applier, an application already reverted or not revertible, and any object edited since. Side effects are NOT reverted: the page states that a revert "will not revert side effects, such as notifications or webhooks".';

-- ── apply_action opens an application and captures the before-image ─────────
-- Patched live, every anchor counted (the 669 rule): the three edit writes
-- differ only in their VALUES line, so each anchor carries it.

DO $$
DECLARE
  src text; a text; i int; n int;
  anchors text[] := ARRAY[
    $a$  act      record;$a$,
    $a$    RAISE EXCEPTION 'Actions:ActionTypeNotFound — % is not an action type you can see', p_action_type;
  END IF;$a$,
    $a$      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (target, pk_val, 'create', props - pk_prop, p_action_type);$a$,
    $a$      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (target, pk_val, 'modify', props, p_action_type);$a$,
    $a$      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id)
      VALUES (target, pk_val, 'delete', '{}'::jsonb, p_action_type);$a$
  ];
BEGIN
  src := replace(pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure), chr(13), '');
  FOREACH a IN ARRAY anchors LOOP
    n := 0; i := -1;
    LOOP
      i := position(a IN CASE WHEN i < 0 THEN src ELSE substring(src FROM i + 1) END);
      EXIT WHEN i = 0;
      n := n + 1;
      EXIT WHEN n > 1;
    END LOOP;
    IF n <> 1 THEN
      RAISE EXCEPTION 'anchor must occur exactly once, found %: %', n, left(a, 60);
    END IF;
  END LOOP;

  src := replace(src, anchors[1], $r$  act      record;
  app      uuid;$r$);

  src := replace(src, anchors[2], $r$    RAISE EXCEPTION 'Actions:ActionTypeNotFound — % is not an action type you can see', p_action_type;
  END IF;

  -- one submission, one identity: the revert names this, not the action type
  INSERT INTO public.action_applications (action_type_id, applied_by_user_id, revertible)
  VALUES (p_action_type, auth.uid(), act.allow_revert)
  RETURNING id INTO app;$r$);

  src := replace(src, anchors[3], $r$      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id, application_id, "before")
      VALUES (target, pk_val, 'create', props - pk_prop, p_action_type, app, '{}'::jsonb);$r$);

  src := replace(src, anchors[4], $r$      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id, application_id, "before")
      VALUES (target, pk_val, 'modify', props, p_action_type, app,
              coalesce((SELECT jsonb_object_agg(k, coalesce(s.properties -> k, 'null'::jsonb))
                          FROM jsonb_object_keys(props) k,
                               LATERAL public.object_state(target, pk_val, NULL) s),
                       '{}'::jsonb));$r$);

  src := replace(src, anchors[5], $r$      INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, action_type_id, application_id, "before")
      VALUES (target, pk_val, 'delete', '{}'::jsonb, p_action_type, app,
              coalesce((SELECT s.properties FROM public.object_state(target, pk_val, NULL) s),
                       '{}'::jsonb));$r$);

  EXECUTE src;
END $$;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid; ot uuid; at1 uuid; rule1 uuid;
  p_id uuid; p_note uuid; app uuid; n integer; v jsonb; deleted boolean;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('rev-682') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('rev-682') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rev682a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rev682b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'rev682a@beacon.test', 'admin', org),
      (u2, 'rev682b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'rev_682', 'Reverts 682') RETURNING id INTO proj;
    INSERT INTO public.ontologies (space_id, api_name, label)
    VALUES (sp, 'rev_682', 'Reverts 682') RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, api_name, label, project_id, edits_enabled)
    VALUES (ont, 'Rev682Type', 'Reverts 682 type', proj, true) RETURNING id INTO ot;
    -- the probe writes an edit outside an action on purpose, to prove the
    -- most-recent-edit rule fires for ANY later edit
    UPDATE public.object_types SET only_edits_via_actions = false WHERE id = ot;
    INSERT INTO public.object_type_properties (object_type_id, property_id, api_name, display_name,
                                               base_type, is_primary_key, required, source,
                                               backing_column, position)
    VALUES (ot, 'id', 'id', 'Id', 'string', true, true, 'column', 'id', 0)
    RETURNING id INTO p_id;
    INSERT INTO public.object_type_properties (object_type_id, property_id, api_name, display_name,
                                               base_type, is_primary_key, required, source,
                                               backing_column, position)
    VALUES (ot, 'note', 'note', 'Note', 'string', false, false, 'column', 'note', 1)
    RETURNING id INTO p_note;

    INSERT INTO public.action_types (ontology_id, api_name, label, project_id)
    VALUES (ont, 'rev682-create', 'Create 682', proj) RETURNING id INTO at1;

    -- 1. New action types are revertible by default.
    IF NOT (SELECT a.allow_revert FROM public.action_types a WHERE a.id = at1) THEN
      RAISE EXCEPTION 'a new action type should allow revert by default';
    END IF;

    -- 2. An application is opened per submission and carries the flag.
    INSERT INTO public.action_type_rules (action_type_id, kind, object_type_id, position)
    VALUES (at1, 'create_object', ot, 0) RETURNING id INTO rule1;
    INSERT INTO public.action_type_rule_properties (rule_id, property_id, value_source, static_value)
    VALUES (rule1, p_id, 'static', to_jsonb('obj-682'::text)),
           (rule1, p_note, 'static', to_jsonb('first'::text));
    PERFORM public.apply_action(at1, '{}'::jsonb, NULL);
    SELECT id INTO app FROM public.action_applications
     WHERE action_type_id = at1 ORDER BY applied_at DESC LIMIT 1;
    IF app IS NULL THEN RAISE EXCEPTION 'apply_action opened no application'; END IF;
    IF NOT (SELECT ap.revertible FROM public.action_applications ap WHERE ap.id = app) THEN
      RAISE EXCEPTION 'the application should have captured revertible';
    END IF;
    IF (SELECT count(*) FROM public.object_edits WHERE application_id = app) <> 1 THEN
      RAISE EXCEPTION 'the edit was not stamped with its application';
    END IF;

    -- 3. Reverting a create appends a delete, and the object is gone.
    SELECT public.revert_action(app) INTO n;
    IF n <> 1 THEN RAISE EXCEPTION 'one compensating edit expected, got %', n; END IF;
    SELECT s.deleted INTO deleted FROM public.object_state(ot, 'obj-682', NULL) s;
    IF NOT deleted THEN RAISE EXCEPTION 'the created object should be gone after the revert'; END IF;
    IF (SELECT ap.reverted_at FROM public.action_applications ap WHERE ap.id = app) IS NULL THEN
      RAISE EXCEPTION 'the application was not marked reverted';
    END IF;

    -- 4. A second revert refuses by name.
    BEGIN
      PERFORM public.revert_action(app);
      RAISE EXCEPTION 'an application was reverted twice';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:AlreadyReverted%' THEN RAISE; END IF;
    END;

    -- 5. A modify captures its before-image and reverts to it.
    UPDATE public.action_type_rules SET kind = 'modify_object' WHERE id = rule1;
    DELETE FROM public.action_type_rule_properties WHERE rule_id = rule1 AND property_id = p_id;
    UPDATE public.action_type_rule_properties SET static_value = to_jsonb('second'::text)
     WHERE rule_id = rule1 AND property_id = p_note;
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
    VALUES (ot, 'obj-2', 'create', jsonb_build_object('note', 'original'));
    PERFORM public.apply_action(at1, '{}'::jsonb, 'obj-2');
    SELECT id INTO app FROM public.action_applications
     WHERE action_type_id = at1 ORDER BY applied_at DESC LIMIT 1;
    SELECT oe."before" INTO v FROM public.object_edits oe
     WHERE oe.application_id = app AND oe.instruction = 'modify';
    IF v ->> 'note' IS DISTINCT FROM 'original' THEN
      RAISE EXCEPTION 'the before-image should hold the prior value, got %', v;
    END IF;
    PERFORM public.revert_action(app);
    SELECT s.properties -> 'note' INTO v FROM public.object_state(ot, 'obj-2', NULL) s;
    IF v IS DISTINCT FROM to_jsonb('original'::text) THEN
      RAISE EXCEPTION 'the modify should have been reverted to its before value, got %', v;
    END IF;

    -- 6. A later edit blocks the revert, on any property.
    PERFORM public.apply_action(at1, '{}'::jsonb, 'obj-2');
    SELECT id INTO app FROM public.action_applications
     WHERE action_type_id = at1 ORDER BY applied_at DESC LIMIT 1;
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties)
    VALUES (ot, 'obj-2', 'modify', jsonb_build_object('note', 'someone else'));
    BEGIN
      PERFORM public.revert_action(app);
      RAISE EXCEPTION 'an object edited since was reverted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:ObjectEditedSince%' THEN RAISE; END IF;
    END;

    -- 7. Only the applier may revert.
    PERFORM public.apply_action(at1, '{}'::jsonb, 'obj-2');
    SELECT id INTO app FROM public.action_applications
     WHERE action_type_id = at1 ORDER BY applied_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    BEGIN
      PERFORM public.revert_action(app);
      RAISE EXCEPTION 'someone else reverted the action';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:NotTheApplier%' THEN RAISE; END IF;
    END;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    -- 8. Toggling the flag off destroys revertibility, and back on does not
    --    restore it.
    UPDATE public.action_types SET allow_revert = false WHERE id = at1;
    IF (SELECT ap.revertible FROM public.action_applications ap WHERE ap.id = app) THEN
      RAISE EXCEPTION 'toggling off should have cleared revertible';
    END IF;
    UPDATE public.action_types SET allow_revert = true WHERE id = at1;
    IF (SELECT ap.revertible FROM public.action_applications ap WHERE ap.id = app) THEN
      RAISE EXCEPTION 'toggling back on must not restore revertibility';
    END IF;
    BEGIN
      PERFORM public.revert_action(app);
      RAISE EXCEPTION 'a non-revertible application was reverted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:NotRevertible%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '682 proved: a new action type allows revert, each submission opens an application carrying the flag and stamping its edits, a create reverts to a delete, a second revert refuses, a modify captures and restores its before-image, a later edit on any property blocks the revert, only the applier may revert, and toggling off destroys revertibility that toggling on does not restore';
  END;
END $$;
