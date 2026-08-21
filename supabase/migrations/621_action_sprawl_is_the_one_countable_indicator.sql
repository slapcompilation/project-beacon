-- The one published number in three pages nobody had opened.
--
-- Our own readings queue listed `ontology/ontology-anti-patterns` and
-- `ontology-best-practices` as pages to read BEFORE designing rather than
-- after. They were
-- never read, and the ontology was designed across 260-odd migrations without
-- them. Reading them now produces exactly one schema change, because almost
-- everything they ask for is judgement rather than a fact about a row.
--
-- Eight anti-patterns are named — System Silos, The Kitchen Sink, Department
-- Silos, The God Object, The Golden Hammer, Action Sprawl, The Time Machine,
-- The Misnomer — and their Indicators are qualitative with one exception:
--
--   "More than 10 action types for a single object type"
--   — ontology/ontology-anti-patterns.md
--
-- That is countable here, because `action_type_rules.object_type_id` exists.
--
-- WHICH LIST, decided before the arm was written. `ontology_violations()`
-- blocks a save; `ontology_warnings()` does not. The page calls this an
-- INDICATOR of an anti-pattern, which is weaker than either "warned" or
-- "recommended", and the same family of pages says of itself:
--
--   "These principles are guides, not laws."
--   — ontology/ontology-best-practices.md
--
-- so refusing a save over it would be exactly the mistake this repository
-- names as being stricter than Foundry. It is a warning.
--
-- WHAT I DID NOT BUILD, and why it is not modesty. Both naming pages carry a
-- bad-list for generic property names, and neither is an enumeration:
--
--   "Property names are single generic words like `value`, `type`, `status`,
--   `date`, or `name` without qualification"
--   — ontology/ontology-anti-patterns.md
--
-- "like" marks that list as illustrative, and closing an open set is the
-- cipher/cipher_text mistake in a different costume. Recorded as a question in
-- the reading instead.
--
-- CONFIRMED RATHER THAN CHANGED: "mark them as hidden to keep default views of
-- the Ontology clean" is already built AND already reached — `visibility`
-- carries prominent/normal/hidden and eighteen functions read it, among them
-- `search_visible_types`, `search_objects` and `object_set_where`. I checked
-- before assuming a gap, which is the half of this reading that produced no
-- code.

CREATE OR REPLACE FUNCTION public.ontology_warnings()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $function$
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

  UNION ALL

  -- Action Sprawl. Counted over DISTINCT action types, not rules: one action
  -- type may carry several rules against the same object type, and eleven rules
  -- from one action is a cohesive action, which is the shape the page asks for.
  SELECT t.api_name, 'object_type', t.id::text,
         format('%s action types modify this object type. More than ten is an indicator of Action Sprawl: prefer cohesive actions that represent meaningful business operations.', c.n)
    FROM (
      SELECT r.object_type_id, count(DISTINCT r.action_type_id) AS n
        FROM public.action_type_rules r
       WHERE r.object_type_id IS NOT NULL
       GROUP BY r.object_type_id
      HAVING count(DISTINCT r.action_type_id) > 10
    ) c
    JOIN public.object_types t ON t.id = c.object_type_id
$function$;

-- Made to FIRE, then made to fall silent. An arm nobody has seen fire is not a
-- guard (604's lesson), and an arm that fires on everything is worse than none.
-- Eleven action types on one object type, then ten.
DO $$
DECLARE
  v_ont uuid; v_ot uuid; v_at uuid; v_last uuid; v_n int; k int;
BEGIN
  BEGIN
    SELECT o.id INTO v_ont FROM public.ontologies o ORDER BY o.created_at LIMIT 1;
    IF v_ont IS NULL THEN
      RAISE EXCEPTION 'no ontology: 621 cannot prove its own arm';
    END IF;

    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (v_ont, 'Sprawl621', 'Sprawl 621') RETURNING id INTO v_ot;

    -- Ten first: the arm must be SILENT at the boundary the page states,
    -- because "more than 10" is not "10 or more".
    FOR k IN 1..10 LOOP
      INSERT INTO public.action_types (ontology_id, api_name, label)
      VALUES (v_ont, 'probe-621-'||k, 'Probe 621 '||k) RETURNING id INTO v_at;
      INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
      VALUES (v_at, 'delete_object', 0, v_ot);
    END LOOP;

    SELECT count(*) INTO v_n FROM public.ontology_warnings() w
     WHERE w.subject = v_ot::text;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'the arm fired at ten action types; the page says MORE than ten';
    END IF;

    -- The eleventh, which is the first one the page calls sprawl.
    INSERT INTO public.action_types (ontology_id, api_name, label)
    VALUES (v_ont, 'probe-621-11', 'Probe 621 11') RETURNING id INTO v_last;
    INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
    VALUES (v_last, 'delete_object', 0, v_ot);

    SELECT count(*) INTO v_n FROM public.ontology_warnings() w
     WHERE w.subject = v_ot::text AND w.problem LIKE '%Action Sprawl%';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'eleven action types produced % Action Sprawl warning(s), expected 1', v_n;
    END IF;

    -- And it is a WARNING, not a violation: the linter that blocks a save must
    -- stay silent. This is the half that decides which list the arm joined.
    IF EXISTS (SELECT 1 FROM public.ontology_violations() v WHERE v.subject = v_ot::text) THEN
      RAISE EXCEPTION 'Action Sprawl reached ontology_violations(), which blocks saves';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'silent at ten, fired at eleven, and never reached the blocking linter';
  END;
END $$;
