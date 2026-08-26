-- 687: a variable decides what shows.
--
-- The post-build reconciliation re-read concepts-layouts against 685 and
-- found the same mechanism missing in two places. Overlays:
--
--   "**Variable based visibility:** This setting allows a Boolean variable to be selected which will determine if the overlay should be visible."
--   — workshop/concepts-layouts.md
--
-- and sections:
--
--   "Sections can be configured with conditional visibility to show or hide based on variable values."
--   — workshop/concepts-layouts.md
--
-- This is structural rather than cosmetic: whether a thing renders is a
-- property of the thing, so it is a column on both, added now rather than
-- retrofitted through two tables later. The variable must be Boolean and
-- must belong to the same module, which a trigger holds because a CHECK
-- cannot reach another table.
--
-- The overlay's close event, from the same list, lands with it:
--
--   "**On close:** This option allows a Workshop [Event](/docs/foundry/workshop/concepts-events/) to optionally be configured run when the overlay is closed."
--   — workshop/concepts-layouts.md
--
-- and Rows gains the option the layout list names for it alone:
--
--   "**Rows:** Enables sections to be split horizontally to effectively create a new row in a module. The **Enable scrolling** option is available in the Rows layout."
--   — workshop/concepts-layouts.md

ALTER TABLE public.workshop_sections
  ADD COLUMN visible_when_variable_id uuid
    REFERENCES public.workshop_variables(id) ON DELETE SET NULL,
  ADD COLUMN enable_scrolling boolean NOT NULL DEFAULT false;
CREATE INDEX workshop_sections_visible_when_idx
  ON public.workshop_sections (visible_when_variable_id);
COMMENT ON COLUMN public.workshop_sections.visible_when_variable_id IS
  'A Boolean variable deciding whether this section renders — "Sections can be configured with conditional visibility to show or hide based on variable values" (workshop/concepts-layouts). NULL means always visible.';
COMMENT ON COLUMN public.workshop_sections.enable_scrolling IS
  'The Enable-scrolling option the layout list gives to Rows alone (workshop/concepts-layouts). Meaningless on the other five, which is why the guard refuses it there.';

ALTER TABLE public.workshop_overlays
  ADD COLUMN visible_when_variable_id uuid
    REFERENCES public.workshop_variables(id) ON DELETE SET NULL,
  ADD COLUMN on_close_event_id uuid
    REFERENCES public.workshop_events(id) ON DELETE SET NULL;
CREATE INDEX workshop_overlays_visible_when_idx
  ON public.workshop_overlays (visible_when_variable_id);
CREATE INDEX workshop_overlays_on_close_idx
  ON public.workshop_overlays (on_close_event_id);
COMMENT ON COLUMN public.workshop_overlays.visible_when_variable_id IS
  'The Variable-based-visibility setting: a Boolean variable determining whether the overlay is shown, which also lets an overlay open on module load (workshop/concepts-layouts).';
COMMENT ON COLUMN public.workshop_overlays.on_close_event_id IS
  'The On-close setting: an event configured to run when the overlay is closed (workshop/concepts-layouts).';

-- A visibility binding must be a Boolean variable of the SAME module — a
-- CHECK cannot reach another table, so the fact lives in a trigger.
CREATE FUNCTION public.guard_visibility_variable()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v record;
BEGIN
  IF NEW.visible_when_variable_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v FROM public.workshop_variables
   WHERE id = NEW.visible_when_variable_id;
  IF v.module_id IS DISTINCT FROM NEW.module_id THEN
    RAISE EXCEPTION 'Workshop:VariableNotInModule — a visibility variable belongs to the module it hides things in';
  END IF;
  IF v.value_type <> 'boolean' THEN
    RAISE EXCEPTION 'Workshop:VisibilityNeedsBoolean — visibility is decided by a Boolean variable, not a %', v.value_type;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_visibility_variable
  BEFORE INSERT OR UPDATE OF visible_when_variable_id ON public.workshop_sections
  FOR EACH ROW EXECUTE FUNCTION public.guard_visibility_variable();
CREATE TRIGGER guard_visibility_variable
  BEFORE INSERT OR UPDATE OF visible_when_variable_id ON public.workshop_overlays
  FOR EACH ROW EXECUTE FUNCTION public.guard_visibility_variable();

-- Scrolling is offered on Rows and nowhere else.
CREATE FUNCTION public.guard_section_scrolling()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.enable_scrolling AND NEW.layout <> 'rows' THEN
    RAISE EXCEPTION 'Workshop:ScrollingIsForRows — the Enable scrolling option is available in the Rows layout';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_section_scrolling
  BEFORE INSERT OR UPDATE OF enable_scrolling, layout ON public.workshop_sections
  FOR EACH ROW EXECUTE FUNCTION public.guard_section_scrolling();

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; m uuid; sec uuid; ov uuid; vb uuid; vs uuid;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('vis-687') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('vis-687') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vis687@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'vis687@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'vis_687', 'Visibility 687') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    SELECT public.create_workshop_module(proj, 'Visibility 687') INTO m;
    SELECT id INTO sec FROM public.workshop_sections
     WHERE module_id = m AND parent_id IS NOT NULL LIMIT 1;

    INSERT INTO public.workshop_variables (module_id, name, value_type)
    VALUES (m, 'Show details', 'boolean') RETURNING id INTO vb;
    INSERT INTO public.workshop_variables (module_id, name, value_type)
    VALUES (m, 'Some text', 'string') RETURNING id INTO vs;

    -- 1. A Boolean variable of this module may decide visibility.
    UPDATE public.workshop_sections SET visible_when_variable_id = vb WHERE id = sec;
    INSERT INTO public.workshop_overlays (module_id, name, kind, visible_when_variable_id)
    VALUES (m, 'Details', 'modal', vb) RETURNING id INTO ov;

    -- 2. A non-Boolean one may not, on either table.
    BEGIN
      UPDATE public.workshop_sections SET visible_when_variable_id = vs WHERE id = sec;
      RAISE EXCEPTION 'a string variable decided a section''s visibility';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:VisibilityNeedsBoolean%' THEN RAISE; END IF;
    END;
    BEGIN
      UPDATE public.workshop_overlays SET visible_when_variable_id = vs WHERE id = ov;
      RAISE EXCEPTION 'a string variable decided an overlay''s visibility';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:VisibilityNeedsBoolean%' THEN RAISE; END IF;
    END;

    -- 3. Scrolling is the Rows layout's option alone.
    UPDATE public.workshop_sections SET layout = 'rows', enable_scrolling = true WHERE id = sec;
    BEGIN
      UPDATE public.workshop_sections SET layout = 'flow' WHERE id = sec;
      RAISE EXCEPTION 'scrolling survived a move off Rows';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Workshop:ScrollingIsForRows%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '687 proved: a Boolean variable of the same module decides a section''s and an overlay''s visibility, a non-Boolean one is refused on both, and Enable scrolling holds only on the Rows layout';
  END;
END $$;
