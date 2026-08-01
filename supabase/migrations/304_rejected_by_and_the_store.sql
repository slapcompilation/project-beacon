-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 304 — an operator can traverse who approved a request and not who
-- rejected one.
--
-- 303 registered belongs_to_session, which had been sitting in the vocabulary
-- with a perfectly good foreign key behind it and no registration. Checking
-- whether it was alone found one more, and it is the more embarrassing case:
--
--   approved_by   REGISTERED   foreign_key on restock_requests.approved_by
--   rejected_by   unregistered — falls through to the generic store
--
-- Same table. Same shape. Same kind of decision. One is a first-class link and
-- the other is not, so "who approved this" traverses and "who rejected this"
-- does not.
--
-- Nothing had noticed because NO RESTOCK REQUEST HAS EVER BEEN REJECTED —
-- 6 pending, 18 approved, 0 rejected. The trigger that writes the edge is real
-- and correct and has simply never had an occasion to fire. A relationship that
-- is missing only when somebody finally says no is a bad one to discover then.
--
-- ── WHAT THE GENERIC STORE IS ACTUALLY FOR ──────────────────────────────────
--
-- Checking the other ten unregistered vocabulary names against the schema found
-- exactly one column match — rejected_by. The rest have no column anywhere,
-- which is the answer rather than a gap:
--
--   describes_entity   created when an operator APPROVES an entity-link
--                      suggestion; entity_link_suggestions.resulting_edge_id
--                      points back at the row it made
--   resolved_to        created when harmonization resolves an entity
--   discarded_via      created when a batch is discarded
--
-- These are edges brought into being by a DECISION, not implied by a column.
-- That is precisely what relationship_edges_store is for, and registering them
-- as join tables would be wrong: the backing would have to filter on status,
-- and inventing a filter grammar in link config to serve three links is the
-- injection surface this codebase has now declined three times (277, 289, 295).
--
-- ── DEAD VOCABULARY, recorded not removed ───────────────────────────────────
--
-- Seven names nothing writes and nothing stores: applies_to, benchmarks,
-- harmonized_to, modified_by, proposed_by, similar_to, transfers. Four are not
-- referenced in application code at all beyond the union and its labels.
--
-- Left in place deliberately. Removing an edge type means editing the union and
-- its two exhaustive Records, and "nothing writes it yet" is the same argument
-- that would have deleted rejected_by — which turned out to need registering,
-- not deleting. Recorded here so the next person weighs evidence rather than
-- silence.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.link_types
  (organization_id, source_object_type_id, target_object_type_id,
   api_name, label, target_api_name, target_label, source_api_name, source_label,
   cardinality, backing_kind, backing_table, backing_column, kind, edge_type,
   backing_hotel_column, backing_time_column, created_by_user_id)
SELECT o.id, s.id, t.id, 'rejected_by', 'Rejected By', 'rejectedBy', 'Rejected By',
       'rejectedRequests', 'Rejected Requests', 'many_to_one', 'foreign_key',
       'restock_requests', 'rejected_by', 'builtin', 'rejected_by',
       'hotel_id', 'rejected_at',
       coalesce((SELECT m.user_id FROM user_org_memberships m WHERE m.organization_id = o.id LIMIT 1),
                '00000000-0000-0000-0000-000000000000'::uuid)
FROM organizations o
JOIN public.object_types s ON s.api_name = 'restock_request' AND s.organization_id = o.id
JOIN public.object_types t ON t.api_name = 'user'            AND t.organization_id = o.id
ON CONFLICT DO NOTHING;

SELECT public.rebuild_relationship_edges_view();

-- ── A vocabulary name with a column behind it must be registered ────────────
-- This is the guard that would have caught rejected_by without an audit. It is
-- deliberately narrow: an exact column-name match. belongs_to_session (backed by
-- session_id) would NOT have been caught, and pretending otherwise would make
-- the guard look stronger than it is.

CREATE OR REPLACE FUNCTION public.unbacked_vocabulary()
RETURNS TABLE (edge_type text, backing text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT DISTINCT e.edge_type, c.table_name || '.' || c.column_name
  FROM (
    SELECT unnest(enum_range_of_edge_types.v) AS edge_type
    FROM (SELECT string_to_array(
            substring(pg_get_constraintdef(con.oid) from '\((.*)\)'), ', ') AS v
          FROM pg_constraint con
          WHERE con.conname = 'relationship_edges_edge_type_check') enum_range_of_edge_types
  ) e
  JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.column_name = replace(replace(e.edge_type, '''', ''), '::text', '')
  JOIN pg_constraint fk
    ON fk.conrelid = ('public.' || c.table_name)::regclass AND fk.contype = 'f'
  WHERE NOT EXISTS (
    SELECT 1 FROM link_types l
    WHERE l.edge_type = replace(replace(e.edge_type, '''', ''), '::text', ''))
$$;

COMMENT ON FUNCTION public.unbacked_vocabulary() IS
  'Edge types the vocabulary allows that have a same-named foreign-key column and no link_types row — a relationship the schema already holds and the ontology cannot traverse. Narrow on purpose: it matches column NAMES, so a link backed by a differently-named column (belongs_to_session over session_id) slips past.';

-- ── Assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE missing text; n int;
BEGIN
  SELECT string_agg(edge_type, ', ') INTO missing FROM unprojected_link_types();
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 304: registered but not projected: %', missing;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM link_types WHERE edge_type = 'rejected_by' AND backing_kind = 'foreign_key') THEN
    RAISE EXCEPTION 'Migration 304: rejected_by did not register — an endpoint api_name did not resolve';
  END IF;

  SELECT count(*) INTO n FROM unbacked_vocabulary();
  IF n > 0 THEN
    RAISE EXCEPTION 'Migration 304: % vocabulary name(s) still have a column and no link', n;
  END IF;

  RAISE NOTICE 'Migration 304: rejected_by registered · vocabulary has no unbacked column matches';
END $$;

COMMIT;
