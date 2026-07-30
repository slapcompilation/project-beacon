-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 248 — object sets (cohorts). Tier 1 of docs/IMPLEMENTATION-MAP.md.
--
-- Foundry: a rule is "a set of conditions that specify particular rows of data"
-- and supports "categorization and cohort creation". The set is the noun;
-- alerting, aggregation and analysis are consumers of it.
--
-- Ours had the concept twice, welded to a consumer each time — an automation is
-- a condition fused to an effect, an authored tool a condition fused to an
-- aggregation. Neither can be named alone, which is why the audit found no
-- Cohort object (§6.2): investigation logic lived in useMonitorCaseSweep, which
-- re-derives the group on every sweep and keeps no record of it.
--
-- A cohort IS a named object set. One noun, not two.
--
-- Same shape as user_tools (221/225/226) deliberately: an authored tool is this
-- plus an aggregation, so the grammar has to match or the two drift.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.object_sets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id          uuid REFERENCES hotels(id) ON DELETE CASCADE,

  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  api_name          text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  description       text NOT NULL DEFAULT '',

  -- Exactly one subject. A set over both a type and an interface has no defined
  -- membership; num_nonnulls says that in one line.
  subject_type_id      uuid REFERENCES public.object_types(id) ON DELETE CASCADE,
  subject_interface_id uuid REFERENCES public.ontology_interfaces(id) ON DELETE CASCADE,

  filters           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(filters) = 'array'),
  -- Same grammar function the tools use — one definition of a parameter.
  parameters        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (public.user_tool_params_valid(parameters)),

  -- Provenance, not identity: the set outlives its author (invariant 4).
  created_by_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, api_name),
  CONSTRAINT object_sets_one_subject CHECK (num_nonnulls(subject_type_id, subject_interface_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_object_sets_org           ON public.object_sets (organization_id);
CREATE INDEX IF NOT EXISTS idx_object_sets_subject       ON public.object_sets (subject_type_id);
CREATE INDEX IF NOT EXISTS idx_object_sets_subject_iface ON public.object_sets (subject_interface_id);

COMMENT ON TABLE public.object_sets IS
  'Named object sets — cohorts. The selection half of a rule, stored so more than one consumer can point at it. Membership is evaluated live by selectObjectSet in @beacon/reality-graph; nothing is materialised.';
COMMENT ON COLUMN public.object_sets.subject_interface_id IS
  'Set instead of subject_type_id when the cohort spans every type implementing this interface — including types authored later.';

ALTER TABLE public.object_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read object sets in scope" ON public.object_sets;
CREATE POLICY "members read object sets in scope" ON public.object_sets
  FOR SELECT
  USING (
    organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  );

-- Authoring is admin/owner like every other ontology artifact: a cohort becomes
-- the subject of automations and tools, so widening it widens what they act on.
-- The subject guards mirror 225 — the FK alone would allow pointing at a type in
-- another org if its id were known.
DROP POLICY IF EXISTS "admins author object sets in scope" ON public.object_sets;
CREATE POLICY "admins author object sets in scope" ON public.object_sets
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
