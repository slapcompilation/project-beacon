-- 799 — our data_kind is not the api's union, and 797 claimed it was
--
-- Comment-only, and caught by the platform suite rather than by me. 797 gave
-- `action_type_parameters_data_kind_check` a declaration beginning `Values from
-- api/ontologies-v2-resources-action-types-get-action-type`, which is a
-- falsifiable claim: every value of a declared set must appear on the page it
-- names. Two of the five do not.
--
-- The api's union lists each primitive as its own member — string, double,
-- integer, long, boolean, timestamp, marking, attachment, mediaReference,
-- array, geoshape, geohash, vector and the rest — beside object, objectType and
-- objectSet. Ours collapses every primitive into a single `base_type` whose
-- actual value lives in the `base_type` column, and carries `interfaceObject`,
-- which that union does not have at all.
--
-- So three of our five ARE the api's spellings and two are ours. A set assembled
-- that way has no single page to name, and naming one anyway is the failure the
-- declaration exists to prevent — it sends the next reader to a page that does
-- not say it, which is the whole point of citing.
--
-- Withdrawn rather than repaired. Repairing would mean renaming `base_type` to
-- the fourteen members it stands for and inventing a home for
-- `interfaceObject`, which is a change to how every action parameter in the
-- schema is shaped, for no gain beyond satisfying a comment I wrote yesterday.
--
-- What stays true, and is said here instead of in a declaration: `objectSet`,
-- `object` and `objectType` are the api's own spellings, taken from that union,
-- and 797's own assertions probe them. `base_type` and `interfaceObject` are
-- ours, and this comment is where a reader learns that rather than inferring it
-- from a citation that would not survive a grep.

BEGIN;

COMMENT ON CONSTRAINT action_type_parameters_data_kind_check ON public.action_type_parameters IS
  'How an action parameter is shaped, which is OURS and not the api''s union. objectSet, object and objectType are that union''s own spellings; base_type collapses its fourteen-odd primitive members into one kind whose value lives in the base_type column, and interfaceObject has no member there at all. Deliberately carries no Values-from declaration: a set assembled from two sources has no single page to name, and 797 named one anyway until the suite caught it.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE cm text; n integer;
BEGIN
  SELECT obj_description(x.oid, 'pg_constraint') INTO cm
    FROM pg_constraint x
   WHERE x.conrelid = 'public.action_type_parameters'::regclass
     AND x.conname = 'action_type_parameters_data_kind_check';

  IF cm ~ 'Values from' THEN
    RAISE EXCEPTION 'the declaration is withdrawn, so the comment must not begin one';
  END IF;
  IF cm NOT LIKE '%objectSet%' THEN
    RAISE EXCEPTION 'the comment must still say which three came from the api';
  END IF;

  -- And the set itself is unchanged: this file moves a claim, not a rule.
  SELECT count(*) INTO n
    FROM pg_constraint x
   WHERE x.conrelid = 'public.action_type_parameters'::regclass
     AND x.conname = 'action_type_parameters_data_kind_check'
     AND pg_get_constraintdef(x.oid) LIKE '%objectSet%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the kind set should be untouched and still hold objectSet';
  END IF;

  RAISE NOTICE '799 proved: the page claim is withdrawn and the value set is unchanged';
END $do$;

COMMIT;
