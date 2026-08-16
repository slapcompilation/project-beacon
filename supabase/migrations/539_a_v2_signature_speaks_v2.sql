-- Two of the nine signature tokens were TypeScript v1's.
--
-- `functions/types-reference` is 1,604 lines and had never been opened — the
-- functions reading deferred it by name, and the v2 reading listed it as "named
-- and NOT opened". It prints every type three times, one tab per language, and
-- the two temporal ones do not survive the crossing:
--
--   ### Date
--     TypeScript v1:  import { Function, LocalDate } from "@foundry/functions-api";
--     TypeScript v2:  import { DateISOString } from "@osdk/functions";
--
--   ### Timestamp
--     TypeScript v1:  import { Function, Timestamp } from "@foundry/functions-api";
--     TypeScript v2:  import { TimestampISOString } from "@osdk/functions";
--
-- and the migration page says the same thing in prose:
--
--   "TypeScript v1 uses the `LocalDate` and `Timestamp` types from the
--    `@foundry/functions-api` package for working with temporal data.
--    TypeScript v2 replaces these with the `DateISOString` and
--    `TimestampISOString` types from the `@osdk/functions` package"
--                                    (functions/typescript-v2-migration)
--
-- We built the v2 contract, and `function_type_valid` accepted `LocalDate` and
-- `Timestamp`. A function author writing the v2 code we claim to run would
-- declare a type our validator refuses, and would be accepted for two that do
-- not exist in their language.
--
-- ── WHAT WAS ALREADY RIGHT, CHECKED RATHER THAN ASSUMED ─────────────────────
-- Every other token survives the crossing unchanged: the v2 tabs print
-- `Integer`, `Long`, `Float`, `Double` from `@osdk/functions`, `boolean` and
-- `string` as themselves, and `ObjectSet<T>` from `@osdk/client`. `OntologyEdit[]`
-- is the return type the v2 examples print verbatim — the author declares
-- `type OntologyEdit = Edits.Object<…> | …` and returns an array of it — so it
-- is a v2 spelling, not a v1 leftover.
--
-- No stored signature used either token, so nothing is rewritten. This is the
-- vocabulary closing before something depends on it.
--
-- ── WHAT THIS DELIBERATELY DOES NOT ADD ─────────────────────────────────────
-- The reference publishes far more than we accept: Short, Decimal, Binary,
-- Byte, two marking kinds, Map, Set, Optional, Struct/custom types, Range and
-- the two aggregation shapes, Object, Interface, Interface object set,
-- Attachment, Notification, Media, User, Group, Principal, and the geometry
-- types. Each needs the isolate to marshal it, and adding a token the runtime
-- cannot carry is worse than not having it — the signature would pass and the
-- call would fail. Recorded in DELIVERABLE-MAP as a list, not built here.

CREATE OR REPLACE FUNCTION public.function_type_valid(p_type text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  -- The v2 spellings, one per printed tab in functions/types-reference.
  SELECT p_type IN ('boolean', 'string', 'Integer', 'Long', 'Float', 'Double',
                    'DateISOString', 'TimestampISOString', 'OntologyEdit[]')
      OR p_type ~ '^(boolean|string|Integer|Long|Float|Double|DateISOString|TimestampISOString)\[\]$'
      OR p_type ~ '^ObjectSet<[A-Za-z][A-Za-z0-9]*>$'
$fn$;
COMMENT ON FUNCTION public.function_type_valid(text) IS
  'Whether a token may appear in a published v2 function signature. The spellings are TypeScript v2''s: DateISOString and TimestampISOString, not v1''s LocalDate and Timestamp.';

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
BEGIN
  -- The v2 names are accepted, alone and as arrays.
  IF NOT public.function_type_valid('DateISOString')
     OR NOT public.function_type_valid('TimestampISOString')
     OR NOT public.function_type_valid('DateISOString[]')
     OR NOT public.function_type_valid('TimestampISOString[]') THEN
    RAISE EXCEPTION 'a v2 temporal type was refused';
  END IF;

  -- The v1 names are not. This is the half that changed.
  IF public.function_type_valid('LocalDate') OR public.function_type_valid('Timestamp')
     OR public.function_type_valid('LocalDate[]') THEN
    RAISE EXCEPTION 'a TypeScript v1 temporal type is still accepted in a v2 signature';
  END IF;

  -- And nothing else moved.
  IF NOT public.function_type_valid('Integer')
     OR NOT public.function_type_valid('ObjectSet<Aircraft>')
     OR NOT public.function_type_valid('OntologyEdit[]')
     OR NOT public.function_type_valid('string[]')
     OR public.function_type_valid('Decimal')
     OR public.function_type_valid('ObjectSet<>') THEN
    RAISE EXCEPTION 'the rest of the vocabulary did not survive the change';
  END IF;

  -- No stored signature spoke v1, so none needed rewriting. Asserted rather
  -- than claimed: a surviving row would now fail its own CHECK.
  IF EXISTS (SELECT 1 FROM public.function_versions fv
              WHERE NOT public.function_signature_valid(fv.signature)) THEN
    RAISE EXCEPTION 'a published signature is no longer valid under the v2 vocabulary';
  END IF;

  RAISE NOTICE '539: a v2 signature speaks v2';
END $do$;
