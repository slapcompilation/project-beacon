-- A `none` over a membership condition is warned about, not refused; and
-- apply_action's comment stops claiming it does not evaluate criteria.
--
-- The page is explicit about both the shape and the mechanism:
--
--   "Avoid using `NOT` conditions with group, marking, or organization
--   memberships. Using a `NOT` condition in these circumstances is a
--   misconfiguration. The platform supports scoped tokens, which carry only a
--   subset of a user's permissions. These tokens may lack the attribute the
--   `NOT` condition checks against, causing the condition to pass and grant
--   more access than intended."
--   — action-types/submission-criteria.md
--
-- Avoid, not refuse — so this is an ontology_warnings() arm and not a CHECK or
-- an ontology_violations() one. "errors need to be handled in order to save,
-- warnings will not prevent you from saving" (ontology-cleanup.md).
--
-- Our `none` IS their `NOT`: a logical operator can "require either all, any,
-- or no conditions underneath it to be met to pass" (same page). The three
-- memberships map onto current_user.group_ids and the two
-- attribute names 602 made evaluable, markings and organization.
--
-- The second half is a stale comment, which is the defect CLAUDE.md names.
-- apply_action's said "Criteria evaluation ... refuse by name rather than
-- half-working" while its body has called submission_criteria_verdict since
-- 421. gen:client copies pg_description verbatim, so the false claim was being
-- published into packages/platform/src/generated.ts and read from there.
-- Nothing in the body moves; only the comment.

CREATE OR REPLACE FUNCTION public.ontology_warnings()
 RETURNS TABLE(object_type text, scope text, subject text, problem text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT t.api_name, 'property', pr.property_id,
         format('The primary key has a discouraged base type. %s',
                public.primary_key_advice(pr.base_type))
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
   WHERE pr.is_primary_key
     AND public.primary_key_eligibility(pr.base_type) = 'discouraged'

  UNION ALL

  -- "you will be warned about any of the following breaking changes" — and
  -- during initial development that warning is all there is.
  SELECT f.api_name, 'function',
         public.function_version_string(v.major, v.minor, v.patch, v.prerelease),
         format('Released with a breaking signature change during initial development: %s',
                array_to_string(v.breaking_changes, '; '))
    FROM public.function_versions v
    JOIN public.functions f ON f.id = v.function_id
   WHERE cardinality(v.breaking_changes) > 0 AND v.major = 0

  UNION ALL

  -- A membership test anywhere beneath a `none`. Depth matters: nesting the
  -- condition one level down does not make the token any less scoped.
  SELECT a.api_name, 'submission_criteria', d.id::text,
         format('A None over %s is a misconfiguration: a scoped token may lack the attribute, so the condition passes and grants more access than intended.',
                CASE WHEN d.user_field = 'group_ids' THEN 'a group membership'
                     ELSE format('the %s attribute', d.attribute_name) END)
    FROM (
      WITH RECURSIVE beneath AS (
        SELECT c.id, c.action_type_id, c.node_type, c.user_field, c.attribute_name, c.template
          FROM public.action_type_submission_criteria c
         WHERE c.node_type = 'logical' AND c.logical_operator = 'none'
        UNION ALL
        SELECT k.id, k.action_type_id, k.node_type, k.user_field, k.attribute_name, k.template
          FROM public.action_type_submission_criteria k
          JOIN beneath b ON k.parent_id = b.id
      )
      SELECT * FROM beneath
    ) d
    JOIN public.action_types a ON a.id = d.action_type_id
   WHERE d.node_type = 'condition' AND d.template = 'current_user'
     AND (d.user_field = 'group_ids'
          OR (d.user_field = 'attribute' AND d.attribute_name IN ('markings', 'organization')))
$function$;

COMMENT ON FUNCTION public.apply_action(uuid, jsonb, text) IS
  'Apply an action: evaluate the submission criteria tree, validate required parameters, run create/modify/delete rules in order, append to the edit log with the action recorded on each edit. The next index build merges the result. The other four rule kinds refuse by name rather than half-working. Invoker — the edit lands through object_edits'' own policy.';

-- The arm has to FIRE, and it has to fire on the nested case, which is the half
-- a direct-children query would have missed. Probed on scratch rows in a
-- subtransaction: a migration's INSERTs commit, and these must not.
DO $$
DECLARE
  v_action uuid;
  v_none   uuid;
  v_inner  uuid;
  v_hits   int;
  v_base   int;
BEGIN
  BEGIN
    SELECT id INTO v_action FROM public.action_types LIMIT 1;
    IF v_action IS NULL THEN
      RAISE NOTICE 'no action type to probe against; arm unproven here';
      RETURN;
    END IF;
    -- measured, not assumed to be zero: a real misconfiguration already in the
    -- table would otherwise fail the probe for the wrong reason.
    SELECT count(*) INTO v_base FROM public.ontology_warnings() WHERE scope = 'submission_criteria';

    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, logical_operator)
    VALUES (v_action, NULL, 9001, 'logical', 'none') RETURNING id INTO v_none;

    -- one level down, so the recursion is what finds it
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, logical_operator)
    VALUES (v_action, v_none, 0, 'logical', 'all') RETURNING id INTO v_inner;

    INSERT INTO public.action_type_submission_criteria
      (action_type_id, parent_id, position, node_type, template, user_field,
       operator, value_source, static_value)
    VALUES (v_action, v_inner, 0, 'condition', 'current_user', 'group_ids',
            'includes', 'static', '"x"'::jsonb);

    SELECT count(*) INTO v_hits FROM public.ontology_warnings()
     WHERE scope = 'submission_criteria';
    IF v_hits <> v_base + 1 THEN
      RAISE EXCEPTION 'nested None over a group membership: expected % warning(s), got %', v_base + 1, v_hits;
    END IF;

    -- and an `all` over the same condition is NOT warned about
    UPDATE public.action_type_submission_criteria SET logical_operator = 'all' WHERE id = v_none;
    SELECT count(*) INTO v_hits FROM public.ontology_warnings()
     WHERE scope = 'submission_criteria';
    IF v_hits <> v_base THEN
      RAISE EXCEPTION 'an All over a group membership was warned about; the arm is too wide';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
  END;
END $$;
