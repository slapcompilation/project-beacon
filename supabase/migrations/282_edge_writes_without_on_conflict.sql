-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 282 — five writers have been throwing since relationship_edges
-- became a view. Restock fulfilment is one of them.
--
-- Found while registering a real data source: checking what identified a POS
-- row surfaced `ingest_pos_sale` doing
--
--   INSERT INTO relationship_edges (...) ON CONFLICT (source_id, edge_type, target_id)
--
-- 262 made relationship_edges a VIEW. A view has no unique constraints, so
-- Postgres refuses the statement outright:
--
--   42P10 | there is no unique or exclusion constraint matching the
--           ON CONFLICT specification
--
-- Not a silent wrong answer this time — a hard throw that aborts the whole
-- transaction. Five functions carry the clause, and three of them are live:
--
--   trg_restock_fulfilled_edge  AFTER UPDATE on restock_requests — verified
--                               against a real row: approved -> fulfilled FAILS
--   ingest_pos_sale             ingest-pos + square-webhook edge functions
--   commit_stocktake            called from the web app
--   create_relationship_edge    generic edge RPC
--   seed_demo_world             demo seeding
--
-- WHY THE CALLERS CAN SIMPLY DROP IT. The clause was written when
-- relationship_edges was a table carrying relationship_edges_unique_triple on
-- (source_id, edge_type, target_id). Dedup now belongs to the router, which is
-- the only thing that knows where a link is backed:
--
--   join_table   already ON CONFLICT (source_id, target_id) DO NOTHING
--   foreign_key  discarded — the column already carries the relationship
--   store        this migration adds it; the index it needs already exists
--
-- So every path keeps insert-once semantics and no caller has to know which.
--
-- The store branch is not hypothetical. Twelve of the 35 edge types the
-- vocabulary CHECK allows have no link_types row and route there —
-- applies_to, belongs_to_session, benchmarks, describes_entity, discarded_via,
-- harmonized_to, modified_by, proposed_by, rejected_by, resolved_to,
-- similar_to, transfers. Without the guard below, duplicates would start
-- landing the moment the callers stopped carrying it themselves.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Dedup moves into the router ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.relationship_edges_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  lt       record;
  link_tbl text;
  v_org    uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO lt FROM link_types WHERE edge_type = OLD.edge_type LIMIT 1;
    IF lt.backing_kind = 'join_table' THEN
      EXECUTE format('DELETE FROM public.%I WHERE source_id = $1 AND target_id = $2', lt.backing_table)
        USING OLD.source_id, OLD.target_id;
    ELSIF lt.backing_kind IS NULL THEN
      DELETE FROM relationship_edges_store WHERE id = OLD.id;
    END IF;
    -- An FK-backed relationship is deleted by clearing its column, never here.
    RETURN OLD;
  END IF;

  SELECT * INTO lt FROM link_types WHERE edge_type = NEW.edge_type LIMIT 1;

  IF lt.backing_kind = 'join_table' THEN
    -- backing_table, not 'link_' || edge_type: the registry records where the
    -- backing lives, and rebuilding the name by concatenation is a second
    -- source of truth that breaks on an authored link with no edge_type.
    link_tbl := lt.backing_table;
    -- The hotel knows its organization; a caller that can state it can state it
    -- wrong. NULL hotel_id stays NULL org, which the policies already allow.
    SELECT h.organization_id INTO v_org FROM hotels h WHERE h.id = NEW.hotel_id;
    EXECUTE format(
      'INSERT INTO public.%I (organization_id, hotel_id, source_id, target_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (source_id, target_id) DO NOTHING', link_tbl)
      USING v_org, NEW.hotel_id, NEW.source_id, NEW.target_id;
  ELSIF lt.backing_kind = 'foreign_key' THEN
    -- Discarded on purpose: the caller already set the column that carries this
    -- relationship, so the row it is asking for is true before it asks.
    NULL;
  ELSE
    -- Callers used to guard this themselves against relationship_edges_unique_triple.
    -- They cannot any more — a view has no constraints to name — so the guard
    -- lives here, on the same triple, against the same index.
    INSERT INTO relationship_edges_store
      (id, edge_type, source_type, source_id, target_type, target_id, hotel_id, triggered_by, actor_id, metadata, created_at)
    VALUES (coalesce(NEW.id, gen_random_uuid()), NEW.edge_type, NEW.source_type, NEW.source_id,
            NEW.target_type, NEW.target_id, NEW.hotel_id, coalesce(NEW.triggered_by,'system'),
            NEW.actor_id, coalesce(NEW.metadata,'{}'::jsonb), coalesce(NEW.created_at, now()))
    ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

-- ── 2. Strip the clause from every function still carrying it ────────────────
-- Rewritten from pg_get_functiondef rather than retyped: five bodies, one of
-- them 60 lines, and a transcription slip here would be a worse bug than the
-- one being fixed. The clause text is an exact anchor — it names three columns
-- that only ever appear together on this relation, and ingest_pos_sale's other
-- ON CONFLICT (on pos_connections) is a different clause and survives.
--
-- Matched on inserts into the VIEW specifically. The clause alone is not enough:
-- the router rewritten above now carries the same text legitimately, against
-- relationship_edges_STORE, which is a real table with that exact index. A first
-- pass matching on clause text alone found 6 functions and would have stripped
-- the dedup back out of the router one statement after adding it. The count
-- assertion below is what caught that, which is the argument for having it.

DO $mig$
DECLARE r record; newdef text; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
    WHERE nsp.nspname = 'public' AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) LIKE '%ON CONFLICT (source_id, edge_type, target_id) DO NOTHING%'
      AND pg_get_functiondef(p.oid) ~* 'INSERT INTO\s+(public\.)?relationship_edges\s*\('
  LOOP
    newdef := replace(r.def, 'ON CONFLICT (source_id, edge_type, target_id) DO NOTHING', '');
    IF newdef = r.def THEN
      RAISE EXCEPTION 'Migration 282: % matched but did not rewrite', r.proname;
    END IF;
    EXECUTE newdef;
    n := n + 1;
  END LOOP;
  IF n <> 5 THEN
    RAISE EXCEPTION 'Migration 282: expected 5 functions to rewrite, got %', n;
  END IF;
END $mig$;

-- ── 3. Assert it, do not assume it ───────────────────────────────────────────

-- `\s*\(` after the name is load-bearing: relationship_edges is a prefix of
-- relationship_edges_store, and without it this assertion reports the router
-- for doing the correct thing on the real table.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO bad
  FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
  WHERE nsp.nspname = 'public' AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) ~* 'INSERT INTO\s+(public\.)?relationship_edges\s*\([^;]*ON CONFLICT';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 282: still guarding a view with ON CONFLICT: %', bad;
  END IF;
END $$;

-- The failure that started this: a restock request reaching 'fulfilled'.
-- Runs against a real row and rolls it back — the point is that it no longer
-- throws, not that anything changes.
DO $$
DECLARE v_id uuid; ok boolean := false;
BEGIN
  SELECT id INTO v_id FROM restock_requests WHERE status = 'approved' ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    RAISE NOTICE 'Migration 282: no approved restock request to probe; skipped';
    RETURN;
  END IF;
  BEGIN
    UPDATE restock_requests SET status = 'fulfilled' WHERE id = v_id;
    ok := true;
    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'rollback_probe' THEN
        RAISE EXCEPTION 'Migration 282: restock fulfilment still fails: %', SQLERRM;
      END IF;
    WHEN others THEN
      RAISE EXCEPTION 'Migration 282: restock fulfilment still fails: % | %', SQLSTATE, SQLERRM;
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'Migration 282: fulfilment probe did not run';
  END IF;
END $$;

-- And that the router still refuses to write the same store edge twice, which
-- is what the callers were guarding before they stopped.
DO $$
DECLARE v_hotel uuid; v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); n int;
BEGIN
  SELECT id INTO v_hotel FROM hotels LIMIT 1;
  BEGIN
    INSERT INTO relationship_edges (hotel_id, source_type, source_id, edge_type, target_type, target_id)
    VALUES (v_hotel, 'probe', v_a, 'similar_to', 'probe', v_b);
    INSERT INTO relationship_edges (hotel_id, source_type, source_id, edge_type, target_type, target_id)
    VALUES (v_hotel, 'probe', v_a, 'similar_to', 'probe', v_b);
    SELECT count(*) INTO n FROM relationship_edges_store
     WHERE source_id = v_a AND edge_type = 'similar_to' AND target_id = v_b;
    IF n <> 1 THEN
      RAISE EXCEPTION 'Migration 282: store dedup broken — wrote % rows for one triple', n;
    END IF;
    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
