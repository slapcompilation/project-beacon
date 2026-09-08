-- One function with a default beats two the client cannot name.
--
-- 771 gave `restricted_view_predicate` its alias as an OVERLOAD — a two-argument
-- form beside the one-argument original — and argued for that shape on the
-- grounds that DROP and CREATE would lose the COMMENT, which would then surface
-- as a silent regression in the generated client.
--
-- The argument defeated itself. `scripts/generate-client.mjs` skips any name
-- with more than one row in `pg_proc` — an entity has one API name — so the
-- overload did not preserve the entity, it DELETED it:
--
--     wrote packages/platform/src/generated.ts — 445 entities, 2 skipped as overloaded
--     // NOT GENERATED — overloaded, and an entity has one API name:
--     //   public.restricted_view_predicate
--
-- The shape that has neither problem is one function whose second parameter
-- carries a DEFAULT. It is unambiguous, because the one-argument form no longer
-- exists to compete with it; every one of the four positional one-argument
-- callers — `object_set_where`, `derived_property_select`, `indexed_objects`,
-- `search_objects` — resolves through the default; and `pg_proc` holds one row,
-- so the client can name it again.
--
-- 771 rejected exactly this shape on advice that a default would make those
-- calls ambiguous. That is true only while BOTH forms exist, which is the
-- overload, not this. Recorded rather than quietly reversed, because the
-- reasoning is the part worth keeping: adding a defaulted overload beside an
-- existing function IS ambiguous; replacing the function with a defaulted one
-- is not.
--
-- ── what 771's header says that is NOT true ────────────────────────────────
--
-- Applied migrations are immutable, so 771's header stands as written and is
-- corrected here instead.
--
-- 1. It says `list_linked_objects` "was already gated". Only its FAR side is —
--    live line 125 calls `object_set_where(far, '[]')`. Its NEAR side is not:
--    it pivots from `p_primary_key` on the subject type without applying that
--    type's own policy, so a caller who may not read the near row still gets
--    the far rows it points at. `count_linked_objects` inherits it. That is a
--    larger hole than the one 771 closed and it is NOT fixed here; it is named
--    so it stops being invisible.
-- 2. Its section titled "this is what Foundry does, not a divergence" overstates
--    what its own body then marks as inference. The honest form: no mirrored
--    page states the rule for a plain link filter; the courses are silent; the
--    case is decided by the nearest stated rule, which is the derived-property
--    guarantee, and by the layer sentence. That is a chain, and a chain is what
--    the reading should carry for a human to read.
-- 3. It says the ACL is "restored". 484 issued no GRANT for this function at
--    all, so 771 did not restore anything — it NARROWED the default PUBLIC
--    EXECUTE to `authenticated` and `service_role`. Kept, deliberately: a
--    predicate builder is not something `anon` needs.
--
-- Two more findings from the same pass, neither fixed here, both real:
--   * `restricted_view_predicate` is invoker-rights and reads
--     `object_type_datasources`, `restricted_views` and `datasets` under RLS, so
--     a caller who cannot see those rows gets NULL — "no policy" — rather than
--     an error. It fails OPEN. Every reader on the path is SECURITY DEFINER, so
--     the effective user is the definer and this cannot bite today; it would the
--     moment an invoker-rights caller reached it.
--   * The object-backed intermediary is gated in `object_set_where` (771) but
--     not in `derived_property_select`'s hop chain, whose `m1..mn` aliases read
--     the same third object type.

DROP FUNCTION public.restricted_view_predicate(uuid);

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.restricted_view_predicate(uuid,text)'::regprocedure), chr(13), '');
  a := 'p_alias text)';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the alias parameter once, found %', n; END IF;
  EXECUTE replace(src, a, 'p_alias text DEFAULT ''o'')');
END $mig$;

COMMENT ON FUNCTION public.restricted_view_predicate(uuid, text) IS
  'The row-level policy of a restricted-view-backed object type, as a SQL predicate bound to the given alias, which defaults to "o". "the restricted view controls what objects users can see". A subject-level caller takes the default; a far hop and a link filter bind something else, and before 771 they reached it by string substitution on the emitted text, which fails silently.';

REVOKE ALL ON FUNCTION public.restricted_view_predicate(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restricted_view_predicate(uuid, text)
  TO authenticated, service_role;

-- ── PROVED BY DOING ────────────────────────────────────────────────────────

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'restricted_view_predicate';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the client can only name a function that has one row in pg_proc, found %', n;
  END IF;

  -- The four positional one-argument callers still resolve, through the default.
  IF public.restricted_view_predicate(gen_random_uuid()) IS NOT NULL THEN
    RAISE EXCEPTION 'an unbacked type has no policy predicate';
  END IF;

  -- and the alias still reaches the emitted SQL when there is one to emit.
  IF EXISTS (SELECT 1 FROM public.object_type_datasources WHERE restricted_view_id IS NOT NULL) THEN
    IF (SELECT public.restricted_view_predicate(d.object_type_id, 'x')
          FROM public.object_type_datasources d
         WHERE d.restricted_view_id IS NOT NULL LIMIT 1) NOT LIKE '% = x.%' THEN
      RAISE EXCEPTION 'the alias did not reach the emitted predicate';
    END IF;
  END IF;
END $$;
