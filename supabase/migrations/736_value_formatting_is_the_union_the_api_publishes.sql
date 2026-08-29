-- 736 — value formatting is the union the api publishes.
--
-- 673 built `value_formatting` from the two prose pages and never opened
-- `api/`. CLAUDE.md's own rule is that api settles shape questions the prose
-- cannot — unions with their members and the wire encoding of each value — and
-- that it had already falsified our schema four times. This is the fifth.
--
-- The published shape is on
-- `api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md`,
-- read whole:
--
--   "Comprehensive formatting configuration for displaying property values in
--    user interfaces. Supports different value types including numbers, dates,
--    timestamps, booleans, and known Foundry types."
--   — api/ontologies-v2-resources-object-types-get-object-type-full-metadata.md
--
-- FIVE members — `date`, `number`, `timestamp`, `boolean`, `knownType`. 673
-- stored four flat kinds: `numeric`, `datetime`, `user`, `resource_rid`. Term
-- by term, what that cost:
--
--   * `date` and `timestamp` are SEPARATE members with different required
--     fields — `timestamp` requires `displayTimezone`, `date` has none. 673
--     collapsed them into one `datetime` kind with an OPTIONAL timezone, so a
--     date with a timezone was accepted and a timestamp without one was too.
--   * `boolean` formatting did not exist for us at all: "valueIfTrue · string ·
--     required", "valueIfFalse · string · required".
--   * `knownType` is an enum of THREE — `USER_OR_GROUP_ID`, `RESOURCE_RID`,
--     `ARTIFACT_GID`. We had two kinds and the reading recorded Artifact GID as
--     excluded because "artifacts are a product we do not have". That reason
--     does not survive the api LISTING it as a member of the set: an
--     enumeration beats a description, and storing the token is not the same as
--     rendering it.
--   * the date format is itself a union — a custom `stringFormat.pattern` or a
--     `localizedFormat.format` of SEVEN, one more than the prose table's six:
--     `DATE_FORMAT_YEAR_AND_MONTH` appears only here. 673 stored six invented
--     lowercase tokens.
--   * `number` is a union of NINE — `standard`, `duration`, `fixedValues`,
--     `affix`, `scale`, `currency`, `standardUnit`, `customUnit`, `ratio` —
--     each carrying `baseFormatOptions`. 673 had one numeric kind with a
--     four-member `base`. `fixedValues` had been recorded as excluded because
--     it was "named, never specified"; the api specifies it exactly ("Map
--     integer values to custom human-readable strings").
--   * `notation` has FOUR members; ours had three, missing `STANDARD`.
--   * `roundingMode`, `precision`, `baseValue`, `scaleType`, `ratioType`,
--     currency `style`, and the constant-or-property operand union did not
--     exist for us in any form.
--
-- The operand union is the api's own and is reused five times — an affix's
-- prefix and postfix, a currency code, a unit, and a timezone id are each
-- either a `constant.value` or a `propertyType.propertyApiName`. It gets one
-- function rather than five copies.
--
-- INFERENCE, marked as the house rules require: the api does not say which
-- base type admits which member, because the union is published per property
-- rather than per type. The prose does say the pane shows "a type of formatting
-- depending on the base type of the property" (value-formatting.md), so each
-- member is bound to the base type its required fields only make sense for —
-- `date` to date, `timestamp` to timestamp, `boolean` to boolean, `knownType`
-- to string, `number` to the seven numeric base types 673 already listed. If a
-- page ever shows a date formatter on a timestamp property, this is the line to
-- revisit.
--
-- Live exposure: zero. No property row carries a formatter, so nothing is
-- migrated and nothing changes meaning. The assertion below refuses to proceed
-- if that stops being true, because a conversion nobody can test is worse than
-- a refusal.

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.object_type_properties WHERE value_formatting IS NOT NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION '% property/properties carry a formatter in the old shape; convert them before replacing the validator', n;
  END IF;
END $$;

-- ── the operand union, reused five times ────────────────────────────────────

CREATE FUNCTION public.formatting_operand_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT jsonb_typeof(j) = 'object'
     AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
     AND CASE
       WHEN j ? 'constant'     THEN jsonb_typeof(j -> 'constant' -> 'value') = 'string'
       WHEN j ? 'propertyType' THEN jsonb_typeof(j -> 'propertyType' -> 'propertyApiName') = 'string'
       ELSE false
     END
$fn$;

COMMENT ON FUNCTION public.formatting_operand_valid(jsonb) IS
  'The api''s constant-or-property union: an affix prefix/postfix, a currency code, a unit and a timezone id are each a constant.value or a propertyType.propertyApiName. Values from api/ontologies-v2-resources-object-types-get-object-type-full-metadata. 736.';

-- ── the number options every numeric member carries ─────────────────────────

CREATE FUNCTION public.number_format_options_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT jsonb_typeof(j) = 'object'
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
          OR j ->> 'roundingMode' IN ('CEIL', 'FLOOR', 'ROUND_CLOSEST'))
$fn$;

COMMENT ON FUNCTION public.number_format_options_valid(jsonb) IS
  'baseFormatOptions, required by six of the nine numberType members and "Consistent with JavaScript''s Intl.NumberFormat". Values from api/ontologies-v2-resources-object-types-get-object-type-full-metadata. 736.';

-- ── a date or timestamp format: a pattern, or one of seven ──────────────────

CREATE FUNCTION public.date_format_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT jsonb_typeof(j) = 'object'
     AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
     AND CASE
       WHEN j ? 'stringFormat' THEN jsonb_typeof(j -> 'stringFormat' -> 'pattern') = 'string'
       WHEN j ? 'localizedFormat' THEN j -> 'localizedFormat' ->> 'format' IN (
              'DATE_FORMAT_RELATIVE_TO_NOW', 'DATE_FORMAT_DATE', 'DATE_FORMAT_YEAR_AND_MONTH',
              'DATE_FORMAT_DATE_TIME', 'DATE_FORMAT_DATE_TIME_SHORT', 'DATE_FORMAT_TIME',
              'DATE_FORMAT_ISO_INSTANT')
       ELSE false
     END
$fn$;

COMMENT ON FUNCTION public.date_format_valid(jsonb) IS
  'The date/timestamp format union: a strict stringFormat.pattern, or one of the seven localized formats. The prose table lists six; DATE_FORMAT_YEAR_AND_MONTH is published only by the api. Values from api/ontologies-v2-resources-object-types-get-object-type-full-metadata. 736.';

CREATE FUNCTION public.display_timezone_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT jsonb_typeof(j) = 'object'
     AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
     AND CASE
       WHEN j ? 'user'   THEN jsonb_typeof(j -> 'user') = 'object'
       WHEN j ? 'static' THEN public.formatting_operand_valid(j -> 'static' -> 'zoneId')
       ELSE false
     END
$fn$;

COMMENT ON FUNCTION public.display_timezone_valid(jsonb) IS
  'A timestamp''s required displayTimezone: the viewing user''s, or a static zone id given as a constant or read from a property. Values from api/ontologies-v2-resources-object-types-get-object-type-full-metadata. 736.';

-- ── the nine numberType members ─────────────────────────────────────────────

CREATE FUNCTION public.number_type_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT jsonb_typeof(j) = 'object'
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

       -- "Map integer values to custom human-readable strings."
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
     END
$fn$;

COMMENT ON FUNCTION public.number_type_valid(jsonb) IS
  'The nine numberType members: standard, duration, fixedValues, affix, scale, currency, standardUnit, customUnit, ratio. 673 had one numeric kind with a four-member base. Values from api/ontologies-v2-resources-object-types-get-object-type-full-metadata. 736.';

-- ── the union itself ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.value_formatting_valid(p_base text, j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT jsonb_typeof(j) = 'object'
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
     END
$fn$;

COMMENT ON CONSTRAINT object_type_properties_check ON public.object_type_properties IS
  'Values from api/ontologies-v2-resources-object-types-get-object-type-full-metadata — the valueFormatting union''s five members and every enum inside them. Which base type admits which member is inference, scoped in 736''s header.';

-- ── PROVED BY DOING — every member, and the shape it replaced ──────────────

DO $$
DECLARE
  ok boolean;
  n int;
BEGIN
  -- The shapes 673 accepted are gone, which is what makes this a replacement.
  IF public.value_formatting_valid('string', '{"kind":"user"}'::jsonb) THEN
    RAISE EXCEPTION 'the old flat kind is still accepted';
  END IF;
  IF public.value_formatting_valid('timestamp', '{"kind":"datetime","style":"relative"}'::jsonb) THEN
    RAISE EXCEPTION 'the old datetime kind is still accepted';
  END IF;

  -- date: a pattern, and each of the seven localized formats, on `date` only.
  IF NOT public.value_formatting_valid('date',
       '{"date":{"format":{"stringFormat":{"pattern":"yyyy-MM-dd"}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a date pattern was refused';
  END IF;
  SELECT count(*) INTO n FROM unnest(ARRAY[
    'DATE_FORMAT_RELATIVE_TO_NOW','DATE_FORMAT_DATE','DATE_FORMAT_YEAR_AND_MONTH',
    'DATE_FORMAT_DATE_TIME','DATE_FORMAT_DATE_TIME_SHORT','DATE_FORMAT_TIME',
    'DATE_FORMAT_ISO_INSTANT']) f
   WHERE public.value_formatting_valid('date',
     jsonb_build_object('date', jsonb_build_object('format',
       jsonb_build_object('localizedFormat', jsonb_build_object('format', f)))));
  IF n <> 7 THEN RAISE EXCEPTION 'only % of the seven localized formats were accepted', n; END IF;
  IF public.value_formatting_valid('timestamp',
       '{"date":{"format":{"localizedFormat":{"format":"DATE_FORMAT_DATE"}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a date formatter was accepted on a timestamp';
  END IF;

  -- timestamp: displayTimezone is REQUIRED, which is the whole reason the api
  -- keeps date and timestamp apart.
  IF public.value_formatting_valid('timestamp',
       '{"timestamp":{"format":{"localizedFormat":{"format":"DATE_FORMAT_TIME"}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a timestamp without a display timezone was accepted';
  END IF;
  IF NOT public.value_formatting_valid('timestamp',
       '{"timestamp":{"format":{"localizedFormat":{"format":"DATE_FORMAT_TIME"}},
                      "displayTimezone":{"user":{}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a user timezone was refused';
  END IF;
  IF NOT public.value_formatting_valid('timestamp',
       '{"timestamp":{"format":{"stringFormat":{"pattern":"HH:mm"}},
                      "displayTimezone":{"static":{"zoneId":{"constant":{"value":"Europe/Athens"}}}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a static timezone was refused';
  END IF;

  -- number: all nine members.
  SELECT count(*) INTO n FROM unnest(ARRAY[
    '{"standard":{"baseFormatOptions":{"useGrouping":true,"notation":"STANDARD"}}}',
    '{"duration":{"formatStyle":{"humanReadable":{"showFullUnits":true}},"baseValue":"SECONDS","precision":"AUTO"}}',
    '{"fixedValues":{"values":{"1":"First","2":"Second"}}}',
    '{"affix":{"baseFormatOptions":{},"affix":{"prefix":{"constant":{"value":"USD "}},"postfix":{"propertyType":{"propertyApiName":"unitName"}}}}}',
    '{"scale":{"scaleType":"MILLIONS","baseFormatOptions":{}}}',
    '{"currency":{"style":"COMPACT","currencyCode":{"constant":{"value":"USD"}},"baseFormatOptions":{}}}',
    '{"standardUnit":{"unit":{"constant":{"value":"celsius"}},"baseFormatOptions":{}}}',
    '{"customUnit":{"unit":{"constant":{"value":"widgets"}},"baseFormatOptions":{}}}',
    '{"ratio":{"ratioType":"BASIS_POINTS","baseFormatOptions":{"roundingMode":"CEIL"}}}'
  ]) m
   WHERE public.value_formatting_valid('double',
     jsonb_build_object('number', jsonb_build_object('numberType', m::jsonb)));
  IF n <> 9 THEN RAISE EXCEPTION 'only % of the nine numberType members were accepted', n; END IF;

  -- and the members it refuses, each for its own reason
  IF public.value_formatting_valid('double',
       '{"number":{"numberType":{"scale":{"scaleType":"TRILLIONS","baseFormatOptions":{}}}}}'::jsonb) THEN
    RAISE EXCEPTION 'an unpublished scale type was accepted';
  END IF;
  IF public.value_formatting_valid('double',
       '{"number":{"numberType":{"fixedValues":{"values":{"first":"One"}}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a non-integer fixed-values key was accepted';
  END IF;
  IF public.value_formatting_valid('string',
       '{"number":{"numberType":{"standard":{"baseFormatOptions":{}}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a number formatter was accepted on a string';
  END IF;
  IF public.value_formatting_valid('double',
       '{"number":{"numberType":{"standard":{"baseFormatOptions":{"notation":"COMPACT"}},
                                 "ratio":{"ratioType":"PERCENTAGE","baseFormatOptions":{}}}}}'::jsonb) THEN
    RAISE EXCEPTION 'a two-member union body was accepted';
  END IF;

  -- boolean: the member 673 had no form for at all.
  IF NOT public.value_formatting_valid('boolean',
       '{"boolean":{"valueIfTrue":"Yes","valueIfFalse":"No"}}'::jsonb) THEN
    RAISE EXCEPTION 'a boolean formatter was refused';
  END IF;
  IF public.value_formatting_valid('boolean', '{"boolean":{"valueIfTrue":"Yes"}}'::jsonb) THEN
    RAISE EXCEPTION 'a boolean formatter missing valueIfFalse was accepted';
  END IF;

  -- knownType: all three, Artifact GID included.
  SELECT count(*) INTO n FROM unnest(ARRAY['USER_OR_GROUP_ID','RESOURCE_RID','ARTIFACT_GID']) k
   WHERE public.value_formatting_valid('string',
     jsonb_build_object('knownType', jsonb_build_object('knownType', k)));
  IF n <> 3 THEN RAISE EXCEPTION 'only % of the three known types were accepted', n; END IF;

  -- and the CHECK carries all of it, on a real row.
  SELECT public.value_formatting_valid('double',
    '{"number":{"numberType":{"currency":{"style":"STANDARD","currencyCode":{"constant":{"value":"EUR"}},"baseFormatOptions":{"maximumFractionDigits":2}}}}}'::jsonb) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'the worked currency example was refused'; END IF;
END $$;
