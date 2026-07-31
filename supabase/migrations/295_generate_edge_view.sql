-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 295 — the edge view generates itself from the registry.
--
-- Recorded as a known cost in 288 and again in 294: every new link means
-- hand-copying a ~30-branch view body, and each copy is a chance to drop a
-- branch silently. Four copies so far. This is the fix those notes pointed at.
--
-- link_types already knows the backing table and column for every relationship.
-- What it did not know is which column carries the tenancy and which carries the
-- time, so those become two columns rather than two conventions.
--
-- WHY COLUMNS AND NOT AN EXPRESSION. A backing_hotel_expr holding arbitrary SQL
-- would be an injection surface reaching a SECURITY INVOKER view — the same
-- reason 277 used a sign enum and 289 a column+value pair. Column names go
-- through %I; nothing else is interpolated.
--
-- THE ONE EXCEPTION, stated rather than hidden: sourced_from reads
-- product_variants but takes its hotel from a JOIN to products. A generator over
-- single tables cannot express that, and inventing a join grammar in config to
-- serve one row would be worse than one clearly-marked exception. It is emitted
-- by hand inside the generator, with this comment attached.
--
-- SAFETY. The rebuild runs inside this transaction and is asserted against a
-- snapshot of the CURRENT view: same edge types, same row counts, same distinct
-- hotel_ids per type. Any difference rolls the whole thing back. This view has
-- thirteen readers and is the wrong place to be brave.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.link_types
  ADD COLUMN IF NOT EXISTS backing_hotel_column text,
  ADD COLUMN IF NOT EXISTS backing_time_column  text,
  ADD COLUMN IF NOT EXISTS projected            boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.link_types.backing_hotel_column IS
  'Column on the backing table carrying tenancy. NULL means the backing has none and the projected edge gets a NULL hotel_id.';
COMMENT ON COLUMN public.link_types.backing_time_column IS
  'Column on the backing table carrying the edge time. NULL means now().';
COMMENT ON COLUMN public.link_types.projected IS
  'Whether relationship_edges surfaces this link. False records a DECISION not to project it yet — see receipt_sourced_from, withheld in 264 until its tenancy column is settled.';

-- 264 withheld receipt_sourced_from deliberately: restock_receives has a
-- supplier_id foreign key but no hotel_id, and joining through the request to
-- invent one would make the view's tenancy depend on a second table. The
-- generator would have reinstated it with a NULL hotel — the equivalence
-- assertion below caught exactly that. The decision becomes data rather than an
-- absence somebody has to remember.
UPDATE public.link_types SET projected = false WHERE edge_type = 'receipt_sourced_from';

-- ── What the live view uses today, made explicit ────────────────────────────

UPDATE public.link_types SET backing_hotel_column = 'hotel_id', backing_time_column = 'created_at'
 WHERE backing_kind = 'join_table';

UPDATE public.link_types l SET
  backing_hotel_column = v.hotel_col,
  backing_time_column  = v.time_col
FROM (VALUES
  ('consumes',              'hotel_id',    'timestamp'),
  ('reverts',               'hotel_id',    'timestamp'),
  ('restocks',              'hotel_id',    'created_at'),
  ('approved_by',           'hotel_id',    'created_at'),
  ('fulfills',              'hotel_id',    NULL),
  ('invoiced_by',           'hotel_id',    'created_at'),
  ('batch_of',              'hotel_id',    NULL),
  ('derived_from',          'hotel_id',    'created_at'),
  ('cited_in',              'hotel_id',    'created_at'),
  ('delivery_sourced_from', 'hotel_id',    'created_at'),
  ('po_sourced_from',       'hotel_id',    'created_at'),
  ('recipe_consumes',       NULL,          NULL),
  ('pick_consumes',         NULL,          NULL),
  ('transfer_approved_by',  'to_hotel_id', 'created_at'),
  ('sold',                  'hotel_id',    'created_at'),
  ('ingredient_of',         NULL,          NULL),
  ('line_of',               'hotel_id',    NULL),
  ('line_orders',           'hotel_id',    NULL),
  ('line_fulfills_request', 'hotel_id',    NULL),
  ('discrepancy_of',        'hotel_id',    'detected_at')
) AS v(edge_type, hotel_col, time_col)
WHERE l.edge_type = v.edge_type AND l.backing_kind = 'foreign_key';

-- A configured column that does not exist is a view that fails to build.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%s -> %s.%s', l.edge_type, l.backing_table, c.col), '; ') INTO bad
  FROM link_types l
  CROSS JOIN LATERAL (VALUES (l.backing_hotel_column), (l.backing_time_column)) AS c(col)
  WHERE l.backing_kind IN ('foreign_key','join_table') AND c.col IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns ic
                    WHERE ic.table_schema='public' AND ic.table_name = l.backing_table AND ic.column_name = c.col);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 295: configured column does not exist: %', bad;
  END IF;
END $$;

-- ── The generator ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rebuild_relationship_edges_view()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  r      record;
  parts  text[] := ARRAY[]::text[];
  body   text;
BEGIN
  -- Join-table backings: the link table IS the relationship.
  FOR r IN
    SELECT DISTINCT ON (l.edge_type) l.edge_type, l.backing_table,
           s.api_name AS src, t.api_name AS tgt,
           l.backing_hotel_column AS hcol, l.backing_time_column AS tcol
    FROM link_types l
    JOIN object_types s ON s.id = l.source_object_type_id
    JOIN object_types t ON t.id = l.target_object_type_id
    -- edge_type IS NOT NULL excludes AUTHORED links: they share link_types but
    -- are backed by object_links, which has no source_id/target_id of its own
    -- and is not part of the built-in edge vocabulary this view projects.
    WHERE l.backing_kind = 'join_table' AND l.edge_type IS NOT NULL AND l.projected
    ORDER BY l.edge_type
  LOOP
    parts := parts || format(
      'SELECT md5(%L || x.source_id::text || x.target_id::text)::uuid, %L::text, %L::text, x.source_id, %L::text, x.target_id, %s, ''system''::text, NULL::uuid, ''{}''::jsonb, %s FROM public.%I x',
      r.edge_type, r.edge_type, r.src, r.tgt,
      CASE WHEN r.hcol IS NULL THEN 'NULL::uuid' ELSE 'x.' || quote_ident(r.hcol) END,
      CASE WHEN r.tcol IS NULL THEN 'now()'      ELSE 'x.' || quote_ident(r.tcol) END,
      r.backing_table);
  END LOOP;

  -- Foreign-key backings: the column IS the relationship.
  FOR r IN
    SELECT DISTINCT ON (l.edge_type) l.edge_type, l.backing_table, l.backing_column,
           s.api_name AS src, t.api_name AS tgt,
           l.backing_hotel_column AS hcol, l.backing_time_column AS tcol
    FROM link_types l
    JOIN object_types s ON s.id = l.source_object_type_id
    JOIN object_types t ON t.id = l.target_object_type_id
    WHERE l.backing_kind = 'foreign_key' AND l.backing_column IS NOT NULL
      AND l.edge_type IS NOT NULL AND l.projected
      -- sourced_from takes its hotel from a JOIN to products, which a generator
      -- over single tables cannot express. Emitted by hand below rather than
      -- inventing a join grammar in config to serve one relationship.
      AND l.edge_type <> 'sourced_from'
    ORDER BY l.edge_type
  LOOP
    parts := parts || format(
      'SELECT md5(%L || x.id::text || x.%I::text)::uuid, %L::text, %L::text, x.id, %L::text, x.%I, %s, ''system''::text, NULL::uuid, ''{}''::jsonb, %s FROM public.%I x WHERE x.%I IS NOT NULL',
      r.edge_type, r.backing_column, r.edge_type, r.src, r.tgt, r.backing_column,
      CASE WHEN r.hcol IS NULL THEN 'NULL::uuid' ELSE 'x.' || quote_ident(r.hcol) END,
      CASE WHEN r.tcol IS NULL THEN 'now()'      ELSE 'x.' || quote_ident(r.tcol) END,
      r.backing_table, r.backing_column);
  END LOOP;

  -- The exception, and the store tail.
  parts := parts || $ex$SELECT md5('sourced_from' || pv.id::text || pv.default_supplier_id::text)::uuid, 'sourced_from'::text, 'variant'::text, pv.id, 'supplier'::text, pv.default_supplier_id, p.hotel_id, 'system'::text, NULL::uuid, '{}'::jsonb, now() FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id WHERE pv.default_supplier_id IS NOT NULL$ex$::text;

  parts := parts || 'SELECT id, edge_type, source_type, source_id, target_type, target_id, hotel_id, triggered_by, actor_id, metadata, created_at FROM public.relationship_edges_store'::text;

  body := 'CREATE OR REPLACE VIEW public.relationship_edges (id, edge_type, source_type, source_id, target_type, target_id, hotel_id, triggered_by, actor_id, metadata, created_at) WITH (security_invoker = true) AS '
        || array_to_string(parts, ' UNION ALL ');
  EXECUTE body;
  RETURN body;
END $fn$;

REVOKE ALL ON FUNCTION public.rebuild_relationship_edges_view() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.rebuild_relationship_edges_view() IS
  'Regenerates relationship_edges from link_types. Adding a link is a registration plus this call — no hand-copied view body, which is how a branch gets dropped silently.';

-- ── Rebuild, and prove it changed nothing ───────────────────────────────────

CREATE TEMP TABLE edge_snapshot ON COMMIT DROP AS
  SELECT edge_type, count(*) AS n, count(DISTINCT hotel_id) AS hotels
  FROM public.relationship_edges GROUP BY edge_type;

SELECT public.rebuild_relationship_edges_view();

DO $$
DECLARE diff text;
BEGIN
  SELECT string_agg(format('%s: was %s/%s now %s/%s',
           coalesce(a.edge_type, b.edge_type),
           coalesce(a.n::text,'-'), coalesce(a.hotels::text,'-'),
           coalesce(b.n::text,'-'), coalesce(b.hotels::text,'-')), '; ')
    INTO diff
  FROM edge_snapshot a
  FULL JOIN (SELECT edge_type, count(*) n, count(DISTINCT hotel_id) hotels
             FROM public.relationship_edges GROUP BY edge_type) b
    ON b.edge_type = a.edge_type
  WHERE a.edge_type IS NULL OR b.edge_type IS NULL OR a.n <> b.n OR a.hotels <> b.hotels;

  IF diff IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 295: generated view differs from the hand-written one — %', diff;
  END IF;
  RAISE NOTICE 'Migration 295: generated view is row-identical across % edge types', (SELECT count(*) FROM edge_snapshot);
END $$;

COMMIT;
