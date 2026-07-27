-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 221 — user-authored Logic Tools (Phase 4)
--
-- A code Logic Tool has an `invoke` body; an operator can't be handed arbitrary
-- code. An authored tool is instead a bounded QUESTION over the ontology —
-- "count / sum / avg <property> of <object type> where <filters>" — stored as
-- data and answered by one interpreter in reality-graph (userTools/).
--
-- Same shape as automations (213) and object_types (214): org-scoped read for
-- members, admin/owner authoring, org + author set by column DEFAULT so the
-- client sends only the definition.
--
-- The grammar is CHECK-constrained here as well as validated in code — the
-- database is the last word on what a tool may be, not the composer.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_tools (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id          uuid REFERENCES hotels(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  api_name          text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  description       text NOT NULL DEFAULT '',
  subject_type_id   uuid NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  filters           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(filters) = 'array'),
  aggregation       jsonb NOT NULL CHECK (
                      jsonb_typeof(aggregation) = 'object'
                      AND aggregation->>'fn' IN ('count','sum','avg','min','max')
                      -- everything but count reduces a named property
                      AND (aggregation->>'fn' = 'count' OR coalesce(aggregation->>'property','') <> '')
                    ),
  enabled           boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

CREATE INDEX IF NOT EXISTS idx_user_tools_org     ON public.user_tools (organization_id);
CREATE INDEX IF NOT EXISTS idx_user_tools_subject ON public.user_tools (subject_type_id);

ALTER TABLE public.user_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read user tools in scope" ON public.user_tools;
CREATE POLICY "members read user tools in scope" ON public.user_tools
  FOR SELECT
  USING (
    organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  );

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
  );
