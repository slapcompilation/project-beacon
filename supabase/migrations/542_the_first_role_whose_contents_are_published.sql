-- A fifth and sixth workflow mapping, and the first role whose CONTENTS a page
-- actually shows.
--
-- 540 seeded four mappings and said the catalogue "grows when a page names
-- another". The operator supplied the Upgrade Assistant pages, and
-- `upgrade-assistant/technical-maintenance-operators` names one outright:
--
--   "These users are known as Maintenance Operators who have a unique set of
--    permissions shown as the `Oversee progress in Upgrade Assistant` workflow
--    in Control Panel."
--
--   "By default, these permissions are associated with two roles: Organization
--    Administrator [and] Technical Compliance Officer… A user assigned to
--    either role will automatically receive the `Oversee progress in Upgrade
--    Assistant` workflow, designating them as a Maintenance Operator."
--
-- ── AND THE SCREENSHOT IS THE PANEL EXPANDED ────────────────────────────────
-- Every other Organization-permissions screenshot shows a role card COLLAPSED,
-- with a count and a `Show details` link — which is why the contents looked
-- unpublished. `upgrade-assistant/images/technical-compliance-officer-role.png`
-- is the same card with `Hide details` open, and under a **Workflows** heading
-- it lists exactly one row:
--
--   "Technical compliance officer · Default role
--    Primary point of contact for breaking change resolution and compliance tasks
--    Grants 1 workflow · Hide details
--    Workflows
--      Oversee progress in Upgrade assistant"
--
-- So a role's contents ARE published — one role at a time, wherever a page
-- happens to include an expanded card. That is the same point-of-use rule as
-- the prose mappings, applied to screenshots, and it is the first time the
-- catalogue has grown from an image rather than a sentence.
--
-- Two consequences beyond the mapping:
--
--   * `technical_compliance_officer` had NO workflows in 540's seed. It now has
--     its one, and the card confirms the count is one — so the role is complete
--     rather than partially known.
--   * its description in 540 was assembled from the permissions page's prose
--     ("Each Organization should have at least one user granted…"). The card
--     carries the product's own line, which is shorter and better, so it wins.

UPDATE public.organization_roles
   SET description = 'Primary point of contact for breaking change resolution and compliance tasks'
 WHERE organization_id IS NULL AND api_name = 'technical_compliance_officer';

INSERT INTO public.organization_role_workflows (role_id, workflow)
SELECT r.id, 'oversee_progress_in_upgrade_assistant'
  FROM public.organization_roles r
 WHERE r.organization_id IS NULL
   AND r.api_name IN ('technical_compliance_officer', 'organization_administrator')
ON CONFLICT DO NOTHING;

-- ── assertions, which run ───────────────────────────────────────────────────
DO $do$
DECLARE n int; d text;
BEGIN
  -- "associated with two roles" — both, not one.
  SELECT count(*) INTO n
    FROM public.organization_role_workflows w
    JOIN public.organization_roles r ON r.id = w.role_id
   WHERE w.workflow = 'oversee_progress_in_upgrade_assistant' AND r.organization_id IS NULL;
  IF n <> 2 THEN
    RAISE EXCEPTION 'the Maintenance Operator workflow is on % default role(s), expected 2', n;
  END IF;

  -- "Grants 1 workflow" — the card states the count, so the role is complete.
  SELECT count(*) INTO n
    FROM public.organization_role_workflows w
    JOIN public.organization_roles r ON r.id = w.role_id
   WHERE r.organization_id IS NULL AND r.api_name = 'technical_compliance_officer';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the Technical Compliance Officer carries % workflows; the card says 1', n;
  END IF;

  SELECT description INTO d FROM public.organization_roles
   WHERE organization_id IS NULL AND api_name = 'technical_compliance_officer';
  IF d IS NULL OR d NOT LIKE 'Primary point of contact%' THEN
    RAISE EXCEPTION 'the role still carries the assembled description rather than the card''s';
  END IF;

  RAISE NOTICE '542: the first role whose contents a page actually shows';
END $do$;
