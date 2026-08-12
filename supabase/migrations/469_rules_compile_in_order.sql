-- Rules compile in order, and the unsupported combinations refuse.
--
--   "The order of rules affects the final object edit. As a result, the
--    following combinations of object edits are not supported:
--    * Objects cannot be deleted before they are added or modified.
--    * Objects cannot be modified before they are added.
--    * Objects cannot be created twice in one form submission."
--                                                    (action-types/rules)
--
-- A nightly direction-1 item: the sentences were quotable, nothing enforced
-- them. The bullets are position comparisons per object type within one
-- action: at most one create; a create never after a modify (that would be
-- modified-before-added); a create or modify never after a delete (that
-- would be deleted-before-added-or-modified). create_or_modify_object
-- counts as both halves. Deferred like the other whole-set judgments — the
-- session writer rewrites an action's rules as a set, and the set is what
-- the page constrains.

CREATE OR REPLACE FUNCTION public.assert_rule_order()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE act uuid; bad text;
BEGIN
  act := coalesce(NEW.action_type_id, OLD.action_type_id);
  IF NOT EXISTS (SELECT 1 FROM public.action_types WHERE id = act) THEN
    RETURN NULL;   -- the action fell within the transaction
  END IF;

  WITH r AS (
    SELECT object_type_id, position,
           kind IN ('create_object','create_or_modify_object')  AS creates,
           kind IN ('modify_object','create_or_modify_object')  AS modifies,
           kind = 'delete_object'                               AS deletes
      FROM public.action_type_rules
     WHERE action_type_id = act AND object_type_id IS NOT NULL
  )
  SELECT string_agg(DISTINCT problem, '; ') INTO bad FROM (
    SELECT 'Objects cannot be created twice in one form submission' AS problem
      FROM r WHERE creates GROUP BY object_type_id HAVING count(*) > 1
    UNION ALL
    SELECT 'Objects cannot be modified before they are added'
      FROM r a JOIN r b ON b.object_type_id = a.object_type_id
     WHERE a.modifies AND NOT a.creates AND b.creates AND b.position > a.position
    UNION ALL
    SELECT 'Objects cannot be deleted before they are added or modified'
      FROM r a JOIN r b ON b.object_type_id = a.object_type_id
     WHERE a.deletes AND (b.creates OR b.modifies) AND b.position > a.position
  ) problems;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Actions:UnsupportedRuleCombination — %', bad
      USING HINT = 'The order of rules affects the final object edit.';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER assert_rule_order
  AFTER INSERT OR UPDATE ON public.action_type_rules
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_rule_order();

-- ── assertions, as authenticated ────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; t uuid; act uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('ord-469') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ord469@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ord469@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Ord469');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'ord469', 'Ord 469', false) RETURNING id INTO ont;
  INSERT INTO public.object_types (ontology_id, api_name, label)
  VALUES (ont, 'Ord469T', 'T') RETURNING id INTO t;
  INSERT INTO public.action_types (ontology_id, api_name, label)
  VALUES (ont, 'ord469-act', 'Act') RETURNING id INTO act;

  -- Created twice refuses.
  BEGIN
    INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
    VALUES (act, 'create_object', 0, t), (act, 'create_object', 1, t);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'assertion failed: created twice should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%created twice%' THEN RAISE; END IF;
  END;

  -- Modified before added refuses.
  BEGIN
    INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
    VALUES (act, 'modify_object', 0, t), (act, 'create_object', 1, t);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'assertion failed: modified before added should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%modified before they are added%' THEN RAISE; END IF;
  END;

  -- Deleted before modified refuses.
  BEGIN
    INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
    VALUES (act, 'delete_object', 0, t), (act, 'modify_object', 1, t);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'assertion failed: deleted before modified should refuse';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%deleted before they are added or modified%' THEN RAISE; END IF;
  END;

  -- The supported order stands: create, then modify, then (a different
  -- type's) delete untouched by the same-type rules.
  INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
  VALUES (act, 'create_object', 0, t), (act, 'modify_object', 1, t);
  SET CONSTRAINTS ALL IMMEDIATE;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
