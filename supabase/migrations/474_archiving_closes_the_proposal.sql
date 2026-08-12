-- Archiving a branch closes its open proposal.
--
--   "Note that archiving a branch with an open proposal will also close that
--    proposal."                            (global-branching/application)
--   "Archived: A branch that is no longer being worked on; archiving is
--    always manual."                       (global-branching/core-concepts)
--
-- 419's lifecycle guard already rules the transitions (merged terminal,
-- archived restores to active only); this is the one side effect the pages
-- attach to the archive act. De-indexing and data deletion on inactive
-- branches remain out of scope — nothing here runs on a timer by design.

CREATE OR REPLACE FUNCTION public.close_proposals_on_archive()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'archived' AND OLD.status IS DISTINCT FROM 'archived' THEN
    UPDATE public.ontology_proposals
       SET status = 'closed'
     WHERE branch_id = NEW.id AND status = 'open';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER close_proposals_on_archive
  AFTER UPDATE OF status ON public.ontology_branches
  FOR EACH ROW EXECUTE FUNCTION public.close_proposals_on_archive();

-- ── assertion, as authenticated ─────────────────────────────────────────────
DO $$
DECLARE
  org uuid; sp uuid; ont uuid; b uuid; t uuid := gen_random_uuid(); pr uuid;
  usr uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('arc-474') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','arc474@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'arc474@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('Arc474');
  INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
  VALUES (sp, 'arc474', 'Arc 474', false) RETURNING id INTO ont;
  INSERT INTO public.ontology_branches (ontology_id, name, title)
  VALUES (ont, 'arc-474', 'Arc 474') RETURNING id INTO b;
  PERFORM public.stage_change('object_type', t,
    jsonb_build_object('api_name', 'Arc474T', 'label', 'T', 'ontology_id', ont), b, 'created');
  INSERT INTO public.branch_resource_changes (branch_id, resource_kind, resource_id, operation, fields, authors)
  SELECT b, 'object_type', t, 'created', jsonb_build_object('api_name','Arc474T'), ARRAY[usr];
  DELETE FROM public.working_state_changes WHERE branch_id = b;
  pr := public.create_proposal(b, 'Arc 474', '');

  UPDATE public.ontology_branches SET status = 'archived' WHERE id = b;
  IF (SELECT status FROM public.ontology_proposals WHERE id = pr) <> 'closed' THEN
    RAISE EXCEPTION 'assertion failed: archiving must close the open proposal';
  END IF;

  -- And restore brings the branch back — the proposal stays closed.
  UPDATE public.ontology_branches SET status = 'active' WHERE id = b;
  IF (SELECT status FROM public.ontology_proposals WHERE id = pr) <> 'closed' THEN
    RAISE EXCEPTION 'assertion failed: restore must not reopen the proposal';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', before, true);
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM <> 'rollback assertions' THEN RAISE; END IF;
END $$;
