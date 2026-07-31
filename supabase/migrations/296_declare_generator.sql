-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 296 — declare the generator, and stop the view being hand-edited.
--
-- The shape ratchet flagged rebuild_relationship_edges_view() the moment 295
-- created it, which is the gate doing its job: a new function must say why
-- nothing calls it. This one is called by migrations, like
-- derive_object_type_properties.
--
-- The second half is what actually closes the debt 288 and 294 recorded. A
-- generator only helps if nobody goes back to editing the view by hand, so the
-- drift suite now asserts that every PROJECTED link type appears in the view.
-- A link registered and not projected is "a registration, not a relationship" —
-- the exact failure this arc kept finding — and it is now a red build.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('function','rebuild_relationship_edges_view','intentional_unreachable',
   'Called by migrations after registering a link; regenerates the edge view from link_types')
ON CONFLICT (object_kind, object_name) DO UPDATE
  SET classification = EXCLUDED.classification, reason = EXCLUDED.reason;

-- Every projected link must actually appear in the view. Cheap, and it catches
-- the one thing that matters: a link somebody registered and nobody can read.
CREATE OR REPLACE FUNCTION public.unprojected_link_types()
RETURNS TABLE (edge_type text, backing_kind text, reason text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT l.edge_type, l.backing_kind,
         CASE WHEN NOT l.projected THEN 'withheld on purpose'
              ELSE 'REGISTERED BUT NOT PROJECTED' END
  FROM link_types l
  WHERE l.edge_type IS NOT NULL
    AND l.backing_kind IN ('foreign_key','join_table')
    AND NOT EXISTS (
      SELECT 1 FROM relationship_edges e WHERE e.edge_type = l.edge_type LIMIT 1)
    AND l.projected
$$;

COMMENT ON FUNCTION public.unprojected_link_types() IS
  'Link types the view does not surface. A row here that is not deliberately withheld means somebody registered a relationship nothing can read.';

COMMIT;
