-- The page does state that a filter must match its property.
--
-- 784 shipped an hour ago with a false claim in a live COMMENT, and this
-- corrects it forward because an applied migration cannot be edited.

-- ── what 784 said, and what the page says ─────────────────────────────────
--
-- `filter_kind_applies`'s COMMENT reads, in part: "No page states the mapping —
-- generate-urls lists the kinds and disclaims its own example, and api/
-- publishes no object set filter union". The second half is true. The first
-- half is false, and I wrote it after reading the bullet list on that page and
-- stopping there. Four lines further down:

--   "The type of the value must match the type of widget that shows by default
--    for that property in Object Explorer. For example: `valuesFilter` for a
--    histogram widget; `textFilter` for textbox."
--   — object-explorer/generate-urls.md

-- That is the rule, stated as a MUST, and it says a mismatched filter is not a
-- thing Foundry expects to be handed. So 784's refusal has a documented
-- principle behind it rather than only an inference from Postgres operators —
-- which makes it a better-founded change than its own header claimed.

-- ── what remains inference, precisely ─────────────────────────────────────
--
-- The rule is expressed in terms of *the widget a property shows by default*,
-- and that mapping is NOT enumerated anywhere: the sentence gives two examples,
-- workshop/widgets-filter-list lists widget kinds without binding them to
-- property types, and no page in the corpus pairs the two. So:
--
--   * that a mismatch is refused at all — DOCUMENTED, and now cited;
--   * which kinds fit which base types — still INFERENCE, and still the
--     narrowest available, since `filter_kind_applies` refuses a kind only
--     where the comparison it emits has no operator in Postgres.
--
-- Nothing about the function's BEHAVIOUR changes here. Only what it claims
-- about the corpus, which is the part the next reader will take as fact.

-- ── the lesson, since this is the second time on this page ────────────────
--
-- `generate-urls` already taught this project one lesson — it is the
-- URL-ENCODING page, and reading it instead of the feature page is how our link
-- filter grammar was once believed complete. The lesson recorded then was to
-- read the feature page. The lesson here is narrower and separate: **I read
-- four bullets of a page and treated the section as exhausted.** The sentence
-- that mattered was immediately below them, outside the list.

CREATE OR REPLACE FUNCTION public.filter_kind_applies(p_kind text, p_base_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_kind
    -- Both cast the column to text before comparing, so both apply to anything.
    WHEN 'textFilter'   THEN true
    WHEN 'valuesFilter' THEN true
    WHEN 'numberRangeFilter' THEN
      public.property_column_type(p_base_type)
        IN ('smallint', 'integer', 'bigint', 'real', 'double precision', 'numeric')
    WHEN 'dateRangeFilter'          THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    WHEN 'relativeDateFilter'       THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    WHEN 'timestampRangeFilter'     THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    WHEN 'relativeTimestampFilter'  THEN public.property_column_type(p_base_type) IN ('date', 'timestamptz')
    ELSE true
  END
$$;

COMMENT ON FUNCTION public.filter_kind_applies(text, text) IS
  'Whether a value filter kind can compile against a property of this base type. THAT a mismatch is refused is documented: "The type of the value must match the type of widget that shows by default for that property in Object Explorer" (object-explorer/generate-urls). WHICH kinds fit which base types is not — the rule is written in terms of a property''s default widget and no page pairs widgets with property types — so the pairings below are inference, and the narrowest available: a kind is refused only where the comparison its arm EMITS has no operator in Postgres. The two text filters cast the column and so apply to everything. 784, comment corrected by 785, which found the sentence 784 said did not exist.';

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- Written before the migration was applied. A comment-only change still needs
-- one: the assertion here is that the BEHAVIOUR did not move while the claim
-- about it did.

DO $$
DECLARE n int;
BEGIN
  -- the whole mapping, pinned, so a CREATE OR REPLACE cannot quietly reshape it
  IF public.filter_kind_applies('numberRangeFilter', 'string')
     OR public.filter_kind_applies('numberRangeFilter', 'boolean')
     OR public.filter_kind_applies('dateRangeFilter', 'string')
     OR public.filter_kind_applies('relativeDateFilter', 'double')
     OR public.filter_kind_applies('timestampRangeFilter', 'string')
     OR public.filter_kind_applies('relativeTimestampFilter', 'boolean') THEN
    RAISE EXCEPTION 'a range filter was allowed against a type that cannot order against its literal';
  END IF;

  IF NOT (public.filter_kind_applies('numberRangeFilter', 'integer')
      AND public.filter_kind_applies('numberRangeFilter', 'decimal')
      AND public.filter_kind_applies('numberRangeFilter', 'byte')
      AND public.filter_kind_applies('numberRangeFilter', 'long')
      AND public.filter_kind_applies('numberRangeFilter', 'float')
      AND public.filter_kind_applies('numberRangeFilter', 'short')
      AND public.filter_kind_applies('numberRangeFilter', 'double')) THEN
    RAISE EXCEPTION 'every numeric base type answers a number range filter';
  END IF;

  IF NOT (public.filter_kind_applies('dateRangeFilter', 'date')
      AND public.filter_kind_applies('dateRangeFilter', 'timestamp')
      AND public.filter_kind_applies('relativeDateFilter', 'date')
      AND public.filter_kind_applies('timestampRangeFilter', 'timestamp')
      AND public.filter_kind_applies('relativeTimestampFilter', 'timestamp')) THEN
    RAISE EXCEPTION 'both temporal base types answer all four temporal filters';
  END IF;

  IF NOT (public.filter_kind_applies('textFilter', 'integer')
      AND public.filter_kind_applies('valuesFilter', 'timestamp')
      AND public.filter_kind_applies('textFilter', 'time_series')) THEN
    RAISE EXCEPTION 'the filters that cast the column apply to everything';
  END IF;

  -- and the refusal still arrives by name, not as 42883
  SELECT count(*) INTO n FROM pg_proc
   WHERE proname = 'object_set_property_predicate'
     AND prosrc LIKE '%Ontology:FilterTypeMismatch%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the compile-time gate 784 added is not in the predicate any more';
  END IF;
END $$;
