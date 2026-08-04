-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 327 — `promoted` moves to where Foundry keeps it.
--
-- Migration 321 put `promoted` in the ontology status enum, alongside active and
-- deprecated, because the ontology page lists it among "five values". That page
-- is not where the concept lives. Compass — the platform filesystem — owns it:
--
--   "Resource status allows you to indicate the importance of resources in the
--    platform... Currently, the only available status is Promoted."
--
-- So it is not a fifth developmental state competing with `active`. It is a
-- SEPARATE, BINARY axis over ANY resource, and the two compose: an object type
-- is `active` (developmental state) AND promoted (curated). Modelling it as an
-- enum member made those mutually exclusive, which is why promoting something
-- meant giving up saying it was active.
--
-- Its three effects are all discovery, and all of them are things a status enum
-- on one table cannot deliver:
--
--   "Search visibility: Promoted resources are BOOSTED IN SEARCH RESULTS ACROSS
--    THE PLATFORM for all users... Visual indicator: marked with a CHECKMARK
--    icon... Quick filters: appear in the Promoted items QUICK FILTER...
--    providing a CURATED CATALOG of the most useful projects, folders, files."
--
-- Across the platform — so modules and documents can be promoted too, not only
-- object types. One table, keyed by (kind, id).
--
-- REMOVING A PROMOTION IS DELETING THE ROW: "Select Change status, then Remove
-- status. The resource will return to its default state with no status applied."
-- No 'none' value, no nullable column — absence is the default state.
--
-- WHAT STAYS ON THE OBJECT TYPE is `visibility`, and that is deliberate: it is
-- ontology metadata in Foundry too (the ontology page owns prominent/normal/
-- hidden), and quicksearch ranks on it. The bridge between the two axes is
-- theirs as well — "setting an object type's status to promoted will
-- automatically set its visibility to prominent".
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.resource_status (
  -- Polymorphic by design: Compass status spans every resource kind. Each kind
  -- is reaped by its own trigger below, since a cross-kind FK is not expressible.
  resource_kind   text NOT NULL CHECK (resource_kind IN ('object_type', 'module', 'document')),
  resource_id     uuid NOT NULL,
  organization_id uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  -- "Currently, the only available status is Promoted." A one-value vocabulary
  -- looks odd and is theirs; the column is what makes room for the next one.
  status          text NOT NULL DEFAULT 'promoted' CHECK (status IN ('promoted')),
  promoted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  promoted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_kind, resource_id)
);

COMMENT ON TABLE public.resource_status IS
  'Compass resource status — currently only `promoted`. Boosts search ranking, marks the resource with a checkmark, and fills the promoted-items catalog. Removing a promotion deletes the row; absence is the default state.';

CREATE INDEX IF NOT EXISTS idx_resource_status_org ON public.resource_status (organization_id, resource_kind);

ALTER TABLE public.resource_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read resource status" ON public.resource_status;
CREATE POLICY "members read resource status" ON public.resource_status
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());

-- Foundry needs Editor on the resource AND Resource Curator at the space level.
-- We have neither role; admin/owner is the nearest tier and the divergence is
-- recorded in docs/DIVERGENCES.md against gap 6.
DROP POLICY IF EXISTS "curators promote resources" ON public.resource_status;
CREATE POLICY "curators promote resources" ON public.resource_status
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner', 'admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner', 'admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

-- ── The bridge: promoting an object type makes it prominent ─────────────────

CREATE OR REPLACE FUNCTION public.apply_promotion_visibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- "Setting an object type's status to promoted will automatically set its
  -- visibility to prominent." DEFINER for the same reason as migration 323: the
  -- database is holding its own invariant, and the curator need not also hold
  -- write rights on the ontology row.
  IF TG_OP = 'INSERT' AND NEW.resource_kind = 'object_type' THEN
    UPDATE object_types SET visibility = 'prominent'
     WHERE id = NEW.resource_id AND visibility <> 'prominent';
    RETURN NEW;
  END IF;
  -- Un-promoting returns it to the default. Foundry: "the resource will return
  -- to its default state".
  IF TG_OP = 'DELETE' AND OLD.resource_kind = 'object_type' THEN
    UPDATE object_types SET visibility = 'normal'
     WHERE id = OLD.resource_id AND visibility = 'prominent';
    RETURN OLD;
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

REVOKE ALL ON FUNCTION public.apply_promotion_visibility() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_promotion_visibility ON public.resource_status;
CREATE TRIGGER trg_promotion_visibility
  AFTER INSERT OR DELETE ON public.resource_status
  FOR EACH ROW EXECUTE FUNCTION public.apply_promotion_visibility();

-- ── A promotion does not outlive its resource ───────────────────────────────

CREATE OR REPLACE FUNCTION public.reap_resource_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM resource_status WHERE resource_kind = TG_ARGV[0] AND resource_id = OLD.id;
  RETURN OLD;
END $$;

REVOKE ALL ON FUNCTION public.reap_resource_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reap_resource_status ON public.object_types;
CREATE TRIGGER trg_reap_resource_status AFTER DELETE ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.reap_resource_status('object_type');
DROP TRIGGER IF EXISTS trg_reap_resource_status ON public.modules;
CREATE TRIGGER trg_reap_resource_status AFTER DELETE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.reap_resource_status('module');
DROP TRIGGER IF EXISTS trg_reap_resource_status ON public.documents;
CREATE TRIGGER trg_reap_resource_status AFTER DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.reap_resource_status('document');

-- ── `promoted` leaves the ontology enum ─────────────────────────────────────

-- Carry any promoted type across before narrowing the constraint. There are none
-- today; written so re-running on a database that has some does the right thing.
INSERT INTO public.resource_status (resource_kind, resource_id, organization_id, promoted_by)
SELECT 'object_type', o.id, o.organization_id, o.created_by_user_id
FROM public.object_types o WHERE o.status = 'promoted'
ON CONFLICT DO NOTHING;

UPDATE public.object_types SET status = 'active' WHERE status = 'promoted';

ALTER TABLE public.object_types DROP CONSTRAINT IF EXISTS object_types_status_check;
ALTER TABLE public.object_types ADD CONSTRAINT object_types_status_check
  CHECK (status IN ('active', 'experimental', 'deprecated', 'example'));

COMMENT ON COLUMN public.object_types.status IS
  'active | experimental | deprecated | example. Anything new starts experimental; an active resource can be neither deleted nor renamed. Promotion is NOT here — it is a Compass resource status, see resource_status.';

-- The status guard referenced 'promoted' in two places. Same behaviour, minus a
-- value the column can no longer hold.
CREATE OR REPLACE FUNCTION public.enforce_ontology_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION
        'Ontology:ResourceIsActive %.% is active and cannot be deleted. Mark it deprecated — with a reason, a deadline and ideally a replacement — or experimental first.',
        TG_TABLE_NAME, OLD.api_name;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.api_name IS DISTINCT FROM OLD.api_name AND OLD.status <> 'experimental' THEN
    RAISE EXCEPTION
      'Ontology:ResourceIsActive %.% is %; only an experimental resource may be renamed. Anything already built against "%" would break.',
      TG_TABLE_NAME, OLD.api_name, OLD.status, OLD.api_name;
  END IF;

  IF NEW.status <> 'deprecated' AND OLD.status = 'deprecated' THEN
    NEW.deprecation_reason := NULL;
    NEW.deprecation_deadline := NULL;
    NEW.replaced_by := NULL;
  END IF;

  RETURN NEW;
END $$;

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table', 'resource_status', 'platform',
   'Compass resource status. Which resources are curated, boosting them in search and filling the promoted-items catalog.')
ON CONFLICT (object_kind, object_name) DO UPDATE SET reason = EXCLUDED.reason;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_user uuid; v_t uuid; v_vis text; n int; claims text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;
  claims := json_build_object('sub', v_user,
    'app_metadata', json_build_object('org_id', v_org::text, 'role', 'admin'))::text;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_promo', 'Probe Promotion', v_user) RETURNING id INTO v_t;

    -- The enum can no longer hold it.
    BEGIN
      UPDATE object_types SET status = 'promoted' WHERE id = v_t;
      RAISE EXCEPTION 'Migration 327: object_types.status still accepts promoted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;

    -- Promoting is a row, and it makes the type prominent.
    INSERT INTO resource_status (resource_kind, resource_id, organization_id)
    VALUES ('object_type', v_t, v_org);
    RESET ROLE;
    SELECT visibility INTO v_vis FROM object_types WHERE id = v_t;
    IF v_vis <> 'prominent' THEN
      RAISE EXCEPTION 'Migration 327: promoting left visibility at %', v_vis;
    END IF;

    -- Removing it returns the resource to its default state.
    PERFORM set_config('request.jwt.claims', claims, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM resource_status WHERE resource_kind = 'object_type' AND resource_id = v_t;
    RESET ROLE;
    SELECT visibility INTO v_vis FROM object_types WHERE id = v_t;
    IF v_vis <> 'normal' THEN
      RAISE EXCEPTION 'Migration 327: un-promoting left visibility at %', v_vis;
    END IF;

    -- A promotion does not outlive its resource.
    INSERT INTO resource_status (resource_kind, resource_id, organization_id) VALUES ('object_type', v_t, v_org);
    DELETE FROM object_types WHERE id = v_t;
    SELECT count(*) INTO n FROM resource_status WHERE resource_id = v_t;
    IF n <> 0 THEN
      RAISE EXCEPTION 'Migration 327: % promotion row(s) outlived the deleted type', n;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
