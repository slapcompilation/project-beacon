-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 224 — Ontology interfaces (parity gap 2)
--
-- Foundry: "if new object types that implement the interface are introduced, the
-- workflow will be immediately compatible with the new object types without
-- additional refactors." That is the problem we have: an authored tool or agent
-- binds to ONE object type, so a second similar type forces re-authoring
-- everything. A tool written against an interface runs across every implementer,
-- including ones authored later.
--
-- Interfaces are abstract — no records, not instantiable. They are a SHAPE.
--
-- The load-bearing rule is conformance: a type may only claim an interface if it
-- actually has every required property at the required type. Enforced by trigger
-- here as well as in reality-graph, because the composer is one client and the
-- database is the last word.
--
-- Built-in types (migration 223) carry empty `properties`, so they cannot satisfy
-- any interface yet — they are naturally excluded until their schemas are
-- registered. That is honest rather than special-cased.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ontology_interfaces (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  api_name          text NOT NULL CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
  label             text NOT NULL CHECK (length(btrim(label)) > 0),
  description       text NOT NULL DEFAULT '',
  -- An interface with no properties promises nothing.
  properties        jsonb NOT NULL CHECK (jsonb_typeof(properties) = 'array' AND jsonb_array_length(properties) > 0),
  created_by_user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

-- Which types claim which interfaces. An object type may implement many.
CREATE TABLE IF NOT EXISTS public.object_type_interfaces (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  object_type_id    uuid NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  interface_id      uuid NOT NULL REFERENCES ontology_interfaces(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_type_id, interface_id)
);

CREATE INDEX IF NOT EXISTS idx_oti_interface ON public.object_type_interfaces (interface_id);

-- ── Conformance: the claim must be true ──────────────────────────────────────
-- Rejects an implementation whose type is missing a required property or has it
-- at the wrong type. Without this, "polymorphic" tools would break at read time
-- on a type that never had the shape.
CREATE OR REPLACE FUNCTION public.assert_interface_conformance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(format('%s (%s)', req->>'key', req->>'type'), ', ')
    INTO v_missing
  FROM ontology_interfaces i
  CROSS JOIN LATERAL jsonb_array_elements(i.properties) AS req
  WHERE i.id = NEW.interface_id
    AND NOT EXISTS (
      SELECT 1
      FROM object_types t
      CROSS JOIN LATERAL jsonb_array_elements(t.properties) AS p
      WHERE t.id = NEW.object_type_id
        AND p->>'key'  = req->>'key'
        AND p->>'type' = req->>'type'
    );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'type does not conform to the interface — missing or mistyped: %', v_missing
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.assert_interface_conformance() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_assert_interface_conformance ON public.object_type_interfaces;
CREATE TRIGGER trg_assert_interface_conformance
  BEFORE INSERT OR UPDATE ON public.object_type_interfaces
  FOR EACH ROW EXECUTE FUNCTION public.assert_interface_conformance();

-- ── RLS: same authoring shape as every other ontology artifact ───────────────
ALTER TABLE public.ontology_interfaces      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_type_interfaces   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read interfaces in scope" ON public.ontology_interfaces;
CREATE POLICY "members read interfaces in scope" ON public.ontology_interfaces
  FOR SELECT USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "admins author interfaces in scope" ON public.ontology_interfaces;
CREATE POLICY "admins author interfaces in scope" ON public.ontology_interfaces
  FOR ALL
  USING      (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "members read implementations in scope" ON public.object_type_interfaces;
CREATE POLICY "members read implementations in scope" ON public.object_type_interfaces
  FOR SELECT USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "admins manage implementations in scope" ON public.object_type_interfaces;
CREATE POLICY "admins manage implementations in scope" ON public.object_type_interfaces
  FOR ALL
  USING      (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());
