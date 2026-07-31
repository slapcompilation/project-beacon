-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 275 — work can be assigned to a person. Tier 5.3.
--
-- Audit §6.2 listed assignment as absent. The adoption metrics from 274 turned
-- that from a gap into a diagnosis: 88% of proposals get decided, but only 18%
-- within a day, and by ONE person. The bottleneck is not proposal quality — it
-- is that nothing routes a proposal to anybody, so review is whoever happens to
-- look.
--
-- ON FOUNDRY'S SHAPE, honestly: our mirror covers ROLE assignment (permissions),
-- not work assignment, so I am not copying a documented primitive here. What IS
-- unambiguous in their model is that state like this lives as a PROPERTY of the
-- object and changes through an action type with audit — so that is what this
-- is: a property, plus a gated mutation, rather than a parallel task system
-- alongside the ontology.
--
-- The fuller shape is an ASSIGN_PROPOSAL BeaconAction in the registry. This is
-- the property and the server-side gate; promoting it to a typed action is a
-- later step and does not change the column.
--
-- SET NULL, not CASCADE: unassigning is what should happen when someone leaves,
-- not deleting their queue. Invariant 4's regex does not catch this column name,
-- so the reasoning is written down instead of enforced by accident.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_proposals_assignee
  ON public.proposals (assigned_to_user_id, status) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_unassigned
  ON public.proposals (hotel_id, created_at DESC) WHERE assigned_to_user_id IS NULL AND status = 'pending';

COMMENT ON COLUMN public.proposals.assigned_to_user_id IS
  'Who owns reviewing this. NULL is a real state — the unassigned queue — not a missing value.';

-- ── Assignment is gated, not a free UPDATE ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_proposal(p_proposal_id uuid, p_assignee uuid)
RETURNS public.proposals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row public.proposals;
BEGIN
  SELECT * INTO v_row FROM proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal:NotFound' USING ERRCODE = 'no_data_found';
  END IF;

  -- The caller must be able to see the work they are routing.
  IF NOT hotel_is_in_user_scope(v_row.hotel_id) THEN
    RAISE EXCEPTION 'Proposal:OutOfScope' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- And the assignee must actually be in this organization. Assigning work to
  -- somebody who cannot open it is a queue that silently never moves.
  IF p_assignee IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_org_memberships m
    WHERE m.user_id = p_assignee AND m.organization_id IS NOT DISTINCT FROM auth_org_id()
  ) THEN
    RAISE EXCEPTION 'Assignment:AssigneeNotInOrganization' USING ERRCODE = 'foreign_key_violation';
  END IF;

  UPDATE proposals
     SET assigned_to_user_id = p_assignee,
         assigned_at = CASE WHEN p_assignee IS NULL THEN NULL ELSE now() END
   WHERE id = p_proposal_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.assign_proposal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_proposal(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.assign_proposal(uuid, uuid) IS
  'Routes a proposal to a person, or clears it with NULL. Refuses an assignee outside the organization — work assigned to someone who cannot open it is a queue that silently never moves. Errors are namespaced (Namespace:ErrorName) so a caller can branch without parsing prose.';

-- ── The metric that made the case now measures the fix ───────────────────────

CREATE OR REPLACE FUNCTION public.review_queue_load()
RETURNS TABLE (assignee uuid, assignee_email text, pending integer, oldest_days integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT p.assigned_to_user_id,
         coalesce(u.email, CASE WHEN p.assigned_to_user_id IS NULL THEN '(unassigned)' ELSE '(unknown)' END),
         count(*)::int,
         coalesce(max(extract(day from now() - p.created_at))::int, 0)
  FROM proposals p
  LEFT JOIN auth.users u ON u.id = p.assigned_to_user_id
  WHERE p.status = 'pending' AND hotel_is_in_user_scope(p.hotel_id)
  GROUP BY 1, 2
  ORDER BY 3 DESC;
$$;

COMMENT ON FUNCTION public.review_queue_load() IS
  'Pending review per assignee, unassigned included as its own row. 274 showed decisions concentrated in one person; this is where that shows up daily rather than in an audit.';

COMMIT;
