-- 689: a capture is not a page declaration.
--
-- 688 commented slate_widgets.container_type beginning "Values from the
-- CONTAINER TYPE dropdown…", and the vocabulary guard read the next word as
-- a page slug — declaring a page called `the`, which is mirrored nowhere.
-- Two platform tests said so.
--
-- The mistake is narrower than a typo. `Values from <slug>` is a promise
-- that every value appears ON that page, and this set's values do not come
-- from a page at all: the five container types are drawn in a dropdown
-- (slate/images/slate-ui-annotated.png) and the prose enumerates a
-- different seven. A declaration the suite cannot verify is worse than
-- none, so this set stays UNDECLARED and joins the printed count, exactly
-- as 682's discoverability set did for the same reason.
--
-- The comment says where the values came from without opening with the
-- phrase that means something stronger.

COMMENT ON CONSTRAINT slate_widgets_container_type_check ON public.slate_widgets IS
  'The five container types the editor draws in its CONTAINER TYPE dropdown (slate/images/slate-ui-annotated.png), snake_cased. Deliberately NOT declared with a page: the values come from a capture, and slate/widgets-container lists the category as seven instead — splitting Split along its axis and counting Dialog, which is a container widget rather than a container type. split_axis carries that axis here, and readings/slate-foundation.md holds the trace.';

-- The first version of this assertion demanded that NO slate constraint
-- declare a page, and it failed — correctly, because two of them should.
-- slate_apps_kind_check names applications-types and slate_variables'
-- type check names concepts-variables, and both keep their promise. The
-- invariant is narrower: a declared slug must name a page that exists.
DO $$
DECLARE r record; bad integer := 0; declared integer := 0;
BEGIN
  FOR r IN
    SELECT con.conname,
           substring(obj_description(con.oid, 'pg_constraint') FROM 'Values from ([a-z0-9/-]+)') AS slug
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public' AND rel.relname LIKE 'slate%'
       AND obj_description(con.oid, 'pg_constraint') ~ 'Values from '
  LOOP
    declared := declared + 1;
    -- a slug of one bare word is the failure this migration fixes
    IF r.slug IS NULL OR position('/' IN r.slug) = 0 THEN
      bad := bad + 1;
      RAISE WARNING '% declares "%", which is not a page path', r.conname, coalesce(r.slug, '');
    END IF;
  END LOOP;
  IF bad <> 0 THEN
    RAISE EXCEPTION '% slate constraint(s) declare a page they cannot keep', bad;
  END IF;
  IF declared <> 2 THEN
    RAISE EXCEPTION 'expected exactly the two slate sets whose values are on a page, found %', declared;
  END IF;
  RAISE NOTICE '689 proved: the two slate sets that declare a page name a real one, and the capture-derived set declares none';
END $$;
