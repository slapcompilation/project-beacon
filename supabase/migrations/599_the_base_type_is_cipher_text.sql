-- 599 — the base type is cipher text, not cipher
--
-- Found by the first proper reading of `api/`. DELIVERABLE-MAP's closing rule
-- says that corpus is "on disk and under-read", and reading
-- `api/ontologies-v2-resources-object-types-get-object-type` field by field
-- against object_types is what turned this up.
--
-- Every source names it with the second word:
--
--     "Cipher text: A type for storing a string value encoded with Cipher."
--     -- object-link-types/base-types.md
--
-- which is the very page 408 cites for the twenty-two, and it is listed as
-- `Cipher Text` in object-link-types/property-reducers.md. The api spells the
-- same arm `cipherText` in its dataType union. Ours has said `cipher` since 408.
--
-- THIS IS NOT THE TWO-VOCABULARIES CASE. That rule applies where the prose and
-- the api describe one thing to a person and to a program — `geotemporal_series`
-- against the api's `geotimeSeriesReference` is exactly that, and stays as it is
-- because base-types.md calls it "Geotemporal series" and we build the Ontology
-- Manager. Here prose and api AGREE with each other and disagree with us, which
-- leaves no vocabulary for `cipher` to belong to.
--
-- Safe to rename: no property uses it. The value is reached only through
-- property_base_types(), the IMMUTABLE function the CHECK calls, so no
-- constraint hardcodes the string.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.object_type_properties WHERE base_type = 'cipher';
  IF n <> 0 THEN
    RAISE EXCEPTION '% propert(ies) use the old token; this renames a value nothing holds', n;
  END IF;
END $$;

-- Patched from pg_get_functiondef: one token changes, the array is otherwise
-- byte-for-byte what 408 wrote.
CREATE OR REPLACE FUNCTION public.property_base_types()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ARRAY[
    'string','integer','short','date','timestamp','boolean','byte','long',
    'float','double','decimal','vector','array','struct','media_reference',
    'time_series','geotemporal_series','attachment','geopoint','geoshape',
    'marking','cipher_text']
$function$;

-- The assertions CALL the function and then exercise the CHECK that reads it,
-- because one that only inspected the catalogue would pass against a body that
-- returned the old array.
DO $$
DECLARE types text[];
BEGIN
  SELECT public.property_base_types() INTO types;
  IF 'cipher_text' <> ALL (types) THEN
    RAISE EXCEPTION 'property_base_types() does not offer cipher_text';
  END IF;
  IF 'cipher' = ANY (types) THEN
    RAISE EXCEPTION 'property_base_types() still offers the old token';
  END IF;
  IF array_length(types, 1) <> 22 THEN
    RAISE EXCEPTION 'the set is closed at twenty-two; got %', array_length(types, 1);
  END IF;
END $$;

COMMIT;
