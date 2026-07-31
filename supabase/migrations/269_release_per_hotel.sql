-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 269 — a release may target one property. Tier 4.2.
--
-- Audit §9.2: Foundry's release channels gate WHICH INSTALLATIONS receive a
-- version. Ours gated only which STAGE an artifact reached, and agent_releases
-- carried no hotel at all — so promoting to production promoted everywhere in
-- the organization simultaneously.
--
-- For a product whose multi-echelon model is a headline feature, the release
-- path was the one place the echelon disappeared. And since these agents propose
-- actions that spend money, a canary property is the obvious safety mechanism we
-- did not have.
--
-- Specificity wins: a release targeting a hotel beats an org-wide one, which
-- beats a global one. That is the same precedence the rest of the system already
-- uses — "hotel-scoped overrides org-scoped" is in CLAUDE.md as a rule for
-- contracts and policy; the release path now obeys it too.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.agent_releases
  ADD COLUMN IF NOT EXISTS hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.agent_releases.hotel_id IS
  'The property this release is for. NULL = every hotel in the organization. A hotel-targeted release wins over an org-wide one, so a chain can canary a version at one property before it spends money at twelve.';

CREATE INDEX IF NOT EXISTS idx_agent_releases_hotel ON public.agent_releases (hotel_id) WHERE hotel_id IS NOT NULL;

-- ── The resolver learns the echelon ──────────────────────────────────────────
-- Defaulted parameter, so the existing no-arg callers keep working.

CREATE OR REPLACE FUNCTION public.get_current_agent_releases(p_hotel_id uuid DEFAULT auth_hotel_id())
RETURNS TABLE(agent_name text, stage text, version text, tag text, eval_pass_rate numeric,
              eval_case_count integer, released_at timestamptz, notes text, hotel_id uuid)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH ranked AS (
    SELECT r.*,
      row_number() OVER (
        PARTITION BY r.agent_name, r.stage
        ORDER BY
          -- Most specific first: this hotel, then the org, then global.
          (r.hotel_id IS NOT NULL AND r.hotel_id = p_hotel_id) DESC,
          (r.organization_id = auth_org_id()) DESC NULLS LAST,
          r.released_at DESC
      ) AS rn
    FROM agent_releases r
    WHERE r.superseded_at IS NULL
      AND (r.organization_id IS NULL OR r.organization_id = auth_org_id())
      -- A release aimed at ANOTHER hotel is not a candidate here. Without this
      -- a canary would still be visible to its siblings, which is the whole
      -- thing being fixed.
      AND (r.hotel_id IS NULL OR r.hotel_id = p_hotel_id)
  )
  SELECT agent_name, stage, version, tag, eval_pass_rate, eval_case_count, released_at, notes, hotel_id
  FROM ranked WHERE rn = 1
  ORDER BY agent_name, stage;
$$;

COMMENT ON FUNCTION public.get_current_agent_releases(uuid) IS
  'Releases in force at one property. Specificity wins: a hotel-targeted release beats an org-wide one, and a release aimed at another hotel is not a candidate at all.';

-- ── Promotion can aim at a property ──────────────────────────────────────────
-- Dropped and recreated rather than overloaded: two promote_agent signatures
-- differing only by a trailing default is an ambiguity waiting to be called.

DROP FUNCTION IF EXISTS public.promote_agent(text, text, text, numeric, integer, text, uuid);

CREATE OR REPLACE FUNCTION public.promote_agent(
  p_agent_name text, p_version text, p_target_stage text,
  p_eval_pass_rate numeric DEFAULT NULL, p_eval_case_count integer DEFAULT NULL,
  p_notes text DEFAULT NULL, p_organization_id uuid DEFAULT NULL,
  p_hotel_id uuid DEFAULT NULL
) RETURNS public.agent_releases
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid := coalesce(p_organization_id, auth_org_id());
  v_row public.agent_releases;
BEGIN
  IF auth_role() NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Only owner or admin may promote an agent' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_hotel_id IS NOT NULL AND NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'Cannot release to a property outside your scope' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gap D, unchanged: production requires a prior staging release of the same
  -- version. A canary does not get to skip the ladder.
  IF p_target_stage = 'production' AND NOT EXISTS (
    SELECT 1 FROM agent_releases r
    WHERE r.agent_name = p_agent_name AND r.version = p_version AND r.stage = 'staging'
      AND (r.organization_id IS NULL OR r.organization_id = v_org)
  ) THEN
    RAISE EXCEPTION 'Version % of % has no staging release; promote to staging first', p_version, p_agent_name;
  END IF;

  -- Supersede only the releases this one replaces: same target, not the org-wide
  -- row when a hotel is being canaried.
  UPDATE agent_releases r SET superseded_at = now()
   WHERE r.agent_name = p_agent_name AND r.stage = p_target_stage
     AND r.superseded_at IS NULL
     AND r.organization_id IS NOT DISTINCT FROM v_org
     AND r.hotel_id IS NOT DISTINCT FROM p_hotel_id;

  INSERT INTO agent_releases
    (organization_id, hotel_id, agent_name, version, stage, eval_pass_rate, eval_case_count, notes, released_by_user_id)
  VALUES (v_org, p_hotel_id, p_agent_name, p_version, p_target_stage, p_eval_pass_rate, p_eval_case_count, p_notes, auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.promote_agent(text, text, text, numeric, integer, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_agent(text, text, text, numeric, integer, text, uuid, uuid) TO authenticated;

COMMIT;
