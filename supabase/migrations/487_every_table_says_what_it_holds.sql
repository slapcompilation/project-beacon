-- The 2026-08-13 foundry-gap run, retired.
--
-- Two findings, both mechanical. Thirteen tables had no COMMENT ON TABLE —
-- each was cited in its migration header, but the comment is where the next
-- reader actually looks. And twelve foreign keys had no index on their
-- leading column — ten added by the security phase's own migrations after
-- 464 retired the original list, two older strays that slipped past it. The
-- lists were generated from the live catalog, 464's idiom.

COMMENT ON TABLE public.action_type_parameters IS
  'The Form: one row per input of an action type — id, label, base type, required, and the value type that constrains it.';
COMMENT ON TABLE public.group_members IS
  'A group''s members: individual users or nested groups, with optional expiration honored at evaluation on every hop.';
COMMENT ON TABLE public.group_permissions IS
  'The two administrative permissions on a group: manage_permissions (grant onward, edit metadata, manage members) and manage_membership (manage members and expiration).';
COMMENT ON TABLE public.interface_action_parameter_mappings IS
  'How an implementation maps an interface action constraint''s parameters onto the satisfying action type''s own parameters.';
COMMENT ON TABLE public.interface_action_satisfactions IS
  'Which concrete action type satisfies each required interface action constraint, per implementing object type.';
COMMENT ON TABLE public.interface_link_constraints IS
  'An interface link type constraint: link target (interface or object type), cardinality, and whether implementation requires it.';
COMMENT ON TABLE public.object_set_members IS
  'A static list''s stored membership, one primary key per row — an exploration stores none and re-evaluates its filters instead.';
COMMENT ON TABLE public.object_type_interfaces IS
  'Which object types implement which interfaces — the implementation row the property mappings hang off.';
COMMENT ON TABLE public.ontology_interfaces IS
  'Interface definitions: an API contract object types implement, carrying properties, link constraints and action constraints.';
COMMENT ON TABLE public.organization_scoped_session_settings IS
  'Per-organization scoped-session policy: whether members may open scoped sessions at all.';
COMMENT ON TABLE public.restricted_view_marking_stops IS
  'Markings severed from a restricted view at creation review — removal takes the remove permission on the marking.';
COMMENT ON TABLE public.scoped_session_markings IS
  'The markings a scoped session carries: the session sees the intersection, a disjunctive filter over conjunctive membership.';
COMMENT ON TABLE public.value_type_constraints IS
  'One constraint row per value type version — the rule a bound property''s values must satisfy at index time.';

CREATE INDEX IF NOT EXISTS group_members_added_by_idx ON public.group_members (added_by);
CREATE INDEX IF NOT EXISTS group_permissions_granted_by_idx ON public.group_permissions (granted_by);
CREATE INDEX IF NOT EXISTS group_permissions_user_id_idx ON public.group_permissions (user_id);
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON public.groups (created_by);
CREATE INDEX IF NOT EXISTS interface_action_parameter_mappings_action_parameter_id_idx ON public.interface_action_parameter_mappings (action_parameter_id);
CREATE INDEX IF NOT EXISTS interface_action_parameter_mappings_parameter_constraint_id_idx ON public.interface_action_parameter_mappings (parameter_constraint_id);
CREATE INDEX IF NOT EXISTS marking_category_permissions_granted_by_user_id_idx ON public.marking_category_permissions (granted_by_user_id);
CREATE INDEX IF NOT EXISTS object_type_datasources_restricted_view_id_idx ON public.object_type_datasources (restricted_view_id);
CREATE INDEX IF NOT EXISTS restricted_view_marking_stops_marking_id_idx ON public.restricted_view_marking_stops (marking_id);
CREATE INDEX IF NOT EXISTS restricted_view_marking_stops_stopped_by_idx ON public.restricted_view_marking_stops (stopped_by);
CREATE INDEX IF NOT EXISTS restricted_views_created_by_idx ON public.restricted_views (created_by);
CREATE INDEX IF NOT EXISTS restricted_views_project_id_idx ON public.restricted_views (project_id);

-- Nothing uncommented, nothing unindexed — asserted, so the next gap run
-- diffs against a clean floor.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_class c
   JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind = 'r'
    AND obj_description(c.oid, 'pg_class') IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '% table(s) still have no COMMENT ON TABLE', n;
  END IF;

  SELECT count(*) INTO n FROM pg_constraint c
  WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
    AND NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]);
  IF n > 0 THEN
    RAISE EXCEPTION '% foreign key(s) still have no index on their leading column', n;
  END IF;

  RAISE NOTICE '487: every table says what it holds, and every foreign key has its index again';
END $$;
