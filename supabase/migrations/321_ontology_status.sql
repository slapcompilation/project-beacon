-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 321 — an ontology resource can be retired instead of deleted.
--
-- We have spent a fortnight finding things that outlived their purpose: 87
-- leftover modules, five superseded pages, a variable type with no consumer, a
-- recompute contract nobody read. Every one was found by hand, and the only two
-- states anything ever had were "here" and "gone".
--
-- Foundry has a first-class answer we did not copy. From
-- mirror/object-link-types/metadata-statuses.md:
--
--   "Every object type, property, link type, action, or interface in the
--    Ontology has a STATUS that indicates developmental state."
--
-- FIVE VALUES, theirs, including two nobody here would have invented:
--
--   promoted      object types only — a core, trusted resource vetted by an
--                 ontology owner; setting it also sets visibility to prominent
--   active        "actively in use... major breaking changes will not be made"
--   experimental  "still under development"  ← THE DEFAULT FOR ANYTHING NEW
--   deprecated    "will soon be deleted... should not be relied on"
--   example       "notional... NOT intended for use in production workflows"
--
-- DEPRECATION IS A RECORD, NOT A FLAG, and this is the part worth having. Theirs
-- carries three things:
--
--   "A description for why it is being deprecated; a deadline for when it is
--    expected to be deleted from the system; and the resource that is meant to
--    replace the one that is deprecated."
--
-- A reason, a date, and a successor — exactly what every manual sweep here
-- lacked, each one having to reconstruct why the thing was still in the tree.
--
-- WHAT THE STATUS FORBIDS, enforced rather than left as guidance:
--
--   "It cannot be deleted. A resource's status must be `experimental` or
--    `deprecated` before it can be deleted."
--   "The API name of an active resource cannot be changed. Changing an API name
--    is only possible for those marked as `experimental`."
--
-- CONSISTENCY BETWEEN A LINK AND ITS ENDS, also theirs:
--
--   "If at least one object type in a link type is changed to `experimental`,
--    the link type will automatically be changed to `experimental`." Same for
--    `example` and `deprecated`. A link cannot be healthier than what it joins.
--
-- EXISTING ROWS BECOME `active`, not the `experimental` default: they are relied
-- on by live applications today, which is what active means. The default governs
-- what gets created from here.
--
-- NOT the same as `object_types.enabled`, which is registration on/off. Status is
-- developmental state and visibility is discoverability; a hidden type still
-- works for everything already pointed at it.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── The columns ─────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['object_types', 'link_types', 'ontology_interfaces'] LOOP
    EXECUTE format($f$
      ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'experimental',
        ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'normal',
        ADD COLUMN IF NOT EXISTS deprecation_reason text,
        ADD COLUMN IF NOT EXISTS deprecation_deadline date,
        ADD COLUMN IF NOT EXISTS replaced_by text
    $f$, t);

    -- What exists today is relied on by live applications.
    EXECUTE format($f$UPDATE public.%I SET status = 'active' WHERE status = 'experimental'$f$, t);

    -- `promoted` is object types only — "not available for properties, link
    -- types, action types or interfaces".
    EXECUTE format($f$ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I$f$, t, t || '_status_check');
    EXECUTE format($f$ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (status IN (%s))$f$,
      t, t || '_status_check',
      CASE WHEN t = 'object_types'
           THEN $vals$'promoted','active','experimental','deprecated','example'$vals$
           ELSE $vals$'active','experimental','deprecated','example'$vals$ END);

    EXECUTE format($f$ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I$f$, t, t || '_visibility_check');
    EXECUTE format($f$
      ALTER TABLE public.%I ADD CONSTRAINT %I
        CHECK (visibility IN ('prominent','normal','hidden'))
    $f$, t, t || '_visibility_check');

    -- Deprecation without a reason and a deadline is the flag we already had.
    EXECUTE format($f$ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I$f$, t, t || '_deprecation_documented');
    EXECUTE format($f$
      ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
        status <> 'deprecated'
        OR (deprecation_reason IS NOT NULL AND btrim(deprecation_reason) <> ''
            AND deprecation_deadline IS NOT NULL))
    $f$, t, t || '_deprecation_documented');
  END LOOP;
END $$;

COMMENT ON COLUMN public.object_types.status IS
  'promoted | active | experimental | deprecated | example. Anything new starts experimental; an active resource can be neither deleted nor renamed.';
COMMENT ON COLUMN public.object_types.visibility IS
  'prominent | normal | hidden — where the type surfaces in search and browsing. Distinct from enabled, which is registration on/off.';
COMMENT ON COLUMN public.object_types.replaced_by IS
  'api_name of the resource meant to replace this one. Foundry asks for it when deprecating; a deprecation naming no successor leaves the next reader to guess.';

-- ── What the status forbids ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_ontology_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Guarded for operator sessions only. Deleting an organization cascades to
    -- its object types, and an unconditional guard would make an org
    -- undeletable — a protection on the wrong thing. Service-role paths are our
    -- own code and covered by the ratchets; this stops a person removing
    -- something a live application reads.
    IF OLD.status IN ('active', 'promoted') AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION
        'Ontology:ResourceIsActive %.% is % and cannot be deleted. Mark it deprecated — with a reason, a deadline and ideally a replacement — or experimental first.',
        TG_TABLE_NAME, OLD.api_name, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  -- "Changing an API name is only possible for those marked as experimental."
  -- Unconditional: a rename breaks everything pointed at the old name whoever
  -- performs it, and nothing cascades a rename.
  IF NEW.api_name IS DISTINCT FROM OLD.api_name AND OLD.status <> 'experimental' THEN
    RAISE EXCEPTION
      'Ontology:ResourceIsActive %.% is %; only an experimental resource may be renamed. Anything already built against "%" would break.',
      TG_TABLE_NAME, OLD.api_name, OLD.status, OLD.api_name;
  END IF;

  -- "Setting an object type's status to promoted will automatically set its
  -- visibility to prominent." Only when the caller did not say otherwise in the
  -- same statement.
  IF NEW.status = 'promoted' AND NEW.visibility IS NOT DISTINCT FROM OLD.visibility THEN
    NEW.visibility := 'prominent';
  END IF;

  -- Leaving deprecation behind takes the paperwork with it.
  IF NEW.status <> 'deprecated' AND OLD.status = 'deprecated' THEN
    NEW.deprecation_reason := NULL;
    NEW.deprecation_deadline := NULL;
    NEW.replaced_by := NULL;
  END IF;

  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['object_types', 'link_types', 'ontology_interfaces'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_status_guard ON public.%I', t);
    EXECUTE format($f$
      CREATE TRIGGER trg_status_guard
      BEFORE UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.enforce_ontology_status()
    $f$, t);
  END LOOP;
END $$;

-- ── A link is never healthier than the object types it joins ────────────────

CREATE OR REPLACE FUNCTION public.sync_link_type_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE weakest text;
BEGIN
  -- Deprecated is the strongest signal, then example, then experimental: a link
  -- into something scheduled for deletion is itself scheduled for deletion.
  SELECT CASE
           WHEN bool_or(o.status = 'deprecated')   THEN 'deprecated'
           WHEN bool_or(o.status = 'example')      THEN 'example'
           WHEN bool_or(o.status = 'experimental') THEN 'experimental'
           ELSE NULL
         END
    INTO weakest
  FROM object_types o
  WHERE o.id IN (NEW.source_object_type_id, NEW.target_object_type_id);

  -- Downward only. Both ends turning active does not restore a link somebody
  -- deliberately marked experimental.
  IF weakest IS NOT NULL AND NEW.status <> weakest THEN
    NEW.status := weakest;
    IF weakest = 'deprecated' AND NEW.deprecation_reason IS NULL THEN
      NEW.deprecation_reason := 'An object type this link joins is deprecated.';
      NEW.deprecation_deadline := coalesce(NEW.deprecation_deadline, current_date + 90);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_link_status_follows_ends ON public.link_types;
CREATE TRIGGER trg_link_status_follows_ends
  BEFORE INSERT OR UPDATE ON public.link_types
  FOR EACH ROW EXECUTE FUNCTION public.sync_link_type_status();

CREATE OR REPLACE FUNCTION public.cascade_object_type_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Touch the links so the trigger above recomputes from both ends. The
  -- precedence lives in one place rather than being restated here.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('experimental', 'example', 'deprecated') THEN
    UPDATE link_types SET status = status
     WHERE source_object_type_id = NEW.id OR target_object_type_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_object_type_status_cascade ON public.object_types;
CREATE TRIGGER trg_object_type_status_cascade
  AFTER UPDATE OF status ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.cascade_object_type_status();

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_user uuid; v_a uuid; v_b uuid; v_link uuid; v_status text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;

  BEGIN
    -- The delete guard is scoped to operator sessions, so the probe needs one.
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_status_a', 'A', v_user) RETURNING id INTO v_a;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_status_b', 'B', v_user) RETURNING id INTO v_b;

    -- "By default, any new ontological resource will be given the experimental
    -- status."
    SELECT status INTO v_status FROM object_types WHERE id = v_a;
    IF v_status <> 'experimental' THEN
      RAISE EXCEPTION 'Migration 321: a new object type defaulted to %, not experimental', v_status;
    END IF;

    -- Experimental may be renamed; active may not.
    UPDATE object_types SET api_name = 'probe_status_a2' WHERE id = v_a;
    UPDATE object_types SET status = 'active' WHERE id = v_a;
    BEGIN
      UPDATE object_types SET api_name = 'probe_status_a3' WHERE id = v_a;
      RAISE EXCEPTION 'Migration 321: an active object type was renamed';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:ResourceIsActive%' THEN RAISE; END IF;
    END;

    -- Active may not be deleted.
    BEGIN
      DELETE FROM object_types WHERE id = v_a;
      RAISE EXCEPTION 'Migration 321: an active object type was deleted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Ontology:ResourceIsActive%' THEN RAISE; END IF;
    END;

    -- Deprecating with no reason and no deadline is refused.
    BEGIN
      UPDATE object_types SET status = 'deprecated' WHERE id = v_a;
      RAISE EXCEPTION 'Migration 321: a resource was deprecated with no reason or deadline';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- A link follows the weaker of its two ends.
    UPDATE object_types SET status = 'active' WHERE id = v_b;
    INSERT INTO link_types (organization_id, source_object_type_id, target_object_type_id,
                            api_name, label, target_api_name, target_label,
                            cardinality, backing_kind, backing_table, created_by_user_id)
    VALUES (v_org, v_a, v_b, 'probe_status_link', 'Probe', 'probe_status_link', 'Probe',
            'many_to_many', 'join_table', 'object_links', v_user)
    RETURNING id INTO v_link;
    UPDATE link_types SET status = 'active' WHERE id = v_link;

    UPDATE object_types SET status = 'deprecated',
           deprecation_reason = 'Replaced by the b shape',
           deprecation_deadline = current_date + 30,
           replaced_by = 'probe_status_b'
     WHERE id = v_a;

    SELECT status INTO v_status FROM link_types WHERE id = v_link;
    IF v_status <> 'deprecated' THEN
      RAISE EXCEPTION 'Migration 321: deprecating an end left its link %', v_status;
    END IF;

    -- Deprecated may be deleted — that is the whole point of the state.
    DELETE FROM link_types WHERE id = v_link;
    DELETE FROM object_types WHERE id = v_a;

    -- promoted forces prominent visibility.
    UPDATE object_types SET status = 'promoted' WHERE id = v_b;
    SELECT visibility INTO v_status FROM object_types WHERE id = v_b;
    IF v_status <> 'prominent' THEN
      RAISE EXCEPTION 'Migration 321: promoted left visibility at %', v_status;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    PERFORM set_config('request.jwt.claims', '', true);
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
