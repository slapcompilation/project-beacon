-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 396 — the RIDs 391 withheld, now that they are attested.
--
-- 391 gave five resource types a RID and withheld five, because no page in the
-- mirror showed a form and inventing one is how object_type_impact came back.
-- The operator searched and named six pages. Four of the five gaps are now
-- closed, and three of those four answers were only in a screenshot.
-- Full reading: docs/foundry-reference/readings/rid-grammar.md
--
-- THE GRAMMAR WAS OVER-GENERALISED. 391 recorded
-- `ri.<service>.<instance>.<type>.<locator>` from ~160 examples that all used
-- `main`. **The instance segment can be empty**, and four services use it so:
--
--     ri.magritte..source.<uuid>
--     ri.language-model-service..language-model.<uuid>
--     ri.actions..scenario.<uuid>
--     ri.multipass..organization.<uuid>
--
-- Two consecutive dots. The segment count is unchanged, so rid_locator still
-- inverts it — asserted below rather than assumed.
--
-- WHAT WAS FOUND, and where:
--
--   organization  ri.multipass..organization.<uuid>
--                 platform-security-management/images/manage-organizations.png.
--                 The panel is headed "Organization IDs", plural: a MARKING ID
--                 (a bare uuid) and a RESOURCE ID (the RID). Two identities,
--                 because "Like markings, organizations are a mandatory access
--                 control" — it is a marking to the access system and a resource
--                 to the platform. We build the RID only; the Marking ID belongs
--                 to a markings system we do not have.
--
--   project       ri.compass.main.folder.<uuid>  — NOT ri.compass.main.project.
--                 data-integration/foundry-s3-api: "Both projects and folders
--                 use the RID format ri.compass.main.folder.{RID_VALUE}, so the
--                 format alone does not distinguish them." A project is a folder
--                 at the RID level, and the same page warns that passing a
--                 nested folder's RID fails "even though the RID has the
--                 expected format" — so the identifier does not encode
--                 project-ness and a consumer must check, not parse.
--
--   interface     ri.ontology.main.interface.<uuid>
--                 interfaces/images/implement-from-interface-overview.png, and
--                 interface-metadata: "An automatically generated unique
--                 identifier for every resource in Palantir."
--
-- WHAT IS STILL WITHHELD, deliberately:
--
--   link type     create-link-type has four steps and every screenshot on it;
--                 no identifier appears but the API name, which is per-SIDE and
--                 scoped to the source object type (`Flight.assignedAircraft`).
--   shared        The wizard shows Name/Description/Aliases/API name and no RID.
--   property      The page does say struct FIELDS keep "their original RIDs", so
--                 one very likely exists — which is exactly why it is not guessed.
--
-- Two independent checks have now come back "no" for both. That is evidence,
-- not an absence of it, but it is still not a citation.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- The instance becomes an argument. The three-argument form stays, defaulting to
-- `main`, so the generated columns in 391 and 392 keep resolving to it.
CREATE OR REPLACE FUNCTION public.rid_of(p_service text, p_instance text, p_type text, p_id uuid)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT 'ri.' || p_service || '.' || p_instance || '.' || p_type || '.' || p_id::text
$$;

COMMENT ON FUNCTION public.rid_of(text, text, text, uuid) IS
  'Build a resource identifier: ri.<service>.<instance>.<type>.<uuid>. The instance may be empty — ri.multipass..organization is attested. Grammar inferred from examples; no page states it.';

ALTER TABLE public.organizations
  ADD COLUMN rid text
  GENERATED ALWAYS AS (public.rid_of('multipass', '', 'organization', id)) STORED;

-- A project is a folder. The type segment says `folder` on purpose.
ALTER TABLE public.projects
  ADD COLUMN rid text
  GENERATED ALWAYS AS (public.rid_of('compass', 'main', 'folder', id)) STORED;

ALTER TABLE public.ontology_interfaces
  ADD COLUMN rid text
  GENERATED ALWAYS AS (public.rid_of('ontology', 'main', 'interface', id)) STORED;

COMMENT ON COLUMN public.organizations.rid IS
  'ri.multipass..organization.<id> — empty instance segment, as Control Panel shows it. Foundry also gives an organization a separate MARKING ID, because an organization is a marking; we have no markings system, so that identifier is not modelled.';
COMMENT ON COLUMN public.projects.rid IS
  'ri.compass.main.folder.<id>. A project IS a folder at the RID level: "Both projects and folders use the RID format ri.compass.main.folder.{RID_VALUE}, so the format alone does not distinguish them." Never parse project-ness out of a RID.';
COMMENT ON COLUMN public.ontology_interfaces.rid IS
  'ri.ontology.main.interface.<id>. Same service and instance as object types.';

CREATE UNIQUE INDEX organizations_rid_key       ON public.organizations (rid);
CREATE UNIQUE INDEX projects_rid_key            ON public.projects (rid);
CREATE UNIQUE INDEX ontology_interfaces_rid_key ON public.ontology_interfaces (rid);

DO $$
DECLARE r text; n int;
BEGIN
  -- Each new form, against the string actually seen.
  IF public.rid_of('multipass', '', 'organization', '9490010f-0000-0000-0000-000000000000')
     <> 'ri.multipass..organization.9490010f-0000-0000-0000-000000000000'
  THEN RAISE EXCEPTION 'Migration 396: the empty instance segment is wrong'; END IF;

  IF public.rid_of('compass', 'main', 'folder', '00000000-0000-0000-0000-000000000001')
     <> 'ri.compass.main.folder.00000000-0000-0000-0000-000000000001'
  THEN RAISE EXCEPTION 'Migration 396: the project/folder form is wrong'; END IF;

  IF public.rid_of('actions', 'main', 'action-type', '00000000-0000-0000-0000-000000000002')
     <> 'ri.actions.main.action-type.00000000-0000-0000-0000-000000000002'
  THEN RAISE EXCEPTION 'Migration 396: the action-type form is wrong'; END IF;

  -- The three-argument form must still mean `main`, or 391's and 392's
  -- generated columns silently change shape.
  IF public.rid_of('ontology', 'object-type', '00000000-0000-0000-0000-000000000003')
     <> 'ri.ontology.main.object-type.00000000-0000-0000-0000-000000000003'
  THEN RAISE EXCEPTION 'Migration 396: the 3-argument form no longer defaults to main'; END IF;

  -- rid_locator splits on '.' and takes the fifth field. An empty instance keeps
  -- the segment count, so it should still invert — but it is the kind of thing
  -- that is obviously fine right up until it is not.
  r := public.rid_of('multipass', '', 'organization', '00000000-0000-0000-0000-000000000004');
  IF public.rid_locator(r) <> '00000000-0000-0000-0000-000000000004'::uuid
  THEN RAISE EXCEPTION 'Migration 396: rid_locator does not survive an empty instance'; END IF;

  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'rid' AND is_generated = 'ALWAYS'
     AND table_name IN ('organizations','projects','ontology_interfaces');
  IF n <> 3 THEN RAISE EXCEPTION 'Migration 396: expected 3 new generated rid columns, found %', n; END IF;

  -- The two still withheld must stay withheld. If a later migration adds one
  -- without a citation, this is where it gets caught.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND column_name = 'rid'
                AND table_name IN ('link_types','shared_properties'))
  THEN RAISE EXCEPTION 'Migration 396: link_types or shared_properties gained a RID, and no page attests one';
  END IF;
END $$;

COMMIT;
