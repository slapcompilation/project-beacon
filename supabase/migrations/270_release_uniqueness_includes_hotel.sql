-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 270 — uniqueness has to know about the property too.
--
-- 269 gave a release a hotel; uniq_agent_release_current_per_stage still keyed
-- on (organization, agent, stage), so an org-wide production release and a
-- canary at one property collided and per-hotel releases were impossible in
-- practice.
--
-- The probe for 269 missed this and the contract test caught it: existing
-- releases carry organization_id NULL, so the probe's org-scoped canary landed
-- in a different key bucket by accident. C27 built both rows explicitly and
-- collided immediately. A test that constructs its own fixtures beats a probe
-- that borrows whatever is lying around.
--
-- One current release per (organization, property, agent, stage) — which is
-- exactly what "a release may target one property" means.
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.uniq_agent_release_current_per_stage;

CREATE UNIQUE INDEX uniq_agent_release_current_per_stage
  ON public.agent_releases (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(hotel_id,        '00000000-0000-0000-0000-000000000000'::uuid),
    agent_name, stage)
  WHERE superseded_at IS NULL;

COMMENT ON INDEX public.uniq_agent_release_current_per_stage IS
  'One current release per (organization, property, agent, stage). The hotel is part of the key because a canary at one property coexists with the org-wide release the rest still run.';
