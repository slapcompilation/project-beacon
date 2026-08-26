-- 698: 696 was STRICTER THAN FOUNDRY. A card is added first and configured
-- after, so its output type may not be known yet.
--
-- The post-build reconciliation re-read analysis-canvas and analysis-graph
-- whole. 696's guard_quiver_card_kind refused to INSERT a card whose kind
-- emits more than one type until the card said which — an object property
-- emits String, Number or Time depending on the property picked, so 696
-- demanded the property be chosen before the card could exist. Foundry does
-- the opposite: the card lands unconfigured and is configured in place.
--
--   "This gets added to the bottom of the canvas, and requires manual configuration of the object set input."
--   — quiver/analysis-canvas.md
--
-- and an unconfigured or broken card is a state Quiver tolerates rather than
-- refuses:
--
--   "Note that downstream cards may enter an errored state after this action."
--   — quiver/analysis-graph.md
--
-- THE RULE THAT ACTUALLY HOLDS is the one the data model page states, and it
-- is about CHAINING, not about existing:
--
--   "A card can only be added as an input to another card if that card's output type is equal to the downstream card's input type."
--   — quiver/analysis-data-model.md
--
-- So the refusal moves one step later. A polymorphic card may be created
-- with no output_type; it simply cannot be used as another card's input
-- until it has one, which guard_quiver_card_input already says with
-- Quiver:NoOutputType. That refusal existed in 696 and was UNREACHABLE,
-- because the insert-time check stood in front of it — a guard nothing could
-- make fire.
--
-- Patched from pg_get_functiondef; the two other arms of the function (the
-- unknown kind and the undeclared output type) are unchanged.

DO $$
DECLARE src text; out text; anchor text;
BEGIN
  src := replace(pg_get_functiondef('public.guard_quiver_card_kind()'::regprocedure), chr(13), '');
  anchor := '  IF NEW.output_type IS NULL AND array_length(k.output_types, 1) > 1 THEN
    RAISE EXCEPTION ''Quiver:OutputTypeAmbiguous — % emits one of %, so the card must say which'', k.title, array_to_string(k.output_types, '', '');
  END IF;
';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'the ambiguity arm does not occur exactly once';
  END IF;
  out := replace(src, anchor, '');
  EXECUTE out;
END $$;

COMMENT ON FUNCTION public.guard_quiver_card_kind() IS
  'A card''s kind must be one Quiver documents and one we have built, and an output_type it names must be one its kind declares. It need NOT name one yet: "This gets added to the bottom of the canvas, and requires manual configuration of the object set input" (quiver/analysis-canvas). The type rule is about chaining, and lives in guard_quiver_card_input.';
COMMENT ON COLUMN public.quiver_cards.output_type IS
  'The one type this card emits, once configured. NULL while the card is unconfigured and its kind emits several — legal, because Quiver adds a card before it is configured. What it blocks is being used as an input: guard_quiver_card_input raises Quiver:NoOutputType.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; a uuid;
  root uuid; sel uuid; prop uuid;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('qv-698') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('qv-698') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qv698@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'qv698@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'qv_698', 'Quiver 698') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    SELECT public.create_quiver_analysis(proj, 'Unconfigured') INTO a;

    -- 1. THE CORRECTION: a polymorphic card lands unconfigured. 696 refused
    --    this with Quiver:OutputTypeAmbiguous.
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-object-property', 'Some property') RETURNING id INTO prop;
    IF (SELECT output_type FROM public.quiver_cards WHERE id = prop) IS NOT NULL THEN
      RAISE EXCEPTION 'an output type was invented for the card';
    END IF;

    -- 2. It cannot be CHAINED yet, which is where the rule actually lives —
    --    and this is the arm 696 made unreachable.
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-import-saved-object-set', 'Machines') RETURNING id INTO root;
    INSERT INTO public.quiver_cards (analysis_id, kind, title)
    VALUES (a, 'card-numeric-formula', 'Twice') RETURNING id INTO sel;
    BEGIN
      INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (sel, prop);
      RAISE EXCEPTION 'an unconfigured card was chained';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:NoOutputType%' THEN
        RAISE EXCEPTION 'the unreachable arm still does not fire; got: %', SQLERRM;
      END IF;
    END;

    -- 3. Configure it, and the same edge is legal.
    UPDATE public.quiver_cards SET output_type = 'Number' WHERE id = prop;
    INSERT INTO public.quiver_card_inputs (card_id, input_card_id) VALUES (sel, prop);

    -- 4. Configuring it to a type its kind does not emit is still refused.
    BEGIN
      UPDATE public.quiver_cards SET output_type = 'Object set' WHERE id = prop;
      RAISE EXCEPTION 'an undeclared output type was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Quiver:OutputTypeNotDeclared%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '698 proved, as the caller: a polymorphic card is created unconfigured with a NULL output type (696 refused it); chaining off it raises Quiver:NoOutputType, the arm 696 had made unreachable; configuring it makes the same edge legal; and an output type its kind does not declare is still refused';
  END;
END $$;
