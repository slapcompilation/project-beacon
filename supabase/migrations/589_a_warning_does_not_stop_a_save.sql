-- The linter has had one severity since it existed, and the product has two.
--
--   "The Review edits dialog will also show you warnings in-line and in the
--    Warnings tab for changes you are encouraged to make. While errors need to
--    be handled in order to save, warnings will not prevent you from saving."
--   — ontology-manager/save-changes.md
--
-- Everything `ontology_violations()` returns blocks a save, because
-- `save_working_state` refuses one that introduces a row (426). That is right
-- for every arm it currently has and wrong as a general rule, and it is why
-- there has never been anywhere to put the one warning the product publishes:
--
--   "The primary key has a discouraged base type"
--   — ontology-manager/images/save-review-edits-warning.png
--
-- So warnings become a SECOND LIST rather than a column. `ontology_violations()`
-- keeps meaning "blocks a save" and the three save functions that consult it are
-- untouched; `ontology_warnings()` is advisory and nothing consults it but a
-- reader. That is also how the dialog is built — two tabs, two counts, and the
-- count singularises: `Warning (1)` against `Errors (9)`.

-- ── §1 the arm 587 superseded, and the bug it left behind ─────────────────
-- `ontology_violations_core()` has checked since it was written that the
-- primary key property's backing column exists in every datasource of the type.
-- 587 added the same rule to `datasource_mapping_problems()` — correctly, using
-- the effective key column, which is `primary_key_column` when the datasource
-- names one. The old arm does not know the override exists.
--
-- The result was a feature that could not be used: setting the override
-- satisfied the new check, the old one still reported the property, and because
-- a save is refused when it INTRODUCES a violation, mapping a differently-named
-- key column blocked the save. Verified against the database before this ran.
--
-- The old arm also only joined `datasets`, so a restricted-view datasource was
-- never checked at all. Two reasons the replacement is the one to keep.
CREATE OR REPLACE FUNCTION public.ontology_violations_core()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT t.api_name, p.scope, p.subject, p.problem
    FROM public.object_types t
   CROSS JOIN LATERAL public.object_type_problems(t.id) p

  UNION ALL

  SELECT t.api_name, 'property', pr.property_id,
         format('Backing column "%s" is not in the schema of dataset "%s"',
                pr.backing_column, d.name)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.object_type_datasources ds ON ds.id = pr.datasource_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   WHERE pr.source = 'column'
     AND public.dataset_branch_schema(ds.branch_id) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(public.dataset_branch_schema(ds.branch_id)) f
        WHERE f ->> 'name' = pr.backing_column)

  UNION ALL

  SELECT t.api_name, 'datasource', d.name,
         format('Column "%s" is a %s, which a backing datasource may not contain',
                f ->> 'name', f ->> 'type')
    FROM public.object_type_datasources ds
    JOIN public.object_types t ON t.id = ds.object_type_id
    JOIN public.datasets d ON d.id = ds.dataset_id
   CROSS JOIN LATERAL jsonb_array_elements(
     coalesce(public.dataset_branch_schema(ds.branch_id), '[]'::jsonb)) f
   WHERE f ->> 'type' = 'MAP'

  UNION ALL

  SELECT t.api_name, 'property', pr.property_id,
         format('Inherits from "%s", which is %s, but this property is %s',
                sp.api_name, sp.base_type, pr.base_type)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.shared_properties sp ON sp.id = pr.shared_property_id
   WHERE sp.base_type <> pr.base_type

  UNION ALL

  SELECT t.api_name, 'property', pr.property_id,
         format('Inherits from "%s", which belongs to a different ontology', sp.api_name)
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
    JOIN public.shared_properties sp ON sp.id = pr.shared_property_id
   WHERE sp.ontology_id <> t.ontology_id

  UNION ALL

  SELECT lt.api_name, 'link_type', lt.api_name,
         'Joins object types from a different ontology'
    FROM public.link_types lt
    JOIN public.object_types s ON s.id = lt.source_object_type_id
    JOIN public.object_types g ON g.id = lt.target_object_type_id
   WHERE s.ontology_id <> lt.ontology_id OR g.ontology_id <> lt.ontology_id
$fn$;

-- ── §2 the advisory list ──────────────────────────────────────────────────
-- One arm, and it needs no new rule: `primary_key_eligibility()` has been
-- three-valued since it was written, a CHECK already refuses the `no` tier, and
-- `primary_key_advice()` already carries each discouraged type's published
-- reason. What was missing is a place to ask the question of the whole ontology
-- rather than of the property being edited.
--
-- Only three base types are unreservedly valid as a primary key — String,
-- Integer, Short — and Date, Timestamp, Boolean, Byte and Long are Discouraged,
-- each with a reason (`object-link-types/properties-overview.md`).
CREATE OR REPLACE FUNCTION public.ontology_warnings()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT t.api_name, 'property', pr.property_id,
         format('The primary key has a discouraged base type. %s',
                public.primary_key_advice(pr.base_type))
    FROM public.object_type_properties pr
    JOIN public.object_types t ON t.id = pr.object_type_id
   WHERE pr.is_primary_key
     AND public.primary_key_eligibility(pr.base_type) = 'discouraged'
$fn$;

COMMENT ON FUNCTION public.ontology_warnings() IS
  'Advisory problems: "warnings will not prevent you from saving". Deliberately '
  'NOT consulted by save_working_state, which is what separates this list from '
  'ontology_violations().';

DO $$
DECLARE n int; msg text;
BEGIN
  -- The bug this migration fixes: a datasource naming its own key column was
  -- still reported by the old arm. Probed with claims rather than rows, because
  -- a migration's assertion INSERTs are committed.
  SELECT count(*) INTO n FROM public.ontology_violations()
   WHERE problem LIKE '%must exist in every input datasource%'
     AND scope = 'property';
  IF n > 0 THEN
    RAISE EXCEPTION 'the superseded arm still reports % row(s)', n;
  END IF;

  -- Both lists answer, and a discouraged key carries its reason rather than
  -- just its name.
  PERFORM 1 FROM public.ontology_violations() LIMIT 1;
  PERFORM 1 FROM public.ontology_warnings() LIMIT 1;

  msg := format('The primary key has a discouraged base type. %s',
                public.primary_key_advice('boolean'));
  IF msg NOT LIKE '%two object instances%' THEN
    RAISE EXCEPTION 'the advice did not reach the warning: %', msg;
  END IF;
END $$;
