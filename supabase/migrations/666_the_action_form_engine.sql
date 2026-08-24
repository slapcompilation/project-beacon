-- The action form engine, from readings/action-form.md (built after a human
-- read its Decisions block): default values, override blocks, and sections —
-- what the form does between "parameters exist" and "the user submits".
--
-- ── DEFAULTS ARE FORM-TIME PREFILLS ──────────────────────────────────────────
--
--   "Default values for action type parameters are used to prefill parameters in the action form."
--   — action-types/parameters-default-value.md
--
-- Two sources as columns (the editor's radio pair), with the ordering rule as
-- a guard:
--
--   "Only object reference parameters that are placed above the parameter in the input list are available to be used as a default value."
--   — action-types/parameters-default-value.md
--
-- The third source is a type class. The actions namespace publishes three:
--
--   "Replaces a string parameter with a UUID."
--   — object-link-types/metadata-typeclasses.md
--
--   "Replaces a string parameter with the current user."
--   — object-link-types/metadata-typeclasses.md
--
--   "Shows the created/modified object in the success toast."
--   — object-link-types/metadata-typeclasses.md
--
-- The first two are honoured SERVER-SIDE in apply_action when the submitted
-- value is absent — the page's guidance is to hide such parameters, and a
-- hidden generate_uuid parameter must work without trusting the client. The
-- third is a surface hint. Static and object-property defaults stay form
-- prefills, never server fallbacks — "Local default values (for example,
-- Workshop variables) always take precedence over global default values."
-- (action-types/parameters-default-value.md), so the server never overwrites
-- a submitted value.
--
-- ── OVERRIDES ARE FIRST-TRUE-WINS BLOCKS, AND THE CONDITIONS ALREADY EXIST ───
--
--   "Every parameter can contain multiple override blocks, however, if more than one is true, only the first one will be executed."
--   — action-types/parameters-override.md
--
--   "The only difference between override conditions and submission criteria conditions is that only parameters which appear above the current parameter in the form hierarchy can be referenced in override conditions."
--   — action-types/parameters-override.md
--
-- So the condition grammar is NOT copied: action_type_submission_criteria
-- gains a nullable override_block_id, and one tree serves both consumers.
-- submission_criteria_verdict is patched to walk only the block-less roots.
-- The narrowing is a guard; the equal-to-base case joins ontology_warnings —
-- "a warning will be shown on the override itself" says warned, not refused.
-- Effects cover visible, disabled, required and the static default;
-- constraints effects wait for constraints storage, which does not exist
-- (probed in the reading).
--
-- ── SECTIONS ─────────────────────────────────────────────────────────────────
--
--   "These sections provide a logical grouping of parameters to organize an action form. Sections also support columns, descriptions, and conditional overrides."
--   — action-types/configure-sections.md
--
--   "A section can be divided into one or two columns."
--   — action-types/configure-sections.md
--
-- The section capture shows an ID and a RID side by side; the RID grammar
-- follows our other ontology resources (488) and is inference. Collapse is
-- derived, never stored: the capture's own caption says only sections with a
-- title can be collapsed.
--
-- ── ONE RESOLVER ─────────────────────────────────────────────────────────────
-- action_form_effective(action, params) is the single place the first-true-
-- wins semantics live: the form surface renders from it, and apply_action
-- consults it for requiredness, so a required-by-override parameter holds
-- against a raw caller. SECURITY DEFINER like submission_criteria_verdict —
-- evaluation must see conditions that 607's policy hides from non-editors.

-- ── TYPE CLASSES ─────────────────────────────────────────────────────────────

CREATE FUNCTION public.action_parameter_type_classes() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['generate_uuid', 'prefill_current_user', 'view_object_with_type']
$$;

COMMENT ON FUNCTION public.action_parameter_type_classes() IS
  'The actions namespace''s published type classes (object-link-types/metadata-typeclasses): two server-honoured prefills and one toast hint. Emit-only — a class arrives with the code that honours it.';

-- ── SECTIONS ─────────────────────────────────────────────────────────────────

CREATE TABLE public.action_type_form_sections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid            text GENERATED ALWAYS AS (public.rid_of('ontology', 'form-section', id)) STORED,
  action_type_id uuid NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  api_name       text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9-]*$'),
  title          text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',
  columns        integer NOT NULL DEFAULT 1 CHECK (columns IN (1, 2)),
  show_title_bar boolean NOT NULL DEFAULT true,
  visible        boolean NOT NULL DEFAULT true,
  position       integer NOT NULL DEFAULT 0,
  UNIQUE (action_type_id, api_name)
);

COMMENT ON TABLE public.action_type_form_sections IS
  'A form section (action-types/configure-sections): a titled, describable group of parameters in one or two columns, hideable, with its own conditional overrides. Collapsibility is derived — only sections with a title can be collapsed — and the description always renders in the section, never a tooltip.';

CREATE UNIQUE INDEX action_type_form_sections_rid_key ON public.action_type_form_sections (rid);
CREATE INDEX action_type_form_sections_action ON public.action_type_form_sections (action_type_id);

-- ── PARAMETER DEFAULTS AND MEMBERSHIP ────────────────────────────────────────

ALTER TABLE public.action_type_parameters
  ADD COLUMN default_source text CHECK (default_source IN ('static', 'object_property')),
  ADD COLUMN default_static jsonb,
  ADD COLUMN default_object_parameter_id uuid REFERENCES public.action_type_parameters(id) ON DELETE SET NULL,
  ADD COLUMN default_property text,
  ADD COLUMN type_classes text[] NOT NULL DEFAULT '{}'
    CHECK (type_classes <@ public.action_parameter_type_classes()),
  ADD COLUMN section_id uuid REFERENCES public.action_type_form_sections(id) ON DELETE SET NULL,
  ADD CONSTRAINT action_type_parameters_default_shape CHECK (
    CASE default_source
      WHEN 'static'          THEN default_static IS NOT NULL
                                  AND default_object_parameter_id IS NULL AND default_property IS NULL
      WHEN 'object_property' THEN default_object_parameter_id IS NOT NULL AND default_property IS NOT NULL
                                  AND default_static IS NULL
      ELSE default_static IS NULL AND default_object_parameter_id IS NULL AND default_property IS NULL
    END);

COMMENT ON COLUMN public.action_type_parameters.default_source IS
  'The editor''s radio pair (parameters-default-value): a static value, or a property of an object parameter placed above this one. NULL means no default. Type-class prefills are the third source and live in type_classes.';

CREATE INDEX action_type_parameters_default_object
  ON public.action_type_parameters (default_object_parameter_id);
CREATE INDEX action_type_parameters_section ON public.action_type_parameters (section_id);

-- "Only object reference parameters that are placed above the parameter in
-- the input list" — same action, an object reference, strictly above, and
-- the property must exist on that object type.
CREATE FUNCTION public.guard_parameter_default() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE ref record;
BEGIN
  IF NEW.default_source = 'object_property' THEN
    SELECT * INTO ref FROM public.action_type_parameters
     WHERE id = NEW.default_object_parameter_id;
    IF NOT FOUND OR ref.action_type_id <> NEW.action_type_id THEN
      RAISE EXCEPTION 'Actions:DefaultNotAbove — the default must come from a parameter of the same action';
    END IF;
    IF ref.object_type_id IS NULL THEN
      RAISE EXCEPTION 'Actions:DefaultNotAnObject — only an object reference parameter can supply a property default';
    END IF;
    IF ref.position >= NEW.position THEN
      RAISE EXCEPTION 'Actions:DefaultNotAbove — only object reference parameters placed above this one can supply its default';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.object_type_properties p
                    WHERE p.object_type_id = ref.object_type_id
                      AND p.property_id = NEW.default_property) THEN
      RAISE EXCEPTION 'Actions:DefaultPropertyUnknown — % is not a property of the referenced object type',
        NEW.default_property;
    END IF;
  END IF;
  IF NEW.section_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.action_type_form_sections s
                      WHERE s.id = NEW.section_id AND s.action_type_id = NEW.action_type_id) THEN
    RAISE EXCEPTION 'Actions:SectionOfAnotherAction — a parameter joins a section of its own action';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_parameter_default BEFORE INSERT OR UPDATE ON public.action_type_parameters
FOR EACH ROW EXECUTE FUNCTION public.guard_parameter_default();

-- ── OVERRIDE BLOCKS ──────────────────────────────────────────────────────────

CREATE FUNCTION public.action_override_effects_valid(e jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(e) = 'object'
     AND e <> '{}'::jsonb
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_object_keys(e) k
        WHERE k NOT IN ('visible', 'disabled', 'required', 'default_static'))
     AND (NOT e ? 'visible'  OR jsonb_typeof(e -> 'visible')  = 'boolean')
     AND (NOT e ? 'disabled' OR jsonb_typeof(e -> 'disabled') = 'boolean')
     AND (NOT e ? 'required' OR jsonb_typeof(e -> 'required') = 'boolean')
$$;

COMMENT ON FUNCTION public.action_override_effects_valid(jsonb) IS
  'The Then half''s admitted effects (parameters-override): visibility, requiredness, disabled, and the static default. Constraints effects arrive with constraints storage, which does not exist yet.';

CREATE TABLE public.action_type_parameter_overrides (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type_id uuid NOT NULL REFERENCES public.action_types(id) ON DELETE CASCADE,
  parameter_id   uuid REFERENCES public.action_type_parameters(id) ON DELETE CASCADE,
  section_id     uuid REFERENCES public.action_type_form_sections(id) ON DELETE CASCADE,
  position       integer NOT NULL DEFAULT 0,
  effects        jsonb NOT NULL CHECK (public.action_override_effects_valid(effects)),
  CHECK (num_nonnulls(parameter_id, section_id) = 1)
);

COMMENT ON TABLE public.action_type_parameter_overrides IS
  'One override block (parameters-override): an if of criteria-tree conditions and a then of effects, on a parameter or a section. Blocks order by position, and if more than one is true only the first is executed.';

CREATE INDEX action_type_parameter_overrides_action
  ON public.action_type_parameter_overrides (action_type_id);
CREATE INDEX action_type_parameter_overrides_parameter
  ON public.action_type_parameter_overrides (parameter_id, position);
CREATE INDEX action_type_parameter_overrides_section
  ON public.action_type_parameter_overrides (section_id, position);

-- One condition grammar: the criteria tree gains a block pointer.
ALTER TABLE public.action_type_submission_criteria
  ADD COLUMN override_block_id uuid REFERENCES public.action_type_parameter_overrides(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.action_type_submission_criteria.override_block_id IS
  'NULL for submission criteria; set when this node belongs to an override block''s If — the same conditions "reused" (parameters-override), narrowed to parameters above the target by guard_override_condition.';

CREATE INDEX action_type_submission_criteria_block
  ON public.action_type_submission_criteria (override_block_id);

-- "only parameters which appear above the current parameter in the form
-- hierarchy can be referenced" — measured by position: the target parameter's
-- own, or for a section target the position of its first member (an empty
-- section constrains nothing; the strictly-prior reading is inference).
CREATE FUNCTION public.guard_override_condition() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_target int; ref_pos int; blk record;
BEGIN
  IF NEW.override_block_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO blk FROM public.action_type_parameter_overrides
   WHERE id = NEW.override_block_id;
  IF blk.parameter_id IS NOT NULL THEN
    SELECT position INTO v_target FROM public.action_type_parameters WHERE id = blk.parameter_id;
  ELSE
    SELECT min(position) INTO v_target FROM public.action_type_parameters
     WHERE section_id = blk.section_id;
  END IF;
  FOR ref_pos IN
    SELECT p.position FROM public.action_type_parameters p
     WHERE p.id IN (NEW.parameter_id, NEW.value_parameter_id)
  LOOP
    IF v_target IS NOT NULL AND ref_pos >= v_target THEN
      RAISE EXCEPTION 'Actions:ConditionNotAbove — override conditions may only reference parameters above the target in the form hierarchy';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_override_condition BEFORE INSERT OR UPDATE ON public.action_type_submission_criteria
FOR EACH ROW EXECUTE FUNCTION public.guard_override_condition();

-- ── THE VERDICT WALKS ONLY THE BLOCK-LESS ROOTS ──────────────────────────────
-- Patch the live definition, never retype it: one anchor, one refusal.
DO $do$
DECLARE src text; a1 text;
BEGIN
  src := replace(pg_get_functiondef('public.submission_criteria_verdict(uuid,jsonb)'::regprocedure), chr(13), '');
  a1 := 'WHERE action_type_id = p_action_type AND parent_id IS NULL';
  IF position(a1 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: submission_criteria_verdict is not the text 666 read';
  END IF;
  src := replace(src, a1, a1 || '
                 AND override_block_id IS NULL');
  EXECUTE src;
END $do$;

-- ── THE RESOLVER ─────────────────────────────────────────────────────────────

CREATE FUNCTION public.action_form_effective(p_action uuid, p_parameters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  par record; sec record; blk record; root record; sub record;
  v_hit boolean; v_eff jsonb; v_params jsonb := '{}'::jsonb; v_sections jsonb := '{}'::jsonb;
BEGIN
  FOR par IN SELECT * FROM public.action_type_parameters
              WHERE action_type_id = p_action ORDER BY position
  LOOP
    v_eff := jsonb_build_object(
      'visible', par.exposed, 'disabled', NOT par.editable, 'required', par.required,
      'default', CASE par.default_source
        WHEN 'static' THEN jsonb_build_object('source', 'static', 'value', par.default_static)
        WHEN 'object_property' THEN jsonb_build_object('source', 'object_property',
          'parameter', (SELECT api_name FROM public.action_type_parameters
                         WHERE id = par.default_object_parameter_id),
          'property', par.default_property)
        ELSE NULL END,
      'type_classes', to_jsonb(par.type_classes),
      'section', (SELECT s.api_name FROM public.action_type_form_sections s WHERE s.id = par.section_id));

    -- first-true-wins over this parameter's blocks
    FOR blk IN SELECT * FROM public.action_type_parameter_overrides
                WHERE parameter_id = par.id ORDER BY position, id
    LOOP
      v_hit := true;
      FOR root IN SELECT id FROM public.action_type_submission_criteria
                   WHERE override_block_id = blk.id AND parent_id IS NULL ORDER BY position
      LOOP
        SELECT * INTO sub FROM public.eval_criterion(root.id, p_action, p_parameters);
        IF NOT sub.passed THEN v_hit := false; EXIT; END IF;
      END LOOP;
      IF v_hit THEN
        v_eff := v_eff || jsonb_strip_nulls(jsonb_build_object(
          'visible', blk.effects -> 'visible',
          'disabled', blk.effects -> 'disabled',
          'required', blk.effects -> 'required'));
        IF blk.effects ? 'default_static' THEN
          v_eff := jsonb_set(v_eff, '{default}',
            jsonb_build_object('source', 'static', 'value', blk.effects -> 'default_static'));
        END IF;
        EXIT;  -- only the first true block executes
      END IF;
    END LOOP;
    v_params := v_params || jsonb_build_object(par.api_name, v_eff);
  END LOOP;

  FOR sec IN SELECT * FROM public.action_type_form_sections
              WHERE action_type_id = p_action ORDER BY position
  LOOP
    v_eff := jsonb_build_object('visible', sec.visible, 'title', sec.title,
      'description', sec.description, 'columns', sec.columns,
      'show_title_bar', sec.show_title_bar,
      'collapsible', sec.show_title_bar AND btrim(sec.title) <> '');
    FOR blk IN SELECT * FROM public.action_type_parameter_overrides
                WHERE section_id = sec.id ORDER BY position, id
    LOOP
      v_hit := true;
      FOR root IN SELECT id FROM public.action_type_submission_criteria
                   WHERE override_block_id = blk.id AND parent_id IS NULL ORDER BY position
      LOOP
        SELECT * INTO sub FROM public.eval_criterion(root.id, p_action, p_parameters);
        IF NOT sub.passed THEN v_hit := false; EXIT; END IF;
      END LOOP;
      IF v_hit THEN
        v_eff := v_eff || jsonb_strip_nulls(jsonb_build_object('visible', blk.effects -> 'visible'));
        EXIT;
      END IF;
    END LOOP;
    v_sections := v_sections || jsonb_build_object(sec.api_name, v_eff);
  END LOOP;

  RETURN jsonb_build_object('parameters', v_params, 'sections', v_sections);
END $$;

COMMENT ON FUNCTION public.action_form_effective(uuid, jsonb) IS
  'The one place first-true-wins lives: per parameter the effective visible/disabled/required and default (a static value or an object-property descriptor the surface resolves), per section the effective visibility and derived collapsibility. The form surface renders from it; apply_action consults it for requiredness. SECURITY DEFINER because evaluation must see conditions 607 hides from non-editors.';

REVOKE ALL ON FUNCTION public.action_form_effective(uuid, jsonb) FROM PUBLIC, anon;

-- ── APPLY_ACTION HONOURS THE PREFILLS AND THE EFFECTIVE REQUIREDNESS ─────────
-- Patch the live definition, never retype it: one anchor, one refusal.
DO $do$
DECLARE src text; a1 text;
BEGIN
  src := replace(pg_get_functiondef('public.apply_action(uuid,jsonb,text)'::regprocedure), chr(13), '');
  a1 := 'FOR par IN SELECT api_name FROM public.action_type_parameters
              WHERE action_type_id = p_action_type AND required
  LOOP';
  IF position(a1 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: apply_action is not the text 666 read';
  END IF;
  src := replace(src, a1,
'-- the two prefill type classes hold server-side: an absent value is filled,
  -- a submitted one is never overwritten (local values take precedence)
  FOR par IN SELECT api_name, type_classes FROM public.action_type_parameters
              WHERE action_type_id = p_action_type
                AND type_classes && ARRAY[''generate_uuid'', ''prefill_current_user'']
  LOOP
    IF NOT (p_parameters ? par.api_name)
       OR p_parameters->par.api_name = ''null''::jsonb
       OR btrim(coalesce(p_parameters->>par.api_name, '''')) = '''' THEN
      p_parameters := jsonb_set(coalesce(p_parameters, ''{}''::jsonb), ARRAY[par.api_name],
        CASE WHEN ''generate_uuid'' = ANY (par.type_classes)
             THEN to_jsonb(gen_random_uuid()::text)
             ELSE to_jsonb(auth.uid()::text) END);
    END IF;
  END LOOP;

  -- requiredness is the RESOLVED requiredness, so a required-by-override
  -- parameter holds against a raw caller too
  FOR par IN SELECT p.api_name FROM public.action_type_parameters p
              WHERE p.action_type_id = p_action_type
                AND coalesce((public.action_form_effective(p_action_type, p_parameters)
                              #>> ARRAY[''parameters'', p.api_name, ''required''])::boolean,
                             p.required)
  LOOP');
  EXECUTE src;
END $do$;

-- ── THE EQUAL-TO-BASE WARNING ────────────────────────────────────────────────
-- "a warning will be shown on the override itself" — advisory, so it joins
-- ontology_warnings, appended to the live definition by anchor.
DO $do$
DECLARE src text; a1 text;
BEGIN
  src := replace(pg_get_functiondef('public.ontology_warnings()'::regprocedure), chr(13), '');
  a1 := 'JOIN public.object_types t ON t.id = c.object_type_id';
  IF position(a1 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: ontology_warnings is not the text 666 read';
  END IF;
  src := replace(src, a1, a1 || '

  UNION ALL

  -- An override that re-states the base configuration changes nothing:
  -- "a warning will be shown on the override itself" (parameters-override).
  SELECT at.api_name, ''override'', o.id::text,
         format(''An override on "%s" sets %s to its existing value, so it changes nothing.'',
                p.api_name, k.key)
    FROM public.action_type_parameter_overrides o
    JOIN public.action_type_parameters p ON p.id = o.parameter_id
    JOIN public.action_types at ON at.id = o.action_type_id
    JOIN LATERAL jsonb_each(o.effects) k ON true
   WHERE (k.key = ''visible''  AND k.value = to_jsonb(p.exposed))
      OR (k.key = ''disabled'' AND k.value = to_jsonb(NOT p.editable))
      OR (k.key = ''required'' AND k.value = to_jsonb(p.required))');
  EXECUTE src;
END $do$;

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_ot uuid; v_usr uuid;
  v_ds uuid; v_br uuid; v_dsid uuid; v_act uuid; v_p1 uuid; v_p2 uuid;
  v_p3 uuid; v_p4 uuid; v_sec uuid; v_blk uuid; v_eff jsonb; v_msg text;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe666') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe666') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe666', 'Probe666') RETURNING id INTO v_proj;
    v_usr := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe666-' || v_usr || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, 'probe666-' || v_usr || '@beacon.test', 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe666', 'Probe 666', false) RETURNING id INTO v_ont;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe666', 'Probe666') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'master') RETURNING id INTO v_br;
    INSERT INTO public.object_types (ontology_id, api_name, label)
      VALUES (v_ont, 'Probe666Plane', 'Probe666 Plane') RETURNING id INTO v_ot;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_ot, v_ds, v_br) RETURNING id INTO v_dsid;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source, datasource_id)
      VALUES (v_ot, 'ptype', 'ptype', 'Type', 'string', 'user_input', v_dsid);

    INSERT INTO public.action_types (ontology_id, api_name, label)
      VALUES (v_ont, 'probe-666-action', 'Probe 666') RETURNING id INTO v_act;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, data_kind, object_type_id, required, position)
      VALUES (v_act, 'plane', 'Plane', 'object', v_ot, true, 0) RETURNING id INTO v_p1;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, required, position,
       default_source, default_object_parameter_id, default_property)
      VALUES (v_act, 'ptype', 'Type', 'string', true, 1,
              'object_property', v_p1, 'ptype') RETURNING id INTO v_p2;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, required, exposed, position, type_classes)
      VALUES (v_act, 'editId', 'Edit id', 'string', true, false, 2,
              ARRAY['generate_uuid']) RETURNING id INTO v_p3;
    INSERT INTO public.action_type_parameters
      (action_type_id, api_name, display_name, base_type, required, position)
      VALUES (v_act, 'justification', 'Justification', 'string', false, 3) RETURNING id INTO v_p4;

    INSERT INTO public.action_type_form_sections
      (action_type_id, api_name, title, columns, position)
      VALUES (v_act, 'section-1', 'Details', 2, 1) RETURNING id INTO v_sec;
    UPDATE public.action_type_parameters SET section_id = v_sec WHERE id = v_p2;

    -- the block: if ptype is "A320" then justification is required
    INSERT INTO public.action_type_parameter_overrides
      (action_type_id, parameter_id, position, effects)
      VALUES (v_act, v_p4, 0, '{"required": true}') RETURNING id INTO v_blk;
    INSERT INTO public.action_type_submission_criteria
      (action_type_id, override_block_id, node_type, template, parameter_id,
       operator, value_source, static_value)
      VALUES (v_act, v_blk, 'condition', 'parameter', v_p2, 'is', 'static', '"A320"');

    -- refusals: a default from below, a stranger's section, a bogus type
    -- class, an unknown effect key, a condition referencing a later parameter
    BEGIN
      UPDATE public.action_type_parameters
         SET default_source = 'object_property', default_object_parameter_id = v_p4,
             default_property = 'ptype', default_static = NULL
       WHERE id = v_p2;
      RAISE EXCEPTION 'a default from a non-object parameter was admitted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:DefaultNotAnObject%' THEN RAISE; END IF;
    END;
    BEGIN
      UPDATE public.action_type_parameters SET type_classes = ARRAY['bogus'] WHERE id = v_p3;
      RAISE EXCEPTION 'a bogus type class was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.action_type_parameter_overrides
        (action_type_id, parameter_id, effects)
        VALUES (v_act, v_p4, '{"font": "large"}');
      RAISE EXCEPTION 'an unknown effect key was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.action_type_submission_criteria
        (action_type_id, override_block_id, node_type, template, parameter_id,
         operator, value_source, static_value)
        VALUES (v_act, v_blk, 'condition', 'parameter', v_p4, 'is', 'static', '"x"');
      RAISE EXCEPTION 'a condition on a later parameter was admitted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:ConditionNotAbove%' THEN RAISE; END IF;
    END;

    -- the resolver: A320 makes justification required; the section carries
    -- its grammar; the object-property default is a descriptor
    v_eff := public.action_form_effective(v_act, '{"ptype": "A320"}');
    IF (v_eff #>> '{parameters,justification,required}')::boolean IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'the override should make justification required under A320: %', v_eff;
    END IF;
    IF (v_eff #>> '{parameters,ptype,default,source}') IS DISTINCT FROM 'object_property'
       OR (v_eff #>> '{parameters,ptype,default,parameter}') IS DISTINCT FROM 'plane' THEN
      RAISE EXCEPTION 'the object-property default descriptor is wrong: %', v_eff;
    END IF;
    IF (v_eff #>> '{sections,section-1,collapsible}')::boolean IS DISTINCT FROM true
       OR (v_eff #>> '{sections,section-1,columns}')::int IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'the section grammar is wrong: %', v_eff;
    END IF;
    v_eff := public.action_form_effective(v_act, '{"ptype": "B747"}');
    IF (v_eff #>> '{parameters,justification,required}')::boolean IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'without the condition the base requiredness should hold';
    END IF;

    -- apply_action: the hidden generate_uuid parameter is filled server-side,
    -- and the required-by-override parameter refuses when absent
    BEGIN
      PERFORM public.apply_action(v_act, '{"plane": "Q-1", "ptype": "A320"}');
      RAISE EXCEPTION 'a required-by-override parameter was accepted absent';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Actions:MissingParameter%justification%' THEN RAISE; END IF;
    END;
    PERFORM public.apply_action(v_act, '{"plane": "Q-1", "ptype": "B747"}');

    -- the equal-to-base warning fires, and only for the restating key
    INSERT INTO public.action_type_parameter_overrides
      (action_type_id, parameter_id, position, effects)
      VALUES (v_act, v_p4, 1, '{"required": false}');
    SELECT w.problem INTO v_msg FROM public.ontology_warnings() w
     WHERE w.scope = 'override' AND w.problem LIKE '%justification%';
    IF v_msg IS NULL THEN
      RAISE EXCEPTION 'the equal-to-base override should warn';
    END IF;

    -- submission criteria stay untouched by block conditions: the verdict
    -- walks only block-less roots, so the A320 condition gates nothing here
    IF public.submission_criteria_verdict(v_act, '{"ptype": "B747"}') IS NOT NULL THEN
      RAISE EXCEPTION 'an override condition leaked into the submission verdict';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '666 proved: an object-property default resolves as a descriptor and refuses to come from below, a hidden generate_uuid parameter is filled server-side, a first-true block makes a parameter required and apply_action refuses its absence, sections carry columns and derived collapsibility, the equal-to-base override warns, and override conditions never leak into the submission verdict';
  END;
END $$;
