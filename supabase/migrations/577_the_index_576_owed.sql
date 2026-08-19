-- `catalog.test.ts` caught it the first time it ran after 576: the new
-- self-referencing FK on `object_type_properties.derived_from_property_id` has
-- no index on its leading column, so `ON DELETE RESTRICT` would scan the whole
-- table to answer whether a property is read by any derived one.
--
-- The hop table's two FKs were indexed in 576; this one was on the property
-- table and got missed. Same class as 556 and 564 — the guard is doing its job,
-- and the fix is one line.

BEGIN;

CREATE INDEX object_type_properties_derived_from
  ON public.object_type_properties (derived_from_property_id);

DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM pg_constraint c
   WHERE c.contype = 'f'
     AND c.conrelid = 'public.object_type_properties'::regclass
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);
  IF n <> 0 THEN
    RAISE EXCEPTION '% foreign key(s) on object_type_properties still lack a leading-column index', n;
  END IF;
  RAISE NOTICE '577: the index 576 owed';
END $do$;

COMMIT;
