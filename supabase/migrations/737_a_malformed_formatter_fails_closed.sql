-- 737 — a malformed formatter fails closed.
--
-- 736's validators return NULL rather than false when a required key is simply
-- absent, because `jsonb_typeof(NULL)` is NULL and NULL propagates through an
-- AND chain. The CHECK reads
--
--   (value_formatting IS NULL) OR value_formatting_valid(base_type, value_formatting)
--
-- and `false OR NULL` is NULL, which a CHECK constraint treats as SATISFIED. So
-- every arm of the union fails OPEN on a missing required field:
--
--   {"boolean":{"valueIfTrue":"Yes"}}          -- no valueIfFalse
--   {"date":{}}                                -- no format
--   {"knownType":{}}                           -- no knownType
--   {"number":{}}                              -- no numberType
--
-- each of which 736 intended to refuse and each of which its own probe missed,
-- because the probe asked `IF public.value_formatting_valid(...) THEN RAISE` —
-- and a NULL does not take an IF branch either, so the assertion passed while
-- the value was not false. The suite added alongside 736 asks
-- `expect(...).toBe(false)` and caught it in the same hour.
--
-- This is `dataset_schema_valid`'s lesson, which already carries the comment
-- "IS NOT TRUE, not NOT: a NULL from a malformed field must fail closed", one
-- validator later. The fix is the same shape: every one of the six functions
-- returns `coalesce(<expression>, false)`, so an absent key is a refusal rather
-- than an abstention.
--
-- Nothing is re-validated, because nothing carries a formatter — 736 refused to
-- run unless that was true and it is still true.

CREATE OR REPLACE FUNCTION public.formatting_operand_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
    AND CASE
      WHEN j ? 'constant'     THEN jsonb_typeof(j -> 'constant' -> 'value') = 'string'
      WHEN j ? 'propertyType' THEN jsonb_typeof(j -> 'propertyType' -> 'propertyApiName') = 'string'
      ELSE false
    END, false)
$fn$;

CREATE OR REPLACE FUNCTION public.number_format_options_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'object'
    AND (NOT j ? 'useGrouping'    OR jsonb_typeof(j -> 'useGrouping') = 'boolean')
    AND (NOT j ? 'convertNegativeToParenthesis'
         OR jsonb_typeof(j -> 'convertNegativeToParenthesis') = 'boolean')
    AND (NOT j ? 'minimumIntegerDigits'     OR jsonb_typeof(j -> 'minimumIntegerDigits') = 'number')
    AND (NOT j ? 'minimumFractionDigits'    OR jsonb_typeof(j -> 'minimumFractionDigits') = 'number')
    AND (NOT j ? 'maximumFractionDigits'    OR jsonb_typeof(j -> 'maximumFractionDigits') = 'number')
    AND (NOT j ? 'minimumSignificantDigits' OR jsonb_typeof(j -> 'minimumSignificantDigits') = 'number')
    AND (NOT j ? 'maximumSignificantDigits' OR jsonb_typeof(j -> 'maximumSignificantDigits') = 'number')
    AND (NOT j ? 'notation'
         OR j ->> 'notation' IN ('STANDARD', 'SCIENTIFIC', 'ENGINEERING', 'COMPACT'))
    AND (NOT j ? 'roundingMode'
         OR j ->> 'roundingMode' IN ('CEIL', 'FLOOR', 'ROUND_CLOSEST')), false)
$fn$;

CREATE OR REPLACE FUNCTION public.date_format_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
    AND CASE
      WHEN j ? 'stringFormat' THEN jsonb_typeof(j -> 'stringFormat' -> 'pattern') = 'string'
      WHEN j ? 'localizedFormat' THEN j -> 'localizedFormat' ->> 'format' IN (
             'DATE_FORMAT_RELATIVE_TO_NOW', 'DATE_FORMAT_DATE', 'DATE_FORMAT_YEAR_AND_MONTH',
             'DATE_FORMAT_DATE_TIME', 'DATE_FORMAT_DATE_TIME_SHORT', 'DATE_FORMAT_TIME',
             'DATE_FORMAT_ISO_INSTANT')
      ELSE false
    END, false)
$fn$;

CREATE OR REPLACE FUNCTION public.display_timezone_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
    AND CASE
      WHEN j ? 'user'   THEN jsonb_typeof(j -> 'user') = 'object'
      WHEN j ? 'static' THEN public.formatting_operand_valid(j -> 'static' -> 'zoneId')
      ELSE false
    END, false)
$fn$;

CREATE OR REPLACE FUNCTION public.number_type_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
    AND CASE
      WHEN j ? 'standard' THEN
        public.number_format_options_valid(j -> 'standard' -> 'baseFormatOptions')

      WHEN j ? 'duration' THEN
             j -> 'duration' ->> 'baseValue' IN ('SECONDS', 'MILLISECONDS')
         AND (NOT j -> 'duration' ? 'precision'
              OR j -> 'duration' ->> 'precision' IN ('DAYS','HOURS','MINUTES','SECONDS','AUTO'))
         AND jsonb_typeof(j -> 'duration' -> 'formatStyle') = 'object'
         AND (SELECT count(*) FROM jsonb_object_keys(j -> 'duration' -> 'formatStyle')) = 1
         AND (j -> 'duration' -> 'formatStyle' ? 'timecode'
              OR (j -> 'duration' -> 'formatStyle' ? 'humanReadable'
                  AND (NOT j -> 'duration' -> 'formatStyle' -> 'humanReadable' ? 'showFullUnits'
                       OR jsonb_typeof(j -> 'duration' -> 'formatStyle' -> 'humanReadable' -> 'showFullUnits') = 'boolean')))

      WHEN j ? 'fixedValues' THEN
             jsonb_typeof(j -> 'fixedValues' -> 'values') = 'object'
         AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(j -> 'fixedValues' -> 'values') k
                          WHERE k !~ '^-?[0-9]+$')

      WHEN j ? 'affix' THEN
             public.number_format_options_valid(j -> 'affix' -> 'baseFormatOptions')
         AND jsonb_typeof(j -> 'affix' -> 'affix') = 'object'
         AND (NOT j -> 'affix' -> 'affix' ? 'prefix'
              OR public.formatting_operand_valid(j -> 'affix' -> 'affix' -> 'prefix'))
         AND (NOT j -> 'affix' -> 'affix' ? 'postfix'
              OR public.formatting_operand_valid(j -> 'affix' -> 'affix' -> 'postfix'))

      WHEN j ? 'scale' THEN
             j -> 'scale' ->> 'scaleType' IN ('THOUSANDS', 'MILLIONS', 'BILLIONS')
         AND public.number_format_options_valid(j -> 'scale' -> 'baseFormatOptions')

      WHEN j ? 'currency' THEN
             j -> 'currency' ->> 'style' IN ('STANDARD', 'COMPACT')
         AND public.formatting_operand_valid(j -> 'currency' -> 'currencyCode')
         AND public.number_format_options_valid(j -> 'currency' -> 'baseFormatOptions')

      WHEN j ? 'standardUnit' THEN
             public.formatting_operand_valid(j -> 'standardUnit' -> 'unit')
         AND public.number_format_options_valid(j -> 'standardUnit' -> 'baseFormatOptions')

      WHEN j ? 'customUnit' THEN
             public.formatting_operand_valid(j -> 'customUnit' -> 'unit')
         AND public.number_format_options_valid(j -> 'customUnit' -> 'baseFormatOptions')

      WHEN j ? 'ratio' THEN
             j -> 'ratio' ->> 'ratioType' IN ('PERCENTAGE', 'PER_MILLE', 'BASIS_POINTS')
         AND public.number_format_options_valid(j -> 'ratio' -> 'baseFormatOptions')

      ELSE false
    END, false)
$fn$;

CREATE OR REPLACE FUNCTION public.value_formatting_valid(p_base text, j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
    AND CASE
      WHEN j ? 'date' THEN
        p_base = 'date' AND public.date_format_valid(j -> 'date' -> 'format')

      WHEN j ? 'timestamp' THEN
             p_base = 'timestamp'
         AND public.date_format_valid(j -> 'timestamp' -> 'format')
         AND public.display_timezone_valid(j -> 'timestamp' -> 'displayTimezone')

      WHEN j ? 'number' THEN
             p_base IN ('integer','long','short','double','float','decimal','byte')
         AND public.number_type_valid(j -> 'number' -> 'numberType')

      WHEN j ? 'boolean' THEN
             p_base = 'boolean'
         AND jsonb_typeof(j -> 'boolean' -> 'valueIfTrue')  = 'string'
         AND jsonb_typeof(j -> 'boolean' -> 'valueIfFalse') = 'string'

      WHEN j ? 'knownType' THEN
             p_base = 'string'
         AND j -> 'knownType' ->> 'knownType' IN
               ('USER_OR_GROUP_ID', 'RESOURCE_RID', 'ARTIFACT_GID')

      ELSE false
    END, false)
$fn$;

-- ── PROVED BY DOING — every arm refuses its own missing field ──────────────

DO $$
DECLARE
  bad jsonb;
  base text;
  cases jsonb := jsonb_build_array(
    jsonb_build_array('boolean',   '{"boolean":{"valueIfTrue":"Yes"}}'),
    jsonb_build_array('boolean',   '{"boolean":{}}'),
    jsonb_build_array('date',      '{"date":{}}'),
    jsonb_build_array('date',      '{"date":{"format":{}}}'),
    jsonb_build_array('date',      '{"date":{"format":{"stringFormat":{}}}}'),
    jsonb_build_array('timestamp', '{"timestamp":{"format":{"localizedFormat":{"format":"DATE_FORMAT_TIME"}}}}'),
    jsonb_build_array('timestamp', '{"timestamp":{"format":{"localizedFormat":{"format":"DATE_FORMAT_TIME"}},"displayTimezone":{"static":{}}}}'),
    jsonb_build_array('string',    '{"knownType":{}}'),
    jsonb_build_array('double',    '{"number":{}}'),
    jsonb_build_array('double',    '{"number":{"numberType":{"standard":{}}}}'),
    jsonb_build_array('double',    '{"number":{"numberType":{"currency":{"style":"STANDARD"}}}}'),
    jsonb_build_array('double',    '{"number":{"numberType":{"affix":{"baseFormatOptions":{}}}}}'),
    jsonb_build_array('double',    '{"number":{"numberType":{"fixedValues":{}}}}'),
    jsonb_build_array('double',    '{"number":{"numberType":{"duration":{"formatStyle":{"timecode":{}}}}}}')
  );
  c jsonb;
BEGIN
  FOR c IN SELECT * FROM jsonb_array_elements(cases) LOOP
    base := c ->> 0;
    bad  := (c ->> 1)::jsonb;
    -- IS NOT FALSE, deliberately: before this migration each of these was NULL,
    -- and an assertion written as `IF valid(...) THEN RAISE` would have passed.
    IF public.value_formatting_valid(base, bad) IS NOT FALSE THEN
      RAISE EXCEPTION 'a malformed formatter did not fail closed: % on %',
        bad, base;
    END IF;
  END LOOP;

  -- And the CHECK itself now refuses the row rather than abstaining. A NULL
  -- from the validator satisfies a CHECK, which is how this would have shipped.
  IF NOT ('{"boolean":{"valueIfTrue":"Yes","valueIfFalse":"No"}}'::jsonb IS NOT NULL
          AND public.value_formatting_valid('boolean',
                '{"boolean":{"valueIfTrue":"Yes","valueIfFalse":"No"}}'::jsonb)) THEN
    RAISE EXCEPTION 'a well-formed boolean formatter stopped being accepted';
  END IF;
END $$;
