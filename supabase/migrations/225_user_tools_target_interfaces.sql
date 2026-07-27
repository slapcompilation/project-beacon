-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 225 — an authored tool may ask about an INTERFACE, not just a type
--
-- This is the payoff migration 224 was built for. Foundry:
--
--   "if new object types that implement the Facility interface are introduced,
--    the workflow will be immediately compatible with the new object types
--    without additional refactors."
--
-- Until now every authored tool bound to one subject_type_id, so a second
-- similar type meant re-authoring every tool. A tool pointed at an interface
-- runs across every type implementing it — including types authored later,
-- which is the whole reason interfaces earn their place.
--
-- Exactly one subject: a tool over both a type and an interface has no defined
-- record set. num_nonnulls says that in one line.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_tools
  ALTER COLUMN subject_type_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subject_interface_id uuid
    REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE;

ALTER TABLE public.user_tools DROP CONSTRAINT IF EXISTS user_tools_one_subject;
ALTER TABLE public.user_tools
  ADD CONSTRAINT user_tools_one_subject
  CHECK (num_nonnulls(subject_type_id, subject_interface_id) = 1);

CREATE INDEX IF NOT EXISTS idx_user_tools_subject_iface
  ON public.user_tools (subject_interface_id);

COMMENT ON COLUMN public.user_tools.subject_interface_id IS
  'Set instead of subject_type_id when the tool runs across every type implementing this interface.';

-- The FK alone allows pointing at an interface in another org if its id is known.
-- RLS hides the ids and evaluation reads implementers under RLS anyway, but a
-- subject the author cannot read is never a legitimate tool. Guard both columns.
DROP POLICY IF EXISTS "admins author user tools in scope" ON public.user_tools;
CREATE POLICY "admins author user tools in scope" ON public.user_tools
  FOR ALL
  USING (
    auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  )
  WITH CHECK (
    auth_role() IN ('owner','admin')
    AND organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
    AND (subject_type_id IS NULL OR EXISTS (
      SELECT 1 FROM public.object_types t
      WHERE t.id = subject_type_id AND t.organization_id IS NOT DISTINCT FROM auth_org_id()
    ))
    AND (subject_interface_id IS NULL OR EXISTS (
      SELECT 1 FROM public.ontology_interfaces i
      WHERE i.id = subject_interface_id AND i.organization_id IS NOT DISTINCT FROM auth_org_id()
    ))
  );
