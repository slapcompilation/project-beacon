-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 335 — the collision guard was protecting ten names out of forty-two.
--
-- 333 refuses an authored action type that takes a code-defined name, so an
-- organization cannot redefine what ADJUST_STOCK means. I wrote that list BY
-- HAND, in two places — a text[] in the trigger and an array in TypeScript — and
-- both were wrong the moment they were written:
--
--   · the registry has 42 action types; the list had 12
--   · two of the twelve DO NOT EXIST — `CREATE_PURCHASE_ORDER` and
--     `SUBMIT_INVOICE`, where the real ones are `CREATE_PO` and
--     `SUBMIT_PO_INVOICE`
--
-- So the guard protected ten real names and left THIRTY-TWO takeable, including
-- CREATE_PO, MATCH_INVOICE, DELETE_SUPPLIER and UPDATE_PO_STATUS. An operator
-- authoring `MATCH_INVOICE` would have been accepted.
--
-- THE TYPESCRIPT SIDE IS NOW DERIVED — `Object.keys(actionDescriptors)` — so it
-- cannot drift again. SQL cannot import the registry, so this array is a COPY,
-- and a copy needs a guard: `authored.test.ts` reads this migration and fails if
-- the two disagree. One authority, one generated copy, one check that they match.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.refuse_shipped_action_name()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE shipped text[] := ARRAY[
  -- GENERATED from actionDescriptors. Do not edit by hand — regenerate and let
  -- the test confirm it. See migration header.
  'ADD_MENU_INGREDIENT', 'ADD_PICK_LIST_ITEM', 'ADJUST_STOCK', 'APPROVE_RESTOCK',
  'APPROVE_TRANSFER', 'ARCHIVE_MENU_ITEM', 'CANCEL_RESTOCK', 'CREATE_CATEGORY',
  'CREATE_EVENT', 'CREATE_LOCATION', 'CREATE_MENU_ITEM', 'CREATE_PICK_LIST',
  'CREATE_PO', 'CREATE_REMOVAL_REASON', 'CREATE_SUPPLIER', 'DELETE_CATEGORY',
  'DELETE_EVENT', 'DELETE_LOCATION', 'DELETE_PICK_LIST', 'DELETE_REMOVAL_REASON',
  'DELETE_SUPPLIER', 'LOG_DELIVERY', 'MATCH_INVOICE', 'RECEIVE_STOCK',
  'REJECT_RESTOCK', 'REMOVE_MENU_INGREDIENT', 'REMOVE_PICK_LIST_ITEM', 'REQUEST_RESTOCK',
  'REVERT_ACTION', 'SUBMIT_PO_INVOICE', 'TRANSFER_STOCK', 'UPDATE_CATEGORY',
  'UPDATE_EVENT', 'UPDATE_LOCATION', 'UPDATE_MENU_INGREDIENT', 'UPDATE_MENU_ITEM',
  'UPDATE_PICK_LIST', 'UPDATE_PICK_LIST_ITEM', 'UPDATE_PO_STATUS', 'UPDATE_REMOVAL_REASON',
  'UPDATE_SUPPLIER', 'WRITE_OFF'
];
BEGIN
  IF NEW.api_name = ANY (shipped) THEN
    RAISE EXCEPTION
      'Actions:NameIsShipped "%" is a code-defined action. Pick another name — a shipped action always wins.',
      NEW.api_name;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE v_org uuid; v_user uuid; v_type uuid; blocked int := 0; n text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'probe_collide', 'Probe Collide', v_user) RETURNING id INTO v_type;

    -- The four that were takeable an hour ago.
    FOREACH n IN ARRAY ARRAY['CREATE_PO', 'MATCH_INVOICE', 'DELETE_SUPPLIER', 'UPDATE_PO_STATUS'] LOOP
      BEGIN
        INSERT INTO user_action_types (organization_id, name, api_name, subject_type_id, operation, created_by_user_id)
        VALUES (v_org, 'x', n, v_type, 'modify', v_user);
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'Actions:NameIsShipped%' THEN blocked := blocked + 1; ELSE RAISE; END IF;
      END;
    END LOOP;

    IF blocked <> 4 THEN
      RAISE EXCEPTION 'Migration 335: only % of 4 previously-takeable shipped names are refused', blocked;
    END IF;

    -- And a name nobody shipped still goes through.
    INSERT INTO user_action_types (organization_id, name, api_name, subject_type_id, operation, parameters, created_by_user_id)
    VALUES (v_org, 'Close', 'CLOSE_PROBE', v_type, 'modify',
            '[{"key":"k","label":"K","type":"text","required":true}]'::jsonb, v_user);

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
