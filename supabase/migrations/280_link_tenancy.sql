-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 280 — a link carries its organization, like everything else does.
--
-- Found while diagnosing the harmonization regression: every row in every join
-- table has organization_id NULL. 4,076 of them.
--
--   link_influenced_by_occupancy   3802 / 3802 null
--   link_influenced_by_principle    261 /  261 null
--   link_linked_to_po                 8 /    8 null
--   link_mentions                     5 /    5 null
--
-- Cause is 262's routing trigger: it inserts (hotel_id, source_id, target_id)
-- and nothing else, so the column exists, carries an FK, and was never once
-- written. Nothing is broken TODAY because the policies on these tables are
-- hotel-scoped — which is exactly why it went unnoticed and why it would have
-- surfaced later as "the chain-wide query returns nothing" instead of as this.
--
-- CLAUDE.md's multi-tenancy rule is that every node carries both ids. A link is
-- not exempt; the org tier (portfolio contracts, chain-wide agents, benchmarks)
-- is the tier that needs to ask across hotels.
--
-- Derived from the hotel rather than passed in by the caller: the hotel already
-- knows its organization, and a caller that can state it can state it wrong.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

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
    INSERT INTO relationship_edges_store
      (id, edge_type, source_type, source_id, target_type, target_id, hotel_id, triggered_by, actor_id, metadata, created_at)
    VALUES (coalesce(NEW.id, gen_random_uuid()), NEW.edge_type, NEW.source_type, NEW.source_id,
            NEW.target_type, NEW.target_id, NEW.hotel_id, coalesce(NEW.triggered_by,'system'),
            NEW.actor_id, coalesce(NEW.metadata,'{}'::jsonb), coalesce(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END $function$;

-- ── Backfill the 4,076 ───────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT DISTINCT backing_table FROM link_types
            WHERE backing_kind = 'join_table' AND backing_table IS NOT NULL
  LOOP
    EXECUTE format(
      'UPDATE public.%I l SET organization_id = h.organization_id
         FROM public.hotels h
        WHERE h.id = l.hotel_id AND l.organization_id IS NULL', t);
  END LOOP;
END $$;

-- A link whose hotel has an organization must carry it. Assert rather than hope:
-- the whole reason this migration exists is that nothing was checking.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%s: %s rows', t, n), '; ') INTO bad FROM (
    SELECT 'link_mentions' t, count(*) n FROM link_mentions l JOIN hotels h ON h.id = l.hotel_id
      WHERE h.organization_id IS NOT NULL AND l.organization_id IS NULL
    UNION ALL
    SELECT 'link_influenced_by_occupancy', count(*) FROM link_influenced_by_occupancy l JOIN hotels h ON h.id = l.hotel_id
      WHERE h.organization_id IS NOT NULL AND l.organization_id IS NULL
    UNION ALL
    SELECT 'link_influenced_by_principle', count(*) FROM link_influenced_by_principle l JOIN hotels h ON h.id = l.hotel_id
      WHERE h.organization_id IS NOT NULL AND l.organization_id IS NULL
    UNION ALL
    SELECT 'link_linked_to_po', count(*) FROM link_linked_to_po l JOIN hotels h ON h.id = l.hotel_id
      WHERE h.organization_id IS NOT NULL AND l.organization_id IS NULL
  ) x WHERE n > 0;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 280: links still missing their organization: %', bad;
  END IF;
END $$;

COMMENT ON FUNCTION public.relationship_edges_write() IS
  'Routes writes on the relationship_edges view to the link''s backing. Join tables get their organization derived from the hotel — 262 omitted it and 4,076 rows carried a NULL tenancy column that no policy happened to read.';

COMMIT;
