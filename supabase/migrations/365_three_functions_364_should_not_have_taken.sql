-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 365 — three functions 364 should not have taken.
--
-- 364 dropped every function whose body mentioned a doomed table, matching the
-- name as a word in prosrc. That matched two things it should not have:
--
--   get_module            the string literal 'events' — a JSON KEY in
--                         jsonb_build_object, not the events table
--   fork_installed_module the word "product" inside a comment quoting Foundry
--
-- Both are Workshop machinery and both are called by the app, which is how
-- `pnpm check:rpcs` caught it immediately. Restored verbatim from migrations
-- 315 and 311.
--
-- anonymize_user_pii was matched correctly — it nullified stock_logs.user_id —
-- but it is GDPR machinery, not hospitality. Restored without that statement:
-- the erasure record is what remains, and an object type that stores personal
-- data adds its own nullification.
--
-- The lesson for the next teardown: matching a table name in a function BODY
-- cannot tell an identifier from a comment or a string literal. The guard that
-- caught it is check:rpcs, which asks a different question — does every name
-- the app calls still exist.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

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
        'recompute', v.recompute, 'isInterface', v.is_interface) ORDER BY v.api_name)
      FROM module_variables v WHERE v.module_id = m.id), '[]'::jsonb),
    'layouts', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'apiName', l.api_name, 'title', l.title,
        'layoutType', l.layout_type, 'parentId', l.parent_id,
        'position', l.position, 'config', l.config)
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

CREATE OR REPLACE FUNCTION anonymize_user_pii(
  p_user_id    uuid,
  p_user_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id uuid := auth_hotel_id();
BEGIN
  -- Enforce caller is an admin or owner
  IF auth_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can anonymise user data';
  END IF;

  -- The only PII-bearing domain table was stock_logs.user_id, dropped with the
  -- hospitality schema in 364. The erasure record below is what remains; a new
  -- object type that stores personal data adds its own nullification here.

  -- Record the erasure request
  INSERT INTO gdpr_erasure_requests (
    hotel_id, subject_email, requested_by, status, processed_at
  )
  VALUES (
    v_hotel_id, p_user_email, auth.uid(), 'processed', now()
  );
END;
$$;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(n, ', ') INTO missing FROM unnest(ARRAY['get_module','fork_installed_module','anonymize_user_pii']) n
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = n
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 365: did not come back: %', missing;
  END IF;
END $$;

COMMIT;
