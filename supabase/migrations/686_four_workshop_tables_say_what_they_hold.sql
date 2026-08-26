-- 686: four Workshop tables say what they hold.
--
-- 685 commented workshop_modules, workshop_pages and workshop_sections and
-- left four bare. The catalog-hygiene test names them: every public table
-- says what it holds, and a table whose purpose lives only in the migration
-- that made it is a table the next reader has to reconstruct.
--
-- Each comment carries the sentence the table exists for, and its page.

COMMENT ON TABLE public.workshop_overlays IS
  'A layer over the selected page — "Overlays may be used when certain sections should only appear when contextually relevant in a workflow" (workshop/concepts-layouts). Two kinds only: drawers, which slide from a side at a width, and modals, which are centred.';

COMMENT ON TABLE public.workshop_widgets IS
  'One widget instance in a section or the module header — "Widgets display content to Workshop users and are the core building blocks of a module''s user interface" (workshop/concepts-widgets). Its kind must be one workshop_widget_kinds() has built; its setup is the JSON Foundry itself exposes as Raw Widget Configuration.';

COMMENT ON TABLE public.workshop_variables IS
  'How data moves through a module — "Variables are used by module builders to configure how data moves through a Workshop module" (workshop/concepts-variables). Twelve value types and six definition types, with names unique per module case-insensitively.';

COMMENT ON TABLE public.workshop_events IS
  'What a widget does when a user acts — "Events within Workshop modules enable you to trigger specific behavior whenever a user takes a given action" (workshop/concepts-events). Ordered rows, because order is the semantics: events run sequentially and do not wait for downstream recomputation.';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r'
     AND c.relname LIKE 'workshop%'
     AND obj_description(c.oid, 'pg_class') IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION '% workshop table(s) still say nothing about what they hold', n;
  END IF;
  RAISE NOTICE '686 proved: every workshop table now says what it holds';
END $$;
