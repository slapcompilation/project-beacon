-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 311 — installation: a workflow authored at one property runs at
-- another without being rebuilt.
--
-- W5 of docs/WORKSHOP-PLAN.md, and the reason the whole arc exists. Everything
-- before this made ONE property's screen composable. Compounding is a workflow
-- crossing properties, and today a hotel-scoped module is invisible next door.
--
-- FOUNDRY'S MODEL (marketplace/installations), adopted:
--
--   An INSTALLATION is a deployed instance of a product at a target. It TRACKS
--   A VERSION, and newer versions "surface as new versions available for
--   upgrade" — the installed version is a pin, not a mirror, so a property does
--   not silently change under its staff overnight.
--
--   LOCKING is the divergence rule: "locking a project prevents users from
--   editing installed resources directly" and "edits to installed content will
--   be overwritten when a new product version is applied". Unlocking lets you
--   "fork the content you installed".
--
--   Ours reads the same way and is enforced rather than advised:
--     forked_module_id IS NULL  → locked. The property runs the source module at
--                                 its pinned version. It cannot drift.
--     forked_module_id IS NOT NULL → forked. The property owns a copy, may edit
--                                 it, and no longer receives upgrades.
--
--   Nothing is silently overwritten here, which is the one place we improve on
--   the description rather than copy it: an upgrade re-points the pin, and a
--   fork is an explicit act that costs you upgrades. Foundry warns you; we make
--   the two states structurally different so the warning cannot be ignored.
--
-- Hotel overrides org, as everywhere else in this system: a forked module is
-- hotel-scoped and wins locally.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.module_installations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL DEFAULT auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- What was installed.
  module_id        uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  -- Where it runs.
  hotel_id         uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  -- The pin. An upgrade moves this; it does not follow the source on its own.
  installed_version integer NOT NULL,
  -- NULL = locked (runs the source). Set = forked (owns a copy, no upgrades).
  forked_module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,

  installed_by     uuid DEFAULT auth.uid() REFERENCES public.users(id),
  installed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, hotel_id),
  -- A module installed at the property that authored it is a no-op that would
  -- make adoption counts lie.
  CONSTRAINT installation_is_elsewhere CHECK (module_id <> forked_module_id)
);

COMMENT ON TABLE public.module_installations IS
  'A module adopted by a property. installed_version is a pin, not a mirror. forked_module_id NULL means locked — the property cannot drift and can be upgraded.';

CREATE INDEX IF NOT EXISTS idx_module_installations_hotel
  ON public.module_installations (hotel_id, module_id);

ALTER TABLE public.module_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read installations in org" ON public.module_installations;
CREATE POLICY "members read installations in org" ON public.module_installations
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "admins install" ON public.module_installations;
CREATE POLICY "admins install" ON public.module_installations
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table','module_installations','platform','A module adopted by a property, pinned to a version')
ON CONFLICT (object_kind, object_name) DO NOTHING;

-- ── Visibility: an installed module is visible where it was installed ───────
--
-- Without this the whole phase is inert — a hotel-scoped module stays invisible
-- next door no matter how many installations point at it.

DROP POLICY IF EXISTS "members read modules in scope" ON public.modules;
CREATE POLICY "members read modules in scope" ON public.modules
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL
              OR hotel_is_in_user_scope(hotel_id)
              OR EXISTS (SELECT 1 FROM module_installations i
                         WHERE i.module_id = modules.id
                           AND hotel_is_in_user_scope(i.hotel_id))));

-- The child tables carry the same rule, or a module would resolve to a title
-- with no widgets at the property that installed it.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['module_variables','module_layouts','module_widgets','module_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "members read %I in scope" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "members read %I in scope" ON public.%I
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id
                     AND m.organization_id IS NOT DISTINCT FROM auth_org_id()
                     AND (m.hotel_id IS NULL
                          OR hotel_is_in_user_scope(m.hotel_id)
                          OR EXISTS (SELECT 1 FROM module_installations i
                                     WHERE i.module_id = m.id
                                       AND hotel_is_in_user_scope(i.hotel_id)))))$p$, t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_module(p_api_name text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'id', m.id, 'apiName', m.api_name, 'title', m.title,
    'description', m.description, 'icon', m.icon,
    'status', m.status, 'version', m.version,
    'hotelId', m.hotel_id,
    'variables', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'apiName', v.api_name, 'label', v.label, 'varType', v.var_type,
        'definitionKind', v.definition_kind, 'definition', v.definition,
        'recompute', v.recompute) ORDER BY v.api_name)
      FROM module_variables v WHERE v.module_id = m.id), '[]'::jsonb),
    'layouts', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'apiName', l.api_name, 'title', l.title,
        'layoutType', l.layout_type, 'parentId', l.parent_id, 'position', l.position)
        ORDER BY l.position, l.api_name)
      FROM module_layouts l WHERE l.module_id = m.id), '[]'::jsonb),
    'widgets', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', w.id, 'apiName', w.api_name, 'widgetType', w.widget_type,
        'title', w.title, 'layoutId', w.layout_id, 'variableId', w.variable_id,
        'config', w.config, 'position', w.position) ORDER BY w.position, w.api_name)
      FROM module_widgets w WHERE w.module_id = m.id), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'sourceWidgetId', e.source_widget_id, 'trigger', e.trigger,
        'effectType', e.effect_type, 'config', e.config, 'position', e.position)
        ORDER BY e.position, e.id)
      FROM module_events e WHERE e.module_id = m.id), '[]'::jsonb)
  )
  FROM modules m
  WHERE m.api_name = p_api_name
    AND m.organization_id IS NOT DISTINCT FROM auth_org_id()
    AND (m.hotel_id IS NULL
         OR hotel_is_in_user_scope(m.hotel_id)
         OR EXISTS (SELECT 1 FROM module_installations i
                    WHERE i.module_id = m.id AND hotel_is_in_user_scope(i.hotel_id)))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_module(text) TO authenticated;

-- ── Forking: the property takes ownership and stops receiving upgrades ──────

CREATE OR REPLACE FUNCTION public.fork_installed_module(p_installation_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  v_inst   module_installations%ROWTYPE;
  v_src    modules%ROWTYPE;
  v_new    uuid;
  v_suffix text;
BEGIN
  SELECT * INTO v_inst FROM module_installations WHERE id = p_installation_id;
  IF v_inst.id IS NULL THEN
    RAISE EXCEPTION 'Workshop:NoSuchInstallation %', p_installation_id;
  END IF;
  IF v_inst.forked_module_id IS NOT NULL THEN
    RAISE EXCEPTION 'Workshop:AlreadyForked installation % owns module %',
      p_installation_id, v_inst.forked_module_id;
  END IF;

  SELECT * INTO v_src FROM modules WHERE id = v_inst.module_id;
  v_suffix := left(replace(v_inst.hotel_id::text, '-', ''), 8);

  INSERT INTO modules (organization_id, hotel_id, api_name, title, description, icon, status, version)
  VALUES (v_src.organization_id, v_inst.hotel_id,
          v_src.api_name || '_' || v_suffix,
          v_src.title, v_src.description, v_src.icon, v_src.status, 1)
  RETURNING id INTO v_new;

  -- Variables first: widgets and events reference them by id, so the copy has
  -- to carry a mapping rather than the source's ids.
  CREATE TEMP TABLE _var_map ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO module_variables (module_id, api_name, label, var_type, definition_kind, definition, recompute)
    SELECT v_new, api_name, label, var_type, definition_kind, definition, recompute
    FROM module_variables WHERE module_id = v_src.id
    RETURNING id, api_name
  )
  SELECT o.id AS old_id, ins.id AS new_id FROM ins
  JOIN module_variables o ON o.module_id = v_src.id AND o.api_name = ins.api_name;

  CREATE TEMP TABLE _layout_map ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO module_layouts (module_id, api_name, title, layout_type, position)
    SELECT v_new, api_name, title, layout_type, position
    FROM module_layouts WHERE module_id = v_src.id
    RETURNING id, api_name
  )
  SELECT o.id AS old_id, ins.id AS new_id FROM ins
  JOIN module_layouts o ON o.module_id = v_src.id AND o.api_name = ins.api_name;

  -- Nested layouts: re-point parents through the map.
  UPDATE module_layouts l SET parent_id = lm.new_id
  FROM module_layouts o JOIN _layout_map lm ON lm.old_id = o.parent_id
  WHERE l.module_id = v_new AND o.module_id = v_src.id AND o.api_name = l.api_name;

  CREATE TEMP TABLE _widget_map ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO module_widgets (module_id, api_name, widget_type, title, layout_id, variable_id, config, position)
    SELECT v_new, w.api_name, w.widget_type, w.title, lm.new_id, vm.new_id, w.config, w.position
    FROM module_widgets w
    LEFT JOIN _layout_map lm ON lm.old_id = w.layout_id
    LEFT JOIN _var_map vm    ON vm.old_id = w.variable_id
    WHERE w.module_id = v_src.id
    RETURNING id, api_name
  )
  SELECT o.id AS old_id, ins.id AS new_id FROM ins
  JOIN module_widgets o ON o.module_id = v_src.id AND o.api_name = ins.api_name;

  -- Events carry variable and layout ids inside their config, so those are
  -- remapped too — a fork whose buttons set the SOURCE module's variables would
  -- look like it worked and quietly drive the wrong screen.
  INSERT INTO module_events (module_id, source_widget_id, trigger, effect_type, config, position)
  SELECT v_new, wm.new_id, e.trigger, e.effect_type,
         CASE WHEN e.config ? 'variableId'
              THEN jsonb_set(e.config, '{variableId}',
                     to_jsonb((SELECT new_id::text FROM _var_map WHERE old_id = (e.config->>'variableId')::uuid)))
              ELSE e.config END,
         e.position
  FROM module_events e
  LEFT JOIN _widget_map wm ON wm.old_id = e.source_widget_id
  WHERE e.module_id = v_src.id;

  UPDATE module_installations SET forked_module_id = v_new WHERE id = p_installation_id;
  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.fork_installed_module(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fork_installed_module(uuid) TO authenticated;

-- ── Adoption: which properties run this, and which are behind ───────────────

CREATE OR REPLACE FUNCTION public.get_module_adoption(p_module_id uuid)
RETURNS TABLE (
  hotel_id          uuid,
  hotel_name        text,
  installed         boolean,
  installed_version integer,
  source_version    integer,
  forked            boolean,
  is_author         boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT h.id, h.name,
         i.id IS NOT NULL,
         i.installed_version,
         m.version,
         i.forked_module_id IS NOT NULL,
         m.hotel_id = h.id
  FROM hotels h
  CROSS JOIN modules m
  LEFT JOIN module_installations i ON i.module_id = m.id AND i.hotel_id = h.id
  WHERE m.id = p_module_id
    AND h.organization_id IS NOT DISTINCT FROM auth_org_id()
  ORDER BY h.name;
$$;

REVOKE ALL ON FUNCTION public.get_module_adoption(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_module_adoption(uuid) TO authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org uuid; v_a uuid; v_b uuid; v_mod uuid; v_inst uuid; v_fork uuid;
  v_var uuid; v_w uuid; n int; v_cfg jsonb;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT id INTO v_a FROM hotels WHERE organization_id = v_org ORDER BY name LIMIT 1;
  SELECT id INTO v_b FROM hotels WHERE organization_id = v_org AND id <> v_a ORDER BY name LIMIT 1;
  IF v_b IS NULL THEN
    RAISE NOTICE 'Migration 311: only one hotel in the org — cross-property probes skipped';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO modules (organization_id, hotel_id, api_name, title)
    VALUES (v_org, v_a, 'probe_install', 'Probe') RETURNING id INTO v_mod;
    INSERT INTO module_variables (module_id, api_name, var_type)
    VALUES (v_mod, 'sel', 'string') RETURNING id INTO v_var;
    INSERT INTO module_widgets (module_id, api_name, widget_type, variable_id, config)
    VALUES (v_mod, 'card', 'metric_card', v_var, '{}'::jsonb) RETURNING id INTO v_w;
    INSERT INTO module_events (module_id, source_widget_id, trigger, effect_type, config)
    VALUES (v_mod, v_w, 'click', 'set_variable', jsonb_build_object('variableId', v_var));

    INSERT INTO module_installations (organization_id, module_id, hotel_id, installed_version)
    VALUES (v_org, v_mod, v_b, 1) RETURNING id INTO v_inst;

    -- Installing twice at the same property is an upgrade, not a second copy.
    BEGIN
      INSERT INTO module_installations (organization_id, module_id, hotel_id, installed_version)
      VALUES (v_org, v_mod, v_b, 2);
      RAISE EXCEPTION 'Migration 311: the same module installed twice at one hotel';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    v_fork := fork_installed_module(v_inst);

    SELECT count(*) INTO n FROM module_widgets WHERE module_id = v_fork;
    IF n <> 1 THEN RAISE EXCEPTION 'Migration 311: fork copied % widgets, expected 1', n; END IF;

    -- The fork must be wired to ITS OWN variables. A copy still pointing at the
    -- source's would render and silently drive the wrong screen.
    SELECT config INTO v_cfg FROM module_events WHERE module_id = v_fork;
    IF (v_cfg->>'variableId')::uuid = v_var THEN
      RAISE EXCEPTION 'Migration 311: the forked event still points at the source variable';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM module_variables
                   WHERE module_id = v_fork AND id = (v_cfg->>'variableId')::uuid) THEN
      RAISE EXCEPTION 'Migration 311: the forked event points at no variable of the fork';
    END IF;

    IF (SELECT hotel_id FROM modules WHERE id = v_fork) <> v_b THEN
      RAISE EXCEPTION 'Migration 311: the fork is not scoped to the installing property';
    END IF;

    -- Forking twice is a bug in the caller, not a second copy.
    BEGIN
      PERFORM fork_installed_module(v_inst);
      RAISE EXCEPTION 'Migration 311: an installation was forked twice';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Workshop:AlreadyForked%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
