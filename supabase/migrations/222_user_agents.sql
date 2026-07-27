-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 222 — authored agents (Phase 5)
--
-- A shipped agent is a folder of code. An authored agent is the same shape as
-- data: purpose, scope, cadence, a bounded toolset picked from the registry, and
-- a numbered procedure. reality-graph/authoredAgents compiles it into exactly
-- what runToolLoop already consumes — nothing new executes it, and the existing
-- release + auto-execution gates still govern it.
--
-- Same authoring shape as 213 automations / 214 object types / 221 user tools:
-- org-scoped member read, admin/owner authoring, org + author from DEFAULTs.
--
-- Enum-ish CHECKs live here too, so the database is the last word on what an
-- agent may be — not the composer.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_agents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id          uuid REFERENCES hotels(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  api_name          text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  purpose           text NOT NULL CHECK (length(btrim(purpose)) > 0),
  scope             text NOT NULL DEFAULT 'hotel'  CHECK (scope IN ('hotel','organization')),
  cadence           text NOT NULL DEFAULT 'daily'  CHECK (cadence IN ('on-event','hourly','daily','weekly','monthly')),
  approval          text NOT NULL DEFAULT 'review' CHECK (approval IN ('review','auto')),
  -- An agent with no tools can only guess; a procedure with no steps is a prompt.
  toolset           jsonb NOT NULL CHECK (jsonb_typeof(toolset) = 'array' AND jsonb_array_length(toolset) > 0),
  procedure         jsonb NOT NULL CHECK (jsonb_typeof(procedure) = 'array' AND jsonb_array_length(procedure) > 0),
  clarification_threshold numeric NOT NULL DEFAULT 0.6
                      CHECK (clarification_threshold >= 0 AND clarification_threshold <= 1),
  enabled           boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

CREATE INDEX IF NOT EXISTS idx_user_agents_org ON public.user_agents (organization_id);

ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read user agents in scope" ON public.user_agents;
CREATE POLICY "members read user agents in scope" ON public.user_agents
  FOR SELECT
  USING (
    organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
  );

DROP POLICY IF EXISTS "admins author user agents in scope" ON public.user_agents;
CREATE POLICY "admins author user agents in scope" ON public.user_agents
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
