-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 322 — which status wins when a link's two ends disagree.
--
-- 321 shipped the cascade with `example` beating `experimental`, on nothing more
-- than the order the three bullets appear in the docs. Re-reading the page for
-- the test, the bullets are three separate rules that COLLIDE, and only one
-- collision is settled — by the table, not the prose:
--
--   |            | EXPERIMENTAL     | ACTIVE                  | DEPRECATED      |
--   | EXPERIMENTAL | experimental only | experimental only     | deprecated only |
--   | ACTIVE       | experimental only | experimental/active/deprecated | deprecated only |
--   | DEPRECATED   | deprecated only   | deprecated only       | deprecated only |
--
-- So deprecated beats experimental — the "deprecated only" corners. The table
-- has no `example` column at all, so example-vs-experimental is OURS to decide,
-- and the stage directive says to say so rather than invent a citation.
--
-- We pick EXPERIMENTAL, because the two statuses assert different kinds of
-- thing. `example` is provenance — "the resource has been installed as an
-- example" — and a link with one end that was not installed as an example was
-- not either; marking it example states something false. `experimental` is
-- development state, and a link into a half-built type is under development
-- whichever way you look at it. Between a false label and a true one, take the
-- true one.
--
-- Recorded in docs/DIVERGENCES.md as ours, not theirs.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_link_type_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE weakest text;
BEGIN
  SELECT CASE
           WHEN bool_or(o.status = 'deprecated')   THEN 'deprecated'
           WHEN bool_or(o.status = 'experimental') THEN 'experimental'
           WHEN bool_or(o.status = 'example')      THEN 'example'
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

DO $$
DECLARE v_org uuid; v_user uuid; v_a uuid; v_b uuid; v_link uuid; v_status text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_prec_a', 'A', v_user) RETURNING id INTO v_a;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_prec_b', 'B', v_user) RETURNING id INTO v_b;

    INSERT INTO link_types (organization_id, source_object_type_id, target_object_type_id,
                            api_name, label, target_api_name, target_label,
                            cardinality, backing_kind, backing_table, created_by_user_id)
    VALUES (v_org, v_a, v_b, 'probe_prec_link', 'Probe', 'probe_prec_link', 'Probe',
            'many_to_many', 'join_table', 'object_links', v_user)
    RETURNING id INTO v_link;

    -- One end example, the other experimental: the link is under development,
    -- and it was not installed as an example.
    UPDATE object_types SET status = 'example' WHERE id = v_a;
    SELECT status INTO v_status FROM link_types WHERE id = v_link;
    IF v_status <> 'experimental' THEN
      RAISE EXCEPTION 'Migration 322: example vs experimental gave %', v_status;
    END IF;

    -- Both example: nothing to contradict the provenance.
    UPDATE object_types SET status = 'example' WHERE id = v_b;
    SELECT status INTO v_status FROM link_types WHERE id = v_link;
    IF v_status <> 'example' THEN
      RAISE EXCEPTION 'Migration 322: two example ends gave %', v_status;
    END IF;

    -- Deprecated still beats everything — the one corner the table settles.
    UPDATE object_types SET status = 'deprecated', deprecation_reason = 'probe',
           deprecation_deadline = current_date + 1 WHERE id = v_a;
    SELECT status INTO v_status FROM link_types WHERE id = v_link;
    IF v_status <> 'deprecated' THEN
      RAISE EXCEPTION 'Migration 322: a deprecated end gave %', v_status;
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
