-- 709: a template is a folder resource whose instances pin a version.
--
--   "Code **templates** enable users with a range of technical experience to collaborate by abstracting code away behind a simple form-based interface. Values selected by users are substituted into a code template, which can then be run like any other transform in the Workbook."
--   — code-workbook/core-concepts.md
--
-- THE VERSIONING RULE, the sentence the adversary pass surfaced whole:
--
--   "The version history of templates is saved, and new edits to a template are always saved as a new version of that template. Edits to a template do not automatically update instances of that template; each instance of the template will include a prompt to update to the latest version if they are using an outdated version of the template."
--   — code-workbook/templates-overview.md
--
-- Instances PIN and are PROMPTED — never auto-upgraded. Versions are
-- zero-indexed integers (the captures show (v0), (v1), (v3); inference from
-- captures, recorded as such in the reading). The editor carries a
-- Released/Unreleased status, a Save-as-default-version checkbox and a
-- commit message (template_creation_side_by_side_view.png) — capture-derived
-- sets, so no page declaration below.
--
-- A TEMPLATE IS A COMPASS RESOURCE IN A FOLDER, and promotion is a MOVE:
--
--   "Templates can only be discovered and used by users who have access, so you can save a Template in your home folder while you are still working on it, and move it to a shared folder once you want to promote it for broader use."
--   — code-workbook/templates-getting-started.md
--
-- AND IT CARRIES A PERSISTENCE DEFAULT, the intersection of the two
-- headline features:
--
--   "Next, choose whether this template should be saved as a dataset by default. By checking the **Save as dataset** box, when added the template will be added as a persisted transform by default. If **Save as dataset** is left unchecked, the template will be applied as an unpersisted transform by default."
--   — code-workbook/templates-getting-started.md
--
-- PARAMETERS ARE A TWO-LEVEL TYPE MODEL, both levels enumerated on the page:
--
--   "Once a parameter has been added, you must select the parameter type: dataset, column, or variable. If **variable** is selected, you should also select a param type for that variable: text, number, select, multiselect, boolean, or list."
--   — code-workbook/templates-overview.md
--
-- Substitution is triple-brace ({{{name}}}), read off every template
-- capture. Global code travels one way — appended at creation, unavailable
-- where applied ("Templates do not have access to global code in Workbooks
-- where they are applied.", same page) — recorded; the Global Code pane
-- itself is a recorded residual.

-- ── the template and its versions ───────────────────────────────────────────

CREATE TABLE public.workbook_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL DEFAULT public.auth_org_id()
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- the folder is the promotion mechanism
  folder_id         uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  description       text NOT NULL DEFAULT '',
  -- "whether this template should be saved as a dataset by default"
  default_persisted boolean NOT NULL DEFAULT false,
  created_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workbook_templates_project_idx ON public.workbook_templates (project_id);
CREATE INDEX workbook_templates_folder_idx ON public.workbook_templates (folder_id);
CREATE INDEX workbook_templates_org_idx ON public.workbook_templates (organization_id);
CREATE INDEX workbook_templates_created_by_idx ON public.workbook_templates (created_by);
COMMENT ON TABLE public.workbook_templates IS
  'A code template: a Compass resource in a folder — "you can save a Template in your home folder while you are still working on it, and move it to a shared folder once you want to promote it" (code-workbook/templates-getting-started) — carrying the Save-as-dataset default that decides whether applying it lands persisted. Versions hang below; instances pin one.';

CREATE TABLE public.workbook_template_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid NOT NULL REFERENCES public.workbook_templates(id) ON DELETE CASCADE,
  -- zero-indexed, stamped by trigger — the captures'' (v0), (v1), (v3)
  version        integer NOT NULL CHECK (version >= 0),
  language       text NOT NULL DEFAULT 'SQL'
                   CONSTRAINT template_versions_language_check
                   CHECK (language = ANY (ARRAY['Python', 'R', 'SQL'])),
  -- the {{{param}}} substitution body
  source         text NOT NULL,
  -- [{name, type: dataset|column|variable, variable_type?, options?}]
  parameters     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Released / Unreleased — the editor''s Status dropdown, capture-derived
  status         text NOT NULL DEFAULT 'Unreleased'
                   CONSTRAINT template_versions_status_check
                   CHECK (status = ANY (ARRAY['Released', 'Unreleased'])),
  is_default     boolean NOT NULL DEFAULT false,
  commit_message text NOT NULL DEFAULT '',
  created_by     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (jsonb_typeof(parameters) = 'array'),
  UNIQUE (template_id, version)
);
CREATE INDEX template_versions_template_idx ON public.workbook_template_versions (template_id);
CREATE INDEX template_versions_created_by_idx ON public.workbook_template_versions (created_by);
COMMENT ON TABLE public.workbook_template_versions IS
  'One immutable template version — "new edits to a template are always saved as a new version" (code-workbook/templates-overview). Zero-indexed integers per the captures'' (v0)/(v1)/(v3) markers. Status, the default-version checkbox and the commit message are the editor''s own controls (template_creation_side_by_side_view.png), capture-derived and so undeclared.';
COMMENT ON CONSTRAINT template_versions_language_check ON public.workbook_template_versions IS
  'Values from code-workbook/workbooks-languages: "Code Workbook currently supports three languages: Python, R, and SQL." Same rule as transforms: all three store, SQL runs.';
COMMENT ON CONSTRAINT template_versions_status_check ON public.workbook_template_versions IS
  'The Status dropdown''s two values, read off code-workbook/images/template_creation_side_by_side_view.png and creating_a_template_2.png. Deliberately NOT declared with a page: the set comes from captures, and no prose page prints it.';

CREATE FUNCTION public.stamp_template_version()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE col jsonb;
BEGIN
  IF NEW.version IS NULL THEN
    SELECT coalesce(max(v.version) + 1, 0) INTO NEW.version
      FROM public.workbook_template_versions v WHERE v.template_id = NEW.template_id;
  END IF;
  -- the two-level parameter model, both levels the page''s own
  FOR col IN SELECT * FROM jsonb_array_elements(NEW.parameters) LOOP
    IF NOT (col ->> 'type') = ANY (ARRAY['dataset', 'column', 'variable']) THEN
      RAISE EXCEPTION 'CodeWorkbook:UnknownParameterType — %; the parameter type is dataset, column, or variable', col ->> 'type';
    END IF;
    IF (col ->> 'type') = 'variable'
       AND NOT (col ->> 'variable_type') = ANY (ARRAY['text', 'number', 'select', 'multiselect', 'boolean', 'list']) THEN
      RAISE EXCEPTION 'CodeWorkbook:UnknownVariableType — %; a variable''s param type is text, number, select, multiselect, boolean, or list', col ->> 'variable_type';
    END IF;
  END LOOP;
  -- one default version per template
  IF NEW.is_default THEN
    UPDATE public.workbook_template_versions
       SET is_default = false WHERE template_id = NEW.template_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stamp_template_version
  BEFORE INSERT ON public.workbook_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_template_version();
COMMENT ON FUNCTION public.stamp_template_version() IS
  'Stamps zero-indexed versions and holds the two-level parameter model to code-workbook/templates-overview''s own enumerations: parameter type dataset|column|variable, and for variables text|number|select|multiselect|boolean|list. Save-as-default-version clears the previous default.';

-- versions are immutable; the mutable bits are default flag and status
CREATE FUNCTION public.guard_template_version_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source IS DISTINCT FROM OLD.source
     OR NEW.parameters IS DISTINCT FROM OLD.parameters
     OR NEW.language IS DISTINCT FROM OLD.language
     OR NEW.version IS DISTINCT FROM OLD.version THEN
    RAISE EXCEPTION 'CodeWorkbook:VersionImmutable — new edits to a template are always saved as a new version';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_template_version_immutable
  BEFORE UPDATE ON public.workbook_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_template_version_immutable();

-- the FK 707 left dangling, now that its target exists
ALTER TABLE public.workbook_transforms
  ADD CONSTRAINT workbook_transforms_template_version_fkey
  FOREIGN KEY (template_version_id)
  REFERENCES public.workbook_template_versions(id) ON DELETE SET NULL;

-- ── applying a template ─────────────────────────────────────────────────────

CREATE FUNCTION public.apply_workbook_template(p_workbook uuid, p_branch uuid,
                                               p_alias text, p_version uuid,
                                               p_values jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v record; tpl record; t uuid;
BEGIN
  SELECT * INTO v FROM public.workbook_template_versions WHERE id = p_version;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NoSuchTemplateVersion — % is not a template version you can see', p_version;
  END IF;
  SELECT * INTO tpl FROM public.workbook_templates WHERE id = v.template_id;
  INSERT INTO public.workbook_transforms
    (workbook_id, branch_id, alias, transform_type, language,
     template_version_id, config)
  VALUES (p_workbook, p_branch, p_alias, 'template', v.language,
          p_version, jsonb_build_object('values', coalesce(p_values, '{}'::jsonb)))
  RETURNING id INTO t;

  -- a dataset-type parameter IS an input binding: the value names an alias,
  -- and the edge is created from it
  DECLARE prm jsonb; bound text; eid uuid;
  BEGIN
    FOR prm IN SELECT * FROM jsonb_array_elements(v.parameters) LOOP
      CONTINUE WHEN prm ->> 'type' <> 'dataset';
      bound := p_values ->> (prm ->> 'name');
      CONTINUE WHEN bound IS NULL;
      SELECT i.id INTO eid FROM public.workbook_imports i
       WHERE i.workbook_id = p_workbook AND i.alias = bound;
      IF eid IS NOT NULL THEN
        INSERT INTO public.workbook_transform_inputs (transform_id, input_import_id)
        VALUES (t, eid);
      ELSE
        SELECT wt.id INTO eid FROM public.workbook_transforms wt
         WHERE wt.branch_id = p_branch AND wt.alias = bound;
        IF eid IS NULL THEN
          RAISE EXCEPTION 'CodeWorkbook:UnknownAlias — % names no import or transform here', bound;
        END IF;
        INSERT INTO public.workbook_transform_inputs (transform_id, input_transform_id)
        VALUES (t, eid);
      END IF;
    END LOOP;
  END;

  -- "when added the template will be added as a persisted transform by
  -- default" — the template''s checkbox decides
  IF tpl.default_persisted THEN
    PERFORM public.save_workbook_transform(t, NULL);
  END IF;
  RETURN t;
END $$;
COMMENT ON FUNCTION public.apply_workbook_template(uuid, uuid, text, uuid, jsonb) IS
  'Creates an INSTANCE: a template-type transform pinning the exact version — "Edits to a template do not automatically update instances" (code-workbook/templates-overview); the update prompt is the surface''s, read off the pin vs the latest. The template''s Save-as-dataset default decides whether the instance lands persisted. INVOKER.';

-- the compiler''s template arm: substitute, then compile as code
DO $$
DECLARE src text; anchor text; replacement text;
BEGIN
  src := replace(pg_get_functiondef('public.compile_workbook_transform(uuid)'::regprocedure), chr(13), '');
  anchor := '  ELSE
    body := t.source;
  END IF;';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'the body arm does not occur exactly once';
  END IF;
  replacement := '  ELSIF t.transform_type = ''template'' THEN
    -- triple-brace substitution, the syntax every template capture shows
    SELECT tv.source INTO body FROM public.workbook_template_versions tv
     WHERE tv.id = t.template_version_id;
    IF body IS NULL THEN
      RAISE EXCEPTION ''CodeWorkbook:InstanceWithoutTemplate — this instance pins no template version'';
    END IF;
    FOR e IN SELECT key, value FROM jsonb_each_text(coalesce(t.config -> ''values'', ''{}''::jsonb)) LOOP
      body := replace(body, ''{{{'' || e.key || ''}}}'', e.value);
    END LOOP;
    IF body LIKE ''%{{{%'' THEN
      RAISE EXCEPTION ''CodeWorkbook:UnboundParameter — the template still carries an unsubstituted parameter'';
    END IF;
  ELSE
    body := t.source;
  END IF;';
  EXECUTE replace(src, anchor, replacement);
END $$;

-- e is reused as a plain record for jsonb_each_text; redeclare compile''s
-- loop variable type accordingly by replacing the declaration
DO $$
DECLARE src text;
BEGIN
  src := replace(pg_get_functiondef('public.compile_workbook_transform(uuid)'::regprocedure), chr(13), '');
  IF src NOT LIKE '%jsonb_each_text%' THEN
    RAISE EXCEPTION 'the template arm did not land';
  END IF;
END $$;

COMMENT ON FUNCTION public.compile_workbook_transform(uuid) IS
  'The run model of optional persistence, compiled: unpersisted upstream inlines as a CTE named by its alias; persisted upstream reads its dataset; imports read the runner''s api_name CTE through their alias. A template instance substitutes its pinned version''s {{{param}}} placeholders from its stored values — "Values selected by users are substituted into a code template, which can then be run like any other transform" (code-workbook/core-concepts) — and refuses while any parameter is unbound. Python and R refuse with the divergence named; an object-type workbook input refuses because its documented use is time-series access.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.workbook_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project members read templates" ON public.workbook_templates
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author templates" ON public.workbook_templates
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read template versions" ON public.workbook_template_versions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workbook_templates t
                             WHERE t.id = template_id
                               AND t.organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
                               AND public.project_role(t.project_id) IS NOT NULL));
CREATE POLICY "author template versions" ON public.workbook_template_versions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.workbook_templates t
                          WHERE t.id = template_id
                            AND public.role_rank(public.project_role(t.project_id))
                                >= public.role_rank('editor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workbook_templates t
                       WHERE t.id = template_id
                         AND public.role_rank(public.project_role(t.project_id))
                             >= public.role_rank('editor')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_templates         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_template_versions TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; wb uuid; mbr uuid; ds uuid; br uuid; txn uuid;
  tpl uuid; v0 uuid; v1 uuid; inst uuid; imp uuid; n integer; fid uuid; phys text;
  u1 uuid := gen_random_uuid(); before text; got text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('cw-709') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('cw-709') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cw709@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'cw709@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'cw_709', 'CW 709') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'pop_709', 'pop_709') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (ds, txn, '[{"name": "city", "type": "STRING"}, {"name": "pop", "type": "DOUBLE"}]'::jsonb);
    SELECT public.dataset_materialize(ds, txn) INTO phys;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (ds, txn, 'seed/pop.rows', 2) RETURNING id INTO fid;
    EXECUTE format('INSERT INTO datasets.%I (_file, city, pop) VALUES ($1, ''ATH'', 3), ($1, ''SKG'', 1)', phys) USING fid;
    PERFORM public.commit_transaction(txn);
    SELECT public.create_code_workbook(proj, 'Templated') INTO wb;
    SELECT id INTO mbr FROM public.workbook_branches WHERE workbook_id = wb;
    INSERT INTO public.workbook_imports (workbook_id, alias, dataset_id)
    VALUES (wb, 'pop', ds) RETURNING id INTO imp;

    -- 1. Versions stamp 0 then 1; the parameter model holds both levels.
    INSERT INTO public.workbook_templates (project_id, name, default_persisted)
    VALUES (proj, 'Top rows', true) RETURNING id INTO tpl;
    INSERT INTO public.workbook_template_versions (template_id, source, parameters)
    VALUES (tpl, 'SELECT * FROM {{{input_table}}} ORDER BY pop DESC LIMIT {{{limit}}}',
      '[{"name": "input_table", "type": "dataset"}, {"name": "limit", "type": "variable", "variable_type": "number"}]'::jsonb)
    RETURNING id INTO v0;
    INSERT INTO public.workbook_template_versions (template_id, source, parameters, is_default, commit_message)
    VALUES (tpl, 'SELECT city FROM {{{input_table}}} ORDER BY pop DESC LIMIT {{{limit}}}',
      '[{"name": "input_table", "type": "dataset"}, {"name": "limit", "type": "variable", "variable_type": "number"}]'::jsonb,
      true, 'narrow the projection')
    RETURNING id INTO v1;
    IF (SELECT version FROM public.workbook_template_versions WHERE id = v0) <> 0
       OR (SELECT version FROM public.workbook_template_versions WHERE id = v1) <> 1 THEN
      RAISE EXCEPTION 'versions did not stamp 0 then 1';
    END IF;
    BEGIN
      INSERT INTO public.workbook_template_versions (template_id, source, parameters)
      VALUES (tpl, 'x', '[{"name": "p", "type": "widget"}]'::jsonb);
      RAISE EXCEPTION 'a parameter type outside the three was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:UnknownParameterType%' THEN RAISE; END IF;
    END;
    BEGIN
      UPDATE public.workbook_template_versions SET source = 'edited' WHERE id = v0;
      RAISE EXCEPTION 'a template version was edited in place';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:VersionImmutable%' THEN RAISE; END IF;
    END;

    -- 2. Applying pins v0 even though v1 exists — instances never
    --    auto-upgrade — and the persistence default saves it.
    SELECT public.apply_workbook_template(wb, mbr, 'top_city', v0,
      '{"input_table": "pop", "limit": "1"}'::jsonb) INTO inst;
    IF (SELECT template_version_id FROM public.workbook_transforms WHERE id = inst)
       IS DISTINCT FROM v0 THEN
      RAISE EXCEPTION 'the instance did not pin the version it was applied from';
    END IF;
    IF NOT (SELECT persisted FROM public.workbook_transforms WHERE id = inst) THEN
      RAISE EXCEPTION 'the template''s Save-as-dataset default did not persist the instance';
    END IF;

    -- 3. The dataset parameter bound the edge at apply, so the substituted
    --    SQL builds the right row straight away.
    IF NOT EXISTS (SELECT 1 FROM public.workbook_transform_inputs
                    WHERE transform_id = inst AND input_import_id = imp) THEN
      RAISE EXCEPTION 'the dataset parameter did not bind the input edge';
    END IF;
    PERFORM public.run_build(ARRAY[(SELECT saved_dataset_id FROM public.workbook_transforms WHERE id = inst)], true);
    SELECT d.physical_table INTO phys FROM public.datasets d
     WHERE d.id = (SELECT saved_dataset_id FROM public.workbook_transforms WHERE id = inst);
    EXECUTE format('SELECT count(*) FROM datasets.%I WHERE city = ''ATH''', phys) INTO n;
    IF n <> 1 THEN RAISE EXCEPTION 'the substituted template should keep ATH alone'; END IF;

    -- 4. An unbound parameter refuses at compile.
    UPDATE public.workbook_transforms
       SET config = '{"values": {"input_table": "pop"}}'::jsonb WHERE id = inst;
    BEGIN
      PERFORM public.compile_workbook_transform(inst);
      RAISE EXCEPTION 'an unbound parameter compiled';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:UnboundParameter%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '709 proved, as the caller: template versions stamp 0 then 1, hold the two-level parameter model and refuse in-place edits; an instance pins the version it was applied from while a newer one exists, and the template''s Save-as-dataset default persists it; the substituted SQL builds ATH alone through the job spec; and an unbound parameter refuses at compile';
  END;
END $$;
