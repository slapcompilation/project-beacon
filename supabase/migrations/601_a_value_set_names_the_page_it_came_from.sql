-- 601 — a value set names the page it came from
--
-- CLAUDE.md says every value in every CHECK traces to a page. Nothing has ever
-- verified that, and 599 is what it costs: I renamed a base type on the strength
-- of three pages that describe it, without opening the one that enumerates it,
-- and every guard passed.
--
-- 600 fixed that vocabulary and #730 made `property_base_types` derive from its
-- table rather than a hand-copy. Neither generalises. Foundry states vocabularies
-- in at least three shapes — a table (`properties-overview`), `* **Name:**`
-- bullets (`metadata-statuses`), and `Strategy 1: Name` lines
-- (`action-types/getting-started`) — so one parser cannot read them all.
--
-- SO THIS IS THE WEAKER CHECK THAT DOES GENERALISE: a value set names its page,
-- and every value's word form must appear ON that page. It cannot notice a value
-- the page has and we lack, which parsing the list does. It CAN notice an
-- invented value or a rename the page does not support, which is the failure
-- that actually happened.
--
-- The declaration lives on the constraint because applied migrations are
-- immutable — a `-- @vocabulary` line in the file that created the CHECK could
-- never be added afterwards. `pg_description` can, it sits beside the thing it
-- describes, and 545 already comments a constraint this way.
--
-- Five to start, each verified by hand before being written down. 74 value-set
-- CHECKs exist; the platform suite prints how many are still undeclared, so the
-- number is visible and can only fall. That count is NOT an allowlist — an
-- allowlist says "these are fine, skip them", and this says "these are
-- unchecked". check:readings refuses a NEW migration that adds a value set with
-- no declaration, so the set cannot grow.

BEGIN;

COMMENT ON CONSTRAINT object_types_status_check ON public.object_types IS
  'Values from object-link-types/metadata-statuses. Active, Experimental, Deprecated, Example, and Promoted for object types.';

COMMENT ON CONSTRAINT object_types_visibility_check ON public.object_types IS
  'Values from aip-analyst/using-aip-analyst, which enumerates all three: "Filter discoverable object types by visibility: Prominent, Normal, or Hidden."';

COMMENT ON CONSTRAINT object_type_properties_visibility_check ON public.object_type_properties IS
  'Values from object-link-types/create-shared-property, which names all three for a property: prominent shows it first, hidden keeps it out of user applications, normal is the default.';

COMMENT ON CONSTRAINT link_types_cardinality_check ON public.link_types IS
  'Values from object-link-types/create-link-type. The page hyphenates them — one-to-one, many-to-many — where ours use underscores.';

COMMENT ON CONSTRAINT object_type_datasources_conflict_resolution_check ON public.object_type_datasources IS
  'Values from action-types/getting-started: "Strategy 1: Apply user edits (default)" and "Strategy 2: Apply most recent value".';

-- The assertion reads the comments back and checks the marker parses, because a
-- comment with a typo in the slug would declare a page that does not exist and
-- the platform suite would report it as a missing page rather than a bad
-- declaration.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT con.conname, obj_description(con.oid, 'pg_constraint') AS cm
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public' AND con.contype = 'c'
       AND obj_description(con.oid, 'pg_constraint') LIKE 'Values from %'
  LOOP
    n := n + 1;
    IF substring(r.cm from 'Values from ([a-z0-9./-]+)') IS NULL THEN
      RAISE EXCEPTION 'constraint % declares a page the marker cannot parse: %', r.conname, r.cm;
    END IF;
  END LOOP;
  IF n <> 5 THEN
    RAISE EXCEPTION 'expected five declarations, found %', n;
  END IF;
END $$;

COMMIT;
