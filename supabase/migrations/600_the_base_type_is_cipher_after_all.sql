-- 600 — reverting 599: the base type is `cipher` after all
--
-- 599 renamed it to `cipher_text` on the strength of three sources — base-types
-- calls it "Cipher text", property-reducers lists `Cipher Text`, and the api
-- spells the arm `cipherText` — and concluded that prose and api agreed while we
-- were the odd one out.
--
-- I DID NOT CHECK THE PAGE OUR SET IS DERIVED FROM. 408's comment says the base
-- types come "from properties-overview's table. Twenty-two, and the set is
-- closed", and vocabulary.test.ts names the same anchor,
-- `object-link-types/properties-overview#supported-property-types`. That table's
-- first column enumerates exactly twenty-two names:
--
--     Array, Attachment, Boolean, Byte, Cipher, Date, Decimal, Double, Float,
--     Geopoint, Geoshape, Geotemporal Series, Integer, Long, Marking,
--     Media Reference, Short, String, Struct, Time Series, Timestamp, Vector
--
-- Snake-cased, that IS our token set, 22 for 22 — and it says `Cipher`.
--
-- FOUNDRY IS INTERNALLY INCONSISTENT HERE, and that is worth recording rather
-- than resolving by preference: the enumeration says `Cipher`, the page that
-- describes the complex types says "Cipher text", and the api says `cipherText`.
-- The tie-break is not which spelling appears most often. It is that our
-- vocabulary is a 1:1 snake_case of ONE table, so taking a single element's name
-- from a different page leaves the set a mixture of two sources and no longer
-- the thing 408 said it was.
--
-- The same reasoning settles `geotemporal_series`, which 599 left alone for the
-- weaker reason that base-types happened to agree: the table says
-- `Geotemporal Series`, so ours is right because it is the table's, not because
-- two pages out of three concur.
--
-- Nothing held either value — zero properties exist — so this reverts cleanly.

BEGIN;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.object_type_properties WHERE base_type = 'cipher_text';
  IF n <> 0 THEN
    RAISE EXCEPTION '% propert(ies) hold the 599 token; reverting would orphan them', n;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.property_base_types()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ARRAY[
    'string','integer','short','date','timestamp','boolean','byte','long',
    'float','double','decimal','vector','array','struct','media_reference',
    'time_series','geotemporal_series','attachment','geopoint','geoshape',
    'marking','cipher']
$function$;

DO $$
DECLARE types text[];
BEGIN
  SELECT public.property_base_types() INTO types;
  IF 'cipher' <> ALL (types) THEN
    RAISE EXCEPTION 'the revert did not restore cipher';
  END IF;
  IF 'cipher_text' = ANY (types) THEN
    RAISE EXCEPTION '599''s token survived the revert';
  END IF;
  IF array_length(types, 1) <> 22 THEN
    RAISE EXCEPTION 'the set is closed at twenty-two; got %', array_length(types, 1);
  END IF;
END $$;

COMMIT;
