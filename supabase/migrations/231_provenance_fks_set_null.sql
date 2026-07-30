-- Migration 231: provenance columns must not delete the record they annotate.
-- Layer: data (audit integrity)
--
-- Found by running the document pipeline (audit D3): deleting a user cascaded
-- away their document, its chunks and every citation edge. The same defect sits
-- on ~14 other columns — object_types.created_by_user_id cascades into
-- object_records and link_records, so offboarding the operator who authored a
-- type deletes the type and its data.
--
-- The convention is already right in most of the schema (127/132/134/136/147/
-- 151/157/163 all use SET NULL). This applies it to the columns that missed it,
-- derived rather than listed so nothing is left behind. Identity columns
-- (user_profiles.id, *_memberships.user_id) keep CASCADE — there the row IS the
-- user, so deleting it is correct.
--
-- security_invariants.sql C24 asserts this stays true.

BEGIN;

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT c.conname,
           c.conrelid::regclass::text AS tbl,
           a.attname                  AS col
    FROM   pg_constraint c
    JOIN   pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE  c.contype      = 'f'
      AND  c.confrelid    = 'auth.users'::regclass
      AND  c.confdeltype  = 'c'                 -- ON DELETE CASCADE
      AND  array_length(c.conkey, 1) = 1
      AND  a.attname ~ '_by(_user_id)?$'        -- provenance, not identity
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', fk.tbl, fk.col);
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
      fk.tbl, fk.conname, fk.col);
    RAISE NOTICE 'provenance FK relaxed: %.% -> SET NULL', fk.tbl, fk.col;
  END LOOP;
END $$;

COMMIT;
