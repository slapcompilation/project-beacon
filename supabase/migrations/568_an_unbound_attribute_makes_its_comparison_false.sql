-- `authorized_group_ids` compiled to an empty array, and an empty array is a
-- subset of everything. So one policy shape granted every row.
--
-- ── THE DEFECT, MEASURED ────────────────────────────────────────────────────
-- 484 and 490 bind each user attribute to a real expression and left this one
-- fail-closed, because Foundry declines to define it:
--
--   "**Authorized group IDs:** This is an advanced concept related to scoped
--    sessions. Contact your Palantir administrator if you plan to use granular
--    policies with scoped sessions."
--                    (platform-security-management/manage-granular-policies)
--
-- Fail-closed was the right intent, and `'{}'::text[]` delivers it for two of
-- the three collection comparisons:
--
--     '{}' && ARRAY['a']   → false     intersects
--     '{}' @> ARRAY['a']   → false     attribute superset_of column
--     '{}' <@ ARRAY['a']   → TRUE      attribute subset_of column
--
-- The empty set is a subset of every set. So a policy written as
-- `authorized_group_ids subset_of <column>` compiles to `('{}'::text[] <@ …)`
-- and is true for **every row**, which is the opposite of what was intended.
-- Verified by compiling that exact comparison through
-- `granular_comparison_sql` before writing this.
--
-- ── THE AUTHORS SAW THE HAZARD AND GUARDED THE DOCUMENTED HALF ─────────────
-- `granular_comparison_check` already refuses NOT outright, and quotes the
-- reason:
--
--   "Avoid using NOT conditions with group, marking, or organization
--    memberships … causing the condition to pass and grant more access than
--    intended."
--
-- Its comment calls that "stricter than the warning, and deliberately so". The
-- same failure — a condition passing because the attribute is missing — arrives
-- through `subset_of` with no NOT anywhere, and nothing was watching that door.
--
-- ── THE FIX IS NOT A BETTER PLACEHOLDER ────────────────────────────────────
-- Any placeholder value leaves the outcome depending on the operator and on
-- which side the attribute sits. An attribute we cannot evaluate should make
-- the predicate over it **unsatisfiable**, whatever surrounds it. So the
-- comparison compiles to `false` and the placeholder disappears.
--
-- `false` composes correctly: `A AND false` is false, `A OR false` is A. A
-- policy that mentions the attribute alone grants nothing; one that offers it
-- as an alternative falls back to its other rules. Both are what fail-closed
-- means.

BEGIN;

CREATE OR REPLACE FUNCTION public.granular_comparison_sql(p_comp jsonb, p_fields jsonb, p_alias text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  cmp text := p_comp->>'comparison';
  l record; r record; ls text; rs text; attr boolean;
BEGIN
  -- An attribute with no binding makes the whole comparison unsatisfiable,
  -- before any operator gets a say. Compiling it to a value — an empty array,
  -- NULL, anything — leaves the answer to set algebra, and `'{}' <@ x` is true
  -- for every x.
  IF p_comp->'left'->>'user_attribute' = 'authorized_group_ids'
     OR p_comp->'right'->>'user_attribute' = 'authorized_group_ids' THEN
    RETURN 'false';
  END IF;

  SELECT * INTO l FROM public.granular_term_sql(p_comp->'left', p_fields, p_alias);
  SELECT * INTO r FROM public.granular_term_sql(p_comp->'right', p_fields, p_alias);
  attr := l.o_kind = 'user_attribute' OR r.o_kind = 'user_attribute';

  IF cmp IN ('equal', 'less_than', 'less_than_or_equal', 'greater_than_or_equal', 'greater_than') THEN
    ls := CASE WHEN attr AND l.o_kind <> 'user_attribute' THEN '(' || l.o_sql || ')::text' ELSE l.o_sql END;
    rs := CASE WHEN attr AND r.o_kind <> 'user_attribute' THEN '(' || r.o_sql || ')::text' ELSE r.o_sql END;
    RETURN format('(%s %s %s)', ls, CASE cmp
      WHEN 'equal' THEN '=' WHEN 'less_than' THEN '<' WHEN 'less_than_or_equal' THEN '<='
      WHEN 'greater_than_or_equal' THEN '>=' ELSE '>' END, rs);
  END IF;

  -- The three collection comparisons: promote a scalar side to a one-element
  -- array, cast non-attribute sides to text[] when an attribute is involved.
  ls := CASE
    WHEN NOT l.o_collection THEN 'ARRAY[(' || l.o_sql || ')::text]'
    WHEN attr AND l.o_kind <> 'user_attribute' THEN '(' || l.o_sql || ')::text[]'
    ELSE l.o_sql END;
  rs := CASE
    WHEN NOT r.o_collection THEN 'ARRAY[(' || r.o_sql || ')::text]'
    WHEN attr AND r.o_kind <> 'user_attribute' THEN '(' || r.o_sql || ')::text[]'
    ELSE r.o_sql END;
  RETURN format('(%s %s %s)', ls, CASE cmp
    WHEN 'intersects' THEN '&&' WHEN 'subset_of' THEN '<@' ELSE '@>' END, rs);
END $fn$;

COMMENT ON FUNCTION public.granular_comparison_sql(jsonb, jsonb, text) IS
  'One comparison as SQL. An unbound user attribute compiles to false rather than to a placeholder value, because a placeholder leaves the outcome to the operator and the empty set is a subset of everything.';

-- ── assertions, which compile the shapes and check the algebra ──────────────
DO $do$
DECLARE fields jsonb := '[{"name":"groups","type":"array"}]'::jsonb; s text; ok boolean;
BEGIN
  -- The shape that granted everything.
  s := public.granular_comparison_sql(
    jsonb_build_object('comparison','subset_of',
      'left',  jsonb_build_object('user_attribute','authorized_group_ids'),
      'right', jsonb_build_object('column','groups')), fields, 't');
  IF s <> 'false' THEN
    RAISE EXCEPTION 'authorized_group_ids subset_of column still compiles to %', s;
  END IF;

  -- And the other side, and the other operators, for the same reason.
  FOR s IN
    SELECT public.granular_comparison_sql(c, fields, 't') FROM (VALUES
      (jsonb_build_object('comparison','subset_of',
        'left',  jsonb_build_object('column','groups'),
        'right', jsonb_build_object('user_attribute','authorized_group_ids'))),
      (jsonb_build_object('comparison','intersects',
        'left',  jsonb_build_object('user_attribute','authorized_group_ids'),
        'right', jsonb_build_object('column','groups'))),
      (jsonb_build_object('comparison','superset_of',
        'left',  jsonb_build_object('user_attribute','authorized_group_ids'),
        'right', jsonb_build_object('column','groups')))
    ) AS v(c)
  LOOP
    IF s <> 'false' THEN
      RAISE EXCEPTION 'an unbound attribute compiled to % rather than false', s;
    END IF;
  END LOOP;

  -- A bound attribute is untouched: this is a fix to one binding, not a
  -- narrowing of the compiler.
  s := public.granular_comparison_sql(
    jsonb_build_object('comparison','intersects',
      'left',  jsonb_build_object('user_attribute','group_ids'),
      'right', jsonb_build_object('column','groups')), fields, 't');
  IF s NOT LIKE '%auth_group_ids%' THEN
    RAISE EXCEPTION 'group_ids stopped binding to the caller: %', s;
  END IF;

  -- The algebra the old placeholder relied on, stated so the next reader sees
  -- why a value could not work.
  IF NOT ('{}'::text[] <@ ARRAY['a']::text[]) THEN
    RAISE EXCEPTION 'the empty set is no longer a subset of everything, which would be news';
  END IF;

  -- And `false` composes: unsatisfiable alone, harmless as an alternative.
  EXECUTE 'SELECT (false AND true), (false OR true)' INTO ok;
  IF ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'AND-composition of false is wrong, which cannot happen';
  END IF;

  RAISE NOTICE '568: an unbound attribute makes its comparison false';
END $do$;

COMMIT;
