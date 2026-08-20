-- 592's `generate_interface_parameters` reads `ontology_interfaces.display_name`
-- and that column does not exist — the table calls it `label`, the way every
-- other ontology resource here does. The function would have raised on its first
-- call, and its first call is the one that makes an interface rule runnable.
--
-- Caught by the test rather than by review, which is the only reason it did not
-- ship: nothing in 592 exercised the function, and its own assertion block
-- checked the vocabulary and the backfill instead. An assertion that never calls
-- the thing it is asserting about proves the thing exists, not that it works.
--
-- The label follows the screenshot: the create rule's generated parameter reads
-- `Ticket type` for the `Ticket` interface
-- (action-types/images/action_on_interface_create_action.png).

CREATE OR REPLACE FUNCTION public.generate_interface_parameters(p_action_type uuid)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE r record; n int := 0; iface record; api text; pos int;
BEGIN
  SELECT coalesce(max(position), -1) + 1 INTO pos
    FROM public.action_type_parameters WHERE action_type_id = p_action_type;

  FOR r IN
    SELECT DISTINCT ON (kind, interface_id) kind, interface_id
      FROM public.action_type_rules
     WHERE action_type_id = p_action_type AND interface_id IS NOT NULL
       AND kind IN ('create_object_of_interface', 'modify_object_of_interface',
                    'delete_object_of_interface')
  LOOP
    SELECT * INTO iface FROM public.ontology_interfaces WHERE id = r.interface_id;

    IF r.kind = 'create_object_of_interface' THEN
      api := lower(left(iface.api_name, 1)) || right(iface.api_name, -1) || 'Type';
      IF NOT EXISTS (SELECT 1 FROM public.action_type_parameters
                      WHERE action_type_id = p_action_type AND data_kind = 'objectType') THEN
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, data_kind, required, position)
        VALUES (p_action_type, api, iface.label || ' type', NULL, 'objectType', true, pos);
        pos := pos + 1; n := n + 1;
      END IF;
    ELSE
      api := lower(left(iface.api_name, 1)) || right(iface.api_name, -1);
      IF NOT EXISTS (SELECT 1 FROM public.action_type_parameters
                      WHERE action_type_id = p_action_type
                        AND data_kind = 'interfaceObject' AND interface_id = r.interface_id) THEN
        INSERT INTO public.action_type_parameters
          (action_type_id, api_name, display_name, base_type, data_kind, interface_id, required, position)
        VALUES (p_action_type, api, iface.label, NULL, 'interfaceObject', r.interface_id, true, pos);
        pos := pos + 1; n := n + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN n;
END $fn$;

DO $$
DECLARE bad text;
BEGIN
  -- Assert by CALLING it, which is what 592 failed to do. An action type with no
  -- interface rules generates nothing and must not raise doing so.
  BEGIN
    PERFORM public.generate_interface_parameters(gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS bad = MESSAGE_TEXT;
    RAISE EXCEPTION 'generate_interface_parameters still raises: %', bad;
  END;
END $$;
