-- A link filter may not reveal a far object you cannot see.
--
-- `object_set_where` ends with a comment that states a property:
--
--     -- The policy gate, when this type is restricted-view-backed. Every reader
--     -- shares this WHERE, so the gate cannot be forgotten by a new one.
--
-- The three link arms forgot it. Each builds
-- `EXISTS (SELECT 1 FROM objects.<far index> x ... WHERE x.<key> = o.<key>)`
-- and applies no policy to `x`, so a near object matches a link filter because
-- of a far object the caller may not read. The near row is returned; the far
-- row never is. That is an inference leak: presence in the result set is the
-- disclosure.
--
-- ── it is latent, and that is why it is worth fixing now ───────────────────
--
-- No object type in this database is restricted-view-backed today
-- (`SELECT count(*) FROM object_type_datasources WHERE restricted_view_id IS
-- NOT NULL` is 0), so nothing leaks yet. It leaks the first time anyone backs
-- a type with a restricted view — which is a supported, documented thing to do
-- and which `restrictedViews.test.ts` already exercises. A guard that is
-- correct only while a feature is unused is not a guard.
--
-- ── this is what Foundry does, not a divergence ────────────────────────────
--
-- No mirrored page states the rule in the vocabulary of a link filter; I looked
-- and say so. What the pages do state is the layer, and the adjacent case, and
-- both point one way.
--
-- The layer:

--   "**Object security policies:** Row-level filtering for ontology object
--    instances, evaluated at the object set layer."
--   — security/access-control-propagation.md

-- A traversal IS an object set — `searchAround` and `interfaceLinkSearchAround`
-- are members of the `ObjectSet` union — so what a traversal produces is
-- filtered where every object set is filtered.
--
-- The adjacent case is stated outright, twice, and it is a link walk:

--   "Derived properties are then available for further operations, such as
--    filtering, sorting, or aggregating within the same request. Derived
--    properties use the security of all objects involved in the calculation,
--    so they do not expose information a user would otherwise be unable to
--    see."
--   — ontology/derived-properties.md

--   "These properties use the security context of all objects involved in the
--    calculation, ensuring users only see information for which they have
--    access authorization."
--   — object-link-types/derived-properties.md

-- and the security-policy tester corroborates it by refusing to simulate it:

--   "You cannot test derived property visibility, as this also relies on the
--    user's visibility on the derived property's source object."
--   — object-permissioning/object-security-policies.md

-- Marked as INFERENCE, because none of those sentences says "link filter":
-- joining the object-set layer to the derived-property guarantee is a chain of
-- quoted facts, not a sentence. The direction is not in doubt — no page
-- anywhere suggests a read may count an object the caller cannot see — and a
-- filtered-out row is silent rather than an error, which the api confirms by
-- having no error for it and by masking access as absence:

--   "The requested linked object could not be found, or the client token does
--    not have access to it."
--   — api/general-overview-errors.md

-- ── our own code already agreed ────────────────────────────────────────────
--
-- `derived_property_select` (757/767) has gated the far side since it was
-- written: it calls `restricted_view_predicate(far_id)` per hop and rebinds the
-- alias. So this migration does not decide a new question — it makes the link
-- arms do what the derived-property evaluator already does, which is what the
-- derived-property pages require. `list_linked_objects` was already gated too,
-- indirectly: it calls `object_set_where(far, '[]')`, whose subject-level gate
-- is the far type's. Only the link arms were missed.
--
-- ── the alias, and the string substitution it retires ──────────────────────
--
-- `restricted_view_predicate` hardcoded `o.` in its emitted SQL, so
-- `derived_property_select` reached its per-hop alias with
-- `replace(pred, '= o.', format('= %s.', hop_alias))` — a substitution that
-- silently no-ops if the emitted text ever changes shape, on a SECURITY gate.
-- The function now takes the alias, as an OVERLOAD rather than a replacement:
-- four callers pass one argument, and a two-argument version whose second
-- argument defaulted would make every one of those calls ambiguous. The
-- one-argument form stays, delegates, and keeps its COMMENT and its grant,
-- which DROP and CREATE would have lost.
--
-- ── and the intermediary, which is a third object type ─────────────────────
--
-- The object-backed arm reads TWO indexes it does not gate, not one. Besides
-- the far type `x` there is `m`, the intermediary object type's index — a type
-- the caller never named and whose rows are objects like any other. An earlier
-- draft of this migration gated only `x`; the arm gates both.
--
-- `MUST_NOT_HAVE` is worth stating plainly as the sharper half of the risk:
-- with the gate missing, negating the filter turns the leak from "this row is
-- hidden from you" into a positive oracle for far rows you cannot read.
--
-- If another subject-level gate is ever added beside the restricted view, it
-- must be taught here AND in `derived_property_select`. The comment quoted at
-- the top is now true of the arms; it is still not true of gates that do not
-- exist yet.

-- ── 1. the predicate binds to an alias ─────────────────────────────────────
--
-- An overload, and deliberately WITHOUT a default on the new parameter. A
-- two-argument version whose second argument defaults would make every
-- surviving one-argument call ambiguous — "function is not unique" — and
-- there are four of those, in object_set_where, derived_property_select,
-- indexed_objects and search_objects. So the one-argument function stays and
-- delegates, which is also what keeps its COMMENT and its EXECUTE grant:
-- CREATE OR REPLACE preserves both, where DROP and CREATE would lose them
-- (763's lesson) and the lost COMMENT would surface as a silent regression in
-- the generated client.

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  -- Patched from the live definition, not retyped. Its body carries CRLF from
  -- 484's file while postgres's generated header does not, so the CR strip is
  -- not optional here.
  src := replace(pg_get_functiondef('public.restricted_view_predicate(uuid)'::regprocedure), chr(13), '');

  a := 'CREATE OR REPLACE FUNCTION public.restricted_view_predicate(p_object_type uuid)';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the one-argument signature once, found %', n; END IF;
  src := replace(src, a, 'CREATE OR REPLACE FUNCTION public.restricted_view_predicate(p_object_type uuid, p_alias text)');

  -- the one place the alias is emitted
  a := 'WHERE d.%I::text = o.%I::text';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the emitted alias once, found %', n; END IF;
  src := replace(src, a, 'WHERE d.%I::text = %I.%I::text');

  -- and the argument that fills it
  a := 'b.physical_table, b.pk_col, b.pk_prop, b.master_branch,';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the format argument list once, found %', n; END IF;
  src := replace(src, a, 'b.physical_table, b.pk_col, p_alias, b.pk_prop, b.master_branch,');

  EXECUTE src;
END $mig$;

COMMENT ON FUNCTION public.restricted_view_predicate(uuid, text) IS
  'The row-level policy of a restricted-view-backed object type, as a SQL predicate bound to the given alias. "the restricted view controls what objects users can see". The one-argument form binds "o" and is what every subject-level caller uses; a far hop and a link filter bind something else, and before 771 they reached it by string substitution on the emitted text, which fails silently.';

REVOKE ALL ON FUNCTION public.restricted_view_predicate(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restricted_view_predicate(uuid, text)
  TO authenticated, service_role;

-- The one-argument form keeps its name, its COMMENT and its grant, and now
-- says once what "o" means.
CREATE OR REPLACE FUNCTION public.restricted_view_predicate(p_object_type uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$ SELECT public.restricted_view_predicate(p_object_type, 'o') $$;

-- ── 2. the hop chain asks for its alias instead of patching the text ───────

DO $mig$
DECLARE src text; anchor text;
BEGIN
  src := replace(pg_get_functiondef('public.derived_property_select(uuid,text)'::regprocedure), chr(13), '');
  anchor := 'conds := conds || '' AND '' || replace(pred, ''= o.'', format(''= %s.'', hop_alias));';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected the hop-alias substitution exactly once, found %',
      (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  END IF;
  src := replace(src, anchor, 'conds := conds || '' AND '' || pred;');
  -- and the call above it now asks for the alias directly
  anchor := 'pred := public.restricted_view_predicate(far_id);';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'expected the far-side predicate call exactly once';
  END IF;
  EXECUTE replace(src, anchor, 'pred := public.restricted_view_predicate(far_id, hop_alias);');
END $mig$;

-- ── 3. the three link arms gate the far index they join ───────────────────

DO $mig$
DECLARE src text; a8 text; a6 text; b8 text; b6 text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.object_set_where(uuid,jsonb)'::regprocedure), chr(13), '');

  -- two locals for the gate
  src := regexp_replace(src, 'DECLARE', 'DECLARE far_t uuid; far_gate text;', 1, 1);

  -- The matchType line occurs three times at TWO indentations — eight spaces in
  -- the join_table (751) and object_backed (765) arms, six in the foreign-key
  -- arm (523, which also carries doubled newlines). Anchoring on the preceding
  -- NEWLINE is what keeps the six-space form from also matching inside the
  -- eight-space lines, where it would otherwise be a substring.
  a8 := chr(10) || '        IF v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;';
  a6 := chr(10) || '      IF v->>''matchType'' = ''MUST_NOT_HAVE'' THEN cond := ''NOT '' || cond; END IF;';

  n := (length(src) - length(replace(src, a8, ''))) / length(a8);
  IF n <> 2 THEN RAISE EXCEPTION 'expected the eight-space matchType line twice, found %', n; END IF;
  n := (length(src) - length(replace(src, a6, ''))) / length(a6);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the six-space matchType line once, found %', n; END IF;

  -- The far type is the end that is not the subject — the expression the
  -- foreign-key arm already uses to find the index it joins. Inserted BEFORE
  -- each anchor, which survives in the replacement.
  b8 := chr(10) || '        far_t := CASE WHEN lk.source_object_type_id = p_object_type'
     || chr(10) || '                      THEN lk.target_object_type_id ELSE lk.source_object_type_id END;'
     || chr(10) || '        far_gate := public.restricted_view_predicate(far_t, ''x'');'
     || chr(10) || '        IF far_gate IS NOT NULL THEN'
     || chr(10) || '          -- Inside the EXISTS, not after it: the gate is the far row''s.'
     || chr(10) || '          cond := left(cond, length(cond) - 1) || '' AND '' || far_gate || '')'';'
     || chr(10) || '        END IF;'
     || chr(10) || '        -- An object-backed walk reads a THIRD type the caller never named:'
     || chr(10) || '        -- the intermediary, aliased m. Its rows are objects too.'
     || chr(10) || '        IF lk.backing_kind = ''object_backed'' THEN'
     || chr(10) || '          far_gate := public.restricted_view_predicate(lk.backing_object_type_id, ''m'');'
     || chr(10) || '          IF far_gate IS NOT NULL THEN'
     || chr(10) || '            cond := left(cond, length(cond) - 1) || '' AND '' || far_gate || '')'';'
     || chr(10) || '          END IF;'
     || chr(10) || '        END IF;';
  -- Built out, not derived from b8: a cascading replace would pull the nested
  -- lines down two levels instead of one, and indentation is exactly what the
  -- next splice will anchor on (766).
  b6 := replace(b8, chr(10) || '        ', chr(10) || '      ');

  src := replace(src, a8, b8 || a8);
  -- The block just written carries no matchType line, so the shallow anchor is
  -- still alone; assert that rather than trust it.
  n := (length(src) - length(replace(src, a6, ''))) / length(a6);
  IF n <> 1 THEN RAISE EXCEPTION 'the deep splice disturbed the six-space anchor, found %', n; END IF;
  src := replace(src, a6, b6 || a6);

  EXECUTE src;
END $mig$;

COMMENT ON FUNCTION public.object_set_where(uuid, jsonb) IS
  'The WHERE every object-set reader shares. Property filters bind to the subject alias "o"; a link filter compiles to an EXISTS over the far index aliased "x", and since 771 that EXISTS carries the FAR type''s own row-level policy — "Row-level filtering for ontology object instances, evaluated at the object set layer", and a traversal is an object set. Without it the near object''s presence in the result disclosed a far object the caller may not read.';

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- The proof that matters runs as `authenticated` and lives in the suite, where
-- a fixture can build a restricted view over a real dataset. What lands here is
-- the property that makes it possible: the predicate binds where it is told,
-- and the arms carry it.

DO $$
DECLARE p_o text; p_x text; src text; n int;
BEGIN
  -- The alias reaches the emitted SQL, and nothing else moved.
  SELECT public.restricted_view_predicate(d.object_type_id, 'o'),
         public.restricted_view_predicate(d.object_type_id, 'x')
    INTO p_o, p_x
    FROM public.object_type_datasources d
   WHERE d.restricted_view_id IS NOT NULL
   LIMIT 1;

  IF p_o IS NULL THEN
    -- No restricted-view-backed type exists in this database, which is the
    -- state recorded in the header. Assert the shape instead of the value.
    IF public.restricted_view_predicate(gen_random_uuid(), 'x') IS NOT NULL THEN
      RAISE EXCEPTION 'an unbacked type has no policy predicate';
    END IF;
  ELSE
    IF p_x = p_o OR p_x NOT LIKE '% = x.%' THEN
      RAISE EXCEPTION 'the alias did not reach the emitted predicate';
    END IF;
  END IF;

  -- All three arms now compute the gate, and the deep/shallow splice landed
  -- once each. Three occurrences, because there are three backings.
  src := replace(pg_get_functiondef('public.object_set_where(uuid,jsonb)'::regprocedure), chr(13), '');
  n := (length(src) - length(replace(src, 'far_gate := public.restricted_view_predicate(far_t, ''x'');', '')))
       / length('far_gate := public.restricted_view_predicate(far_t, ''x'');');
  IF n <> 3 THEN
    RAISE EXCEPTION 'each of the three link arms should gate its far index, found %', n;
  END IF;
  n := (length(src) - length(replace(src, 'restricted_view_predicate(lk.backing_object_type_id, ''m'')', '')))
       / length('restricted_view_predicate(lk.backing_object_type_id, ''m'')');
  IF n <> 3 THEN
    RAISE EXCEPTION 'the intermediary index should be gated wherever the arm can be object-backed, found %', n;
  END IF;

  -- And the substitution the hop chain used is gone.
  src := replace(pg_get_functiondef('public.derived_property_select(uuid,text)'::regprocedure), chr(13), '');
  IF src LIKE '%replace(pred%' THEN
    RAISE EXCEPTION 'the hop chain should ask for its alias, not patch the text';
  END IF;
  IF src NOT LIKE '%restricted_view_predicate(far_id, hop_alias)%' THEN
    RAISE EXCEPTION 'the hop chain should pass its alias';
  END IF;
END $$;
