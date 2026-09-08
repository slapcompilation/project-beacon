-- Every index a reader joins carries its own type's policy.
--
-- 771 closed the far side of a link FILTER. The same pass measured three more
-- reads of the same kind and named them in `link-reading.md`'s Questions rather
-- than fixing them. This fixes them, which is the whole of that class:
--
--   Q2  `list_linked_objects` pivots from `p_primary_key` on the SUBJECT type
--       without applying that type's policy, so a caller who may not read the
--       near row still gets the far rows it points at. `count_linked_objects`
--       inherits it — it counts by iterating the lister, deliberately, so "the
--       panel's badge cannot disagree with its rows".
--   Q4  `derived_property_select`'s object-backed hop joins the intermediary
--       store as `m<step>` and gates only the far hop alias.
--   and the same intermediary read in `list_linked_objects`.
--
-- ── the near side is not the same question as the far side ─────────────────
--
-- 771's far-side gate rested on a chain of quoted facts and is marked as
-- inference. This one does not need that chain. The subject type's own policy
-- is what EVERY other reader already applies —
-- `object_set_where` ends with it, and `count_object_set`, `evaluate_object_set`,
-- `aggregate_object_set` and `histogram_object_set` all reach it that way. The
-- lister is the one reader that pivots from a named object and never asks
-- whether the caller may read it. So this is an internal inconsistency, not a
-- doctrinal decision:

--   "Row-level filtering for ontology object instances, evaluated at the object
--    set layer."
--   — security/access-control-propagation.md

-- ── absence, not an error ──────────────────────────────────────────────────
--
-- When the near object is not readable the lister returns no rows rather than
-- raising. That is the api's own choice for exactly this case — access is
-- masked as absence, in one sentence that covers both:

--   "The requested linked object could not be found, or the client token does
--    not have access to it."
--   — api/general-overview-errors.md

-- An error would itself be the disclosure: it would confirm the near object
-- exists. The ontology-membership check above this one (`auth_in_ontology`)
-- still raises, because an object type you cannot see is a different claim from
-- a row you cannot read.
--
-- ── the intermediary, again ────────────────────────────────────────────────
--
-- An object-backed walk reads a THIRD object type the caller never named. 771
-- gated it in `object_set_where`; the lister and the derived-property hop chain
-- read the same store and did not. All three now do.
--
-- Left open from the same pass, unchanged and still recorded in the reading:
-- `restricted_view_predicate` is invoker-rights and fails OPEN for a caller who
-- cannot see its catalog rows (Q3, unreachable today because every reader on the
-- path is SECURITY DEFINER), and only the foreign-key arm is exercised against a
-- restricted view (Q5).

-- ── 1. the lister asks whether you may read what you pivot from ────────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef(
    'public.list_linked_objects(uuid,text,text,integer,integer,text)'::regprocedure), chr(13), '');

  a := '  hidden text[]; wh text; link_cond text; q text; r jsonb;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the lister DECLARE tail once, found %', n; END IF;
  src := replace(src, a, a || '
  near_gate text; near_tbl text; near_pk text; near_ok boolean;');

  a := '  far := CASE WHEN lk.source_object_type_id = p_object_type
              THEN lk.target_object_type_id ELSE lk.source_object_type_id END;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the far-side resolution once, found %', n; END IF;
  src := replace(src, a, a || '

  -- The caller must be able to read the object they pivot FROM. Every other
  -- reader applies the subject type''s policy through the shared WHERE; this
  -- one applied only the far type''s. No rows rather than an error: an error
  -- would confirm the object exists, and the api masks access as absence.
  near_gate := public.restricted_view_predicate(p_object_type, ''n'');
  IF near_gate IS NOT NULL THEN
    SELECT x.index_table INTO near_tbl
      FROM public.object_type_indexes x
     WHERE x.object_type_id = p_object_type
       AND public.object_type_index_ready(x.object_type_id);
    SELECT p.property_id INTO near_pk
      FROM public.object_type_properties p
     WHERE p.object_type_id = p_object_type AND p.is_primary_key;
    IF near_tbl IS NULL OR near_pk IS NULL THEN RETURN; END IF;
    EXECUTE format(''SELECT EXISTS (SELECT 1 FROM objects.%I n WHERE n.%I::text = %L AND %s)'',
                   near_tbl, near_pk, p_primary_key, near_gate) INTO near_ok;
    IF NOT near_ok THEN RETURN; END IF;
  END IF;');

  -- and the intermediary store the object-backed arm reads
  a := '    link_cond := format(''o.%I::text IN (SELECT m.%I::text FROM objects.%I m WHERE m.%I::text = %L)'',
                        far_pk, ob_far, ob_tbl, ob_near, p_primary_key);';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the object-backed link_cond once, found %', n; END IF;
  src := replace(src, a, a || '
    -- The intermediary is a third object type the caller never named.
    near_gate := public.restricted_view_predicate(lk.backing_object_type_id, ''m'');
    IF near_gate IS NOT NULL THEN
      link_cond := left(link_cond, length(link_cond) - 1) || '' AND '' || near_gate || '')'';
    END IF;');

  EXECUTE src;
END $mig$;

-- ── 2. the hop chain gates its intermediary too ────────────────────────────

DO $mig$
DECLARE src text; a text; n int;
BEGIN
  src := replace(pg_get_functiondef('public.derived_property_select(uuid,text)'::regprocedure), chr(13), '');

  a := '    -- "the security context of all objects involved in the calculation"
    pred := public.restricted_view_predicate(far_id, hop_alias);
    IF pred IS NOT NULL THEN
      conds := conds || '' AND '' || pred;
    END IF;';
  n := (length(src) - length(replace(src, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'expected the hop gate once, found %', n; END IF;
  src := replace(src, a, a || '

    -- "ALL objects involved" includes the intermediary of an object-backed hop,
    -- which this chain joins as m<step> and 771 gated only in object_set_where.
    IF lk.backing_kind = ''object_backed'' THEN
      pred := public.restricted_view_predicate(lk.backing_object_type_id, jal);
      IF pred IS NOT NULL THEN
        conds := conds || '' AND '' || pred;
      END IF;
    END IF;');

  EXECUTE src;
END $mig$;

-- ── PROVED BY DOING ────────────────────────────────────────────────────────
-- The behaviour is proved as `authenticated` in the platform suite, where a
-- fixture can build a restricted view. What lands here is that each reader now
-- carries the call, and that the shapes still compile.

DO $$
DECLARE src text; n int;
BEGIN
  src := replace(pg_get_functiondef(
    'public.list_linked_objects(uuid,text,text,integer,integer,text)'::regprocedure), chr(13), '');
  n := (length(src) - length(replace(src, 'restricted_view_predicate(p_object_type, ''n'')', '')))
       / length('restricted_view_predicate(p_object_type, ''n'')');
  IF n <> 1 THEN RAISE EXCEPTION 'the lister should gate the object it pivots from, found %', n; END IF;
  n := (length(src) - length(replace(src, 'restricted_view_predicate(lk.backing_object_type_id, ''m'')', '')))
       / length('restricted_view_predicate(lk.backing_object_type_id, ''m'')');
  IF n <> 1 THEN RAISE EXCEPTION 'the lister should gate the intermediary, found %', n; END IF;

  src := replace(pg_get_functiondef('public.derived_property_select(uuid,text)'::regprocedure), chr(13), '');
  n := (length(src) - length(replace(src, 'restricted_view_predicate(lk.backing_object_type_id, jal)', '')))
       / length('restricted_view_predicate(lk.backing_object_type_id, jal)');
  IF n <> 1 THEN RAISE EXCEPTION 'the hop chain should gate its intermediary, found %', n; END IF;

  -- Both still run: an unbacked type yields no predicate and the readers work.
  PERFORM public.derived_property_select(gen_random_uuid(), 'o');
END $$;
