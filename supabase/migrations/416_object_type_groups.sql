-- 416 — object type groups
--
-- Reading: docs/foundry-reference/readings/capabilities-value-types-and-groups.md
--          docs/ONTOLOGY-BUILD-MAP.md, phase B3
--
--   "Object type groups are a CLASSIFICATION PRIMITIVE that help users better
--    search and explore their ontology."     — object-link-types/type-groups
--
--   "To view object type groups, users must have VIEWER permission on THE
--    PROJECT that the object type group is in."
--
-- So a group lives in a project, like every other Compass resource, and its
-- visibility is the project's. The Groups screenshot gives the rest: a table of
-- NAME and NUMBER OF OBJECT TYPES, a detail panel with Content / Display /
-- Permissions tabs, and a RID in its footer —
--
--     ri.ontology.main.type-group.<uuid>
--
-- — which is the second attested ontology RID form after `object-type`.
--
-- Membership is editable from either end: "Groups can also be added directly to
-- object types by selecting Edit groups in the object type overview page."
--
-- WHAT A GROUP IS NOT: it is not a permission and not a namespace. Foundry made
-- that explicit when it replaced the tag-based system — "all groups will now be
-- discoverable to any user that can view the ontology", where previously a group
-- of invisible types was itself invisible. Names are transparent; contents are
-- filtered by the reader's own access.

BEGIN;

CREATE TABLE public.type_groups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_id    uuid NOT NULL REFERENCES public.ontologies(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                   REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- "the project that the object type group is in" — its home, and what its
  -- viewer permission is read from.
  project_id     uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,

  name           text NOT NULL CHECK (length(btrim(name)) > 0),
  description    text NOT NULL DEFAULT '',
  -- The Display tab. Each group's 2x2 icon is differently coloured in the
  -- screenshot, so appearance is configuration rather than derived.
  display        jsonb NOT NULL DEFAULT '{}'::jsonb,

  rid            text GENERATED ALWAYS AS (public.rid_of('ontology', 'type-group', id)) STORED,

  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (ontology_id, name)
);

COMMENT ON TABLE public.type_groups IS
  'A classification primitive for searching and exploring the ontology. Lives in a project, whose viewer permission governs it. RID ri.ontology.main.type-group.<uuid>, attested from the Groups screenshot.';

CREATE TABLE public.object_type_group_members (
  type_group_id  uuid NOT NULL REFERENCES public.type_groups(id) ON DELETE CASCADE,
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (type_group_id, object_type_id)
);

COMMENT ON TABLE public.object_type_group_members IS
  'Group membership, editable from either end — the Content tab of the group, or Edit groups on the object type overview.';

CREATE INDEX idx_type_groups_ontology ON public.type_groups (ontology_id);
CREATE INDEX idx_group_members_object_type ON public.object_type_group_members (object_type_id);

-- A group and its members belong to one ontology. Same shape as 412: a composite
-- key rather than a trigger restating it.
ALTER TABLE public.type_groups
  ADD CONSTRAINT type_groups_ontology_org_fkey
  FOREIGN KEY (ontology_id, organization_id)
  REFERENCES public.ontologies (id, organization_id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.guard_group_membership()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g uuid; o uuid;
BEGIN
  SELECT ontology_id INTO g FROM public.type_groups  WHERE id = NEW.type_group_id;
  SELECT ontology_id INTO o FROM public.object_types WHERE id = NEW.object_type_id;
  IF g IS DISTINCT FROM o THEN
    RAISE EXCEPTION 'Ontology:GroupCrossesOntologies — a group classifies object types of its own ontology'
      USING HINT = 'A group is a view onto one ontology, not a way to span two.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_group_membership
  BEFORE INSERT OR UPDATE ON public.object_type_group_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_group_membership();

-- ── access ───────────────────────────────────────────────────────────────────
-- "users must have viewer permission on the project that the object type group
--  is in" — so the read follows the project, not the group.

ALTER TABLE public.type_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_type_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read groups in visible projects" ON public.type_groups
  FOR SELECT USING (
    NOT (organization_id IS DISTINCT FROM public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);

CREATE POLICY "editors write groups" ON public.type_groups
  FOR ALL USING (
    NOT (organization_id IS DISTINCT FROM public.auth_org_id())
    AND (public.auth_role() IN ('owner','admin')
         OR public.project_role(project_id) IN ('owner','editor')))
  WITH CHECK (
    NOT (organization_id IS DISTINCT FROM public.auth_org_id())
    AND (public.auth_role() IN ('owner','admin')
         OR public.project_role(project_id) IN ('owner','editor')));

CREATE POLICY "read membership of visible groups" ON public.object_type_group_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.type_groups g WHERE g.id = type_group_id));

CREATE POLICY "editors write membership" ON public.object_type_group_members
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.type_groups g WHERE g.id = type_group_id
      AND (public.auth_role() IN ('owner','admin')
           OR public.project_role(g.project_id) IN ('owner','editor'))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.type_groups g WHERE g.id = type_group_id
      AND (public.auth_role() IN ('owner','admin')
           OR public.project_role(g.project_id) IN ('owner','editor'))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.type_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.object_type_group_members TO authenticated;

-- ── assertions ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; ont uuid; ont2 uuid; sp2 uuid; proj uuid;
  g uuid; t1 uuid; t2 uuid; foreign_t uuid;
  usr uuid := gen_random_uuid(); claims text; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO auth.users (id, email) VALUES (usr, '416@beacon.test');
  INSERT INTO public.organizations (name) VALUES ('m416') RETURNING id INTO org;
  INSERT INTO public.spaces (name) VALUES ('m416') RETURNING id INTO sp;
  INSERT INTO public.spaces (name) VALUES ('m416 dev') RETURNING id INTO sp2;
  INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org), (sp2, org);
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp, org, 'm416', 'm416') RETURNING id INTO ont;
  INSERT INTO public.ontologies (space_id, organization_id, api_name, label)
       VALUES (sp2, org, 'm416dev', 'm416 dev') RETURNING id INTO ont2;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm416', 'm416') RETURNING id INTO proj;

  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Purchases', 'Purchases') RETURNING id INTO t1;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont, 'Customer', 'Customer') RETURNING id INTO t2;
  INSERT INTO public.object_types (organization_id, ontology_id, api_name, label)
       VALUES (org, ont2, 'Elsewhere', 'Elsewhere') RETURNING id INTO foreign_t;

  INSERT INTO public.type_groups (ontology_id, organization_id, project_id, name)
       VALUES (ont, org, proj, 'Grocery Management') RETURNING id INTO g;

  IF (SELECT rid FROM public.type_groups WHERE id = g)
     <> 'ri.ontology.main.type-group.' || g::text THEN
    RAISE EXCEPTION 'Migration 416: the type group RID is not the attested form';
  END IF;

  INSERT INTO public.object_type_group_members (type_group_id, object_type_id)
       VALUES (g, t1), (g, t2);

  -- The count the Groups table shows.
  SELECT count(*) INTO n FROM public.object_type_group_members WHERE type_group_id = g;
  IF n <> 2 THEN RAISE EXCEPTION 'Migration 416: membership did not record'; END IF;

  -- "A group is a view onto one ontology, not a way to span two."
  BEGIN
    INSERT INTO public.object_type_group_members (type_group_id, object_type_id)
         VALUES (g, foreign_t);
    RAISE EXCEPTION 'Migration 416: a group took an object type from another ontology';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Ontology:GroupCrossesOntologies%' THEN RAISE; END IF;
  END;

  -- One name per ontology, so two groups cannot both be "Grocery Management".
  BEGIN
    INSERT INTO public.type_groups (ontology_id, organization_id, project_id, name)
         VALUES (ont, org, proj, 'Grocery Management');
    RAISE EXCEPTION 'Migration 416: a duplicate group name was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Deleting an object type removes it from its groups; deleting the group does
  -- not touch the types. Membership is a classification, not ownership.
  DELETE FROM public.object_types WHERE id = t2;
  SELECT count(*) INTO n FROM public.object_type_group_members WHERE type_group_id = g;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Migration 416: deleting an object type left a dangling membership';
  END IF;

  -- Readable as the role the product runs as, through the project.
  claims := json_build_object('sub', usr::text, 'app_metadata',
              json_build_object('org_id', org::text, 'role', 'admin'))::text;
  PERFORM set_config('request.jwt.claims', claims, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.type_groups WHERE id = g;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Migration 416: authenticated cannot see a group in its own project';
  END IF;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);

  DELETE FROM public.object_type_group_members WHERE type_group_id = g;
  DELETE FROM public.type_groups WHERE id = g;
  DELETE FROM public.object_types WHERE ontology_id IN (ont, ont2);
  DELETE FROM public.ontologies WHERE id IN (ont, ont2);
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.space_organizations WHERE space_id IN (sp, sp2);
  DELETE FROM public.spaces WHERE id IN (sp, sp2);
  DELETE FROM public.organizations WHERE id = org;
  DELETE FROM auth.users WHERE id = usr;
END $$;

COMMIT;
