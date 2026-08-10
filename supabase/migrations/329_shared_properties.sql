-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 329 — one definition of `cost`, not one per object type.
--
-- Every object type redefines its own properties. `room`, `cost`, `reported_on`
-- exist several times over with independently-drifting labels and types, and
-- nothing notices. ONTOLOGY-PARITY-GAPS gap 3 has been open since the audit.
--
-- Foundry's answer, from shared-property-overview:
--
--   "A shared property is a property that can be used on multiple object types
--    in your ontology... you can model your data using a consistent property and
--    update `start date` metadata IN ONE PLACE instead of on each object type."
--
-- THE SENTENCE THAT DEFINES THE SHAPE, same page:
--
--   "While property metadata is shared across object types, THE UNDERLYING
--    OBJECT DATA IS NOT."
--
-- So this is not a column moved somewhere central. Each object type still stores
-- its own values; what is shared is the label, the description, the base type
-- and the visibility. A shared property has no data of its own.
--
-- WHAT IS INHERITED AND WHAT IS NOT, from create-shared-property and
-- use-shared-property. Inherited: name, description, base type, visibility.
-- NOT inherited, and this one is load-bearing:
--
--   "the property ID and API NAME of the object-specific property WILL REMAIN
--    UNCHANGED so as to not break existing downstream workflows that leverage
--    them."
--
-- Attaching a shared property must not rename anything. A tool, a module widget
-- or a view config referring to `unit_cost` keeps referring to `unit_cost` even
-- when it starts inheriting from the `cost` shared property. `required` also
-- stays per-object-type — Foundry keeps required-properties separate, and a
-- field can be mandatory on one type and optional on another.
--
-- AND THE INHERITED FIELDS GO READ-ONLY: "direct edits to property metadata that
-- is inherited from the shared property will be disabled." That is the entire
-- point — an editable copy is the drift we started with.
--
-- BASE TYPE MUST MATCH: "Base types are related to the underlying column type
-- and must match the column type in order to be applied on an object type."
-- Enforced in a trigger, because a `date` shared property on a `number` column
-- is a broken read, not a style choice.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.shared_properties (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  api_name           text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  label              text NOT NULL CHECK (length(btrim(label)) > 0),
  description        text NOT NULL DEFAULT '',
  -- Our PropertyType. Foundry's base types are richer; ours is the closed set
  -- the property editor already offers.
  base_type          text NOT NULL CHECK (base_type IN ('text', 'number', 'boolean', 'date')),
  -- "A prominent property will lead applications to show this property first to
  -- users. A hidden property will not appear in user applications."
  visibility         text NOT NULL DEFAULT 'normal' CHECK (visibility IN ('prominent', 'normal', 'hidden')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

COMMENT ON TABLE public.shared_properties IS
  'A property definition used by several object types. Metadata is shared; the data is not — each object type still stores its own values. Referenced from object_types.properties[].shared.';

ALTER TABLE public.shared_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read shared properties" ON public.shared_properties;
CREATE POLICY "members read shared properties" ON public.shared_properties
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "admins author shared properties" ON public.shared_properties;
CREATE POLICY "admins author shared properties" ON public.shared_properties
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner', 'admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner', 'admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

-- ── A property may only inherit from a compatible definition ────────────────

CREATE OR REPLACE FUNCTION public.enforce_shared_property_types()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE p jsonb; sp record;
BEGIN
  FOR p IN SELECT jsonb_array_elements(NEW.properties) LOOP
    CONTINUE WHEN coalesce(p->>'shared', '') = '';

    SELECT api_name, base_type INTO sp FROM shared_properties
     WHERE organization_id = NEW.organization_id AND api_name = p->>'shared';

    IF sp.api_name IS NULL THEN
      RAISE EXCEPTION 'Ontology:UnknownSharedProperty property "%" inherits from shared property "%", which does not exist in this organization.',
        p->>'key', p->>'shared';
    END IF;

    -- "Base types... must match the column type in order to be applied on an
    -- object type."
    IF p->>'type' IS DISTINCT FROM sp.base_type THEN
      RAISE EXCEPTION 'Ontology:SharedPropertyTypeMismatch property "%" is % but shared property "%" is %. A shared property can only be applied where the base type matches.',
        p->>'key', p->>'type', sp.api_name, sp.base_type;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shared_property_types ON public.object_types;
CREATE TRIGGER trg_shared_property_types
  BEFORE INSERT OR UPDATE OF properties ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shared_property_types();

-- ── A definition in use is not deleted out from under its users ─────────────

CREATE OR REPLACE FUNCTION public.guard_shared_property_in_use()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE users text[];
BEGIN
  -- The reference lives inside jsonb, so there is no FK to do this. Same
  -- protection, stated where it can be read.
  SELECT array_agg(DISTINCT o.label) INTO users
  FROM object_types o
  WHERE o.organization_id = OLD.organization_id
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.properties) p
                 WHERE p->>'shared' = OLD.api_name);

  IF users IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:SharedPropertyInUse "%" is used by %. Detach it there first.',
      OLD.api_name, array_to_string(users, ', ');
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_shared_property_in_use ON public.shared_properties;
CREATE TRIGGER trg_shared_property_in_use
  BEFORE DELETE ON public.shared_properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_shared_property_in_use();

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table', 'shared_properties', 'platform',
   'One definition of a property reused across object types. Metadata only — the data stays on each type. ONTOLOGY-PARITY-GAPS gap 3.')
ON CONFLICT (object_kind, object_name) DO UPDATE SET reason = EXCLUDED.reason;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_user uuid; v_t uuid; v_sp uuid; n int;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;

  BEGIN
    INSERT INTO shared_properties (organization_id, api_name, label, base_type, created_by_user_id)
    VALUES (v_org, 'probe_cost', 'Cost', 'number', v_user) RETURNING id INTO v_sp;

    -- A matching base type attaches.
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id, properties)
    VALUES (v_org, 'probe_sp_type', 'Probe Shared', v_user,
            '[{"key":"unit_cost","label":"Unit cost","type":"number","required":false,"shared":"probe_cost"}]'::jsonb)
    RETURNING id INTO v_t;

    -- A mismatched one does not.
    BEGIN
      UPDATE object_types SET properties =
        '[{"key":"unit_cost","label":"Unit cost","type":"date","required":false,"shared":"probe_cost"}]'::jsonb
       WHERE id = v_t;
      RAISE EXCEPTION 'Migration 329: a date property inherited from a number shared property';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:SharedPropertyTypeMismatch%' THEN RAISE; END IF;
    END;

    -- Nor does one naming a definition that does not exist.
    BEGIN
      UPDATE object_types SET properties =
        '[{"key":"unit_cost","label":"Unit cost","type":"number","required":false,"shared":"probe_nope"}]'::jsonb
       WHERE id = v_t;
      RAISE EXCEPTION 'Migration 329: a property inherited from a nonexistent shared property';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:UnknownSharedProperty%' THEN RAISE; END IF;
    END;

    -- A definition in use cannot be deleted.
    BEGIN
      DELETE FROM shared_properties WHERE id = v_sp;
      RAISE EXCEPTION 'Migration 329: a shared property was deleted while in use';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:SharedPropertyInUse%' THEN RAISE; END IF;
    END;

    -- Detaching frees it.
    UPDATE object_types SET properties =
      '[{"key":"unit_cost","label":"Unit cost","type":"number","required":false}]'::jsonb
     WHERE id = v_t;
    DELETE FROM shared_properties WHERE id = v_sp;
    SELECT count(*) INTO n FROM shared_properties WHERE id = v_sp;
    IF n <> 0 THEN RAISE EXCEPTION 'Migration 329: detaching did not free the definition'; END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
