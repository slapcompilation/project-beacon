-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 354 — link_types.kind goes the way object_types.kind went.
--
-- Migration 344 removed `kind` from object_types on this citation
-- (`mirror/object-link-types/create-object-type.md`): every object type is
-- created the same way, and the only variable is the backing datasource —
-- "If you have an existing datasource... you can select it... If you do not...
-- continue without an existing datasource and select a location to generate a
-- dataset." One class of thing, distinguished by its backing.
--
-- Link types are the same. `create-link-type.md` offers a choice of BACKING —
-- "Object type foreign keys" or a join dataset — and never a kind of link type.
-- Nothing in the link-type documentation splits them into authored and built-in.
--
-- 344 left this column alone for a stated reason: it was NOT derivable then,
-- because an authored join_table sat beside built-in ones, so `kind` carried
-- information `backing_kind` did not. That reason expired when migration 353
-- emptied the ontology. What remains is a non-Foundry taxonomy with no rows, and
-- `pnpm check:vocabulary` found it — "link_types.builtin: a CHECK value with no
-- code, no data and no declaration reads as a working feature and is not one."
--
-- The two package functions read `lt.kind = 'authored'` to decide what travels.
-- With the column gone the test becomes the backing: an authored link is one
-- stored in the generic object_links table, exactly as an authored object type
-- is one with no source_table.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Same technique as 344: these bodies are long and only a predicate changes.
-- Reproducing them by hand to alter one clause is how a transcription bug ships,
-- so the migration edits the named substrings and asserts the result.
DO $$
DECLARE
  edits text[][] := ARRAY[
    ARRAY['export_ontology_package',
          'lt.kind = ''authored''',
          'lt.backing_table = ''object_links'''],
    ARRAY['install_ontology_package',
          'cardinality, kind, created_by_user_id)',
          'cardinality, created_by_user_id)']
  ];
  i int; def text; new_def text;
BEGIN
  FOR i IN 1 .. array_length(edits, 1) LOOP
    SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = edits[i][1] AND p.prokind = 'f';

    IF def IS NULL THEN RAISE EXCEPTION 'Migration 354: % not found', edits[i][1]; END IF;
    IF position(edits[i][2] IN def) = 0 THEN
      RAISE EXCEPTION 'Migration 354: % does not contain %', edits[i][1], edits[i][2];
    END IF;

    new_def := replace(def, edits[i][2], edits[i][3]);
    EXECUTE new_def;

    SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = edits[i][1] AND p.prokind = 'f';
    IF position(edits[i][2] IN def) > 0 THEN
      RAISE EXCEPTION 'Migration 354: % still contains %', edits[i][1], edits[i][2];
    END IF;
  END LOOP;
END $$;

-- install_ontology_package also passed 'authored' positionally in the VALUES.
DO $$
DECLARE def text; new_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'install_ontology_package' AND p.prokind = 'f';

  IF position('''many_to_one''), ''authored''' IN def) > 0 THEN
    new_def := replace(def, '''many_to_one''), ''authored''', '''many_to_one'')');
    EXECUTE new_def;
  END IF;
END $$;

ALTER TABLE public.link_types DROP CONSTRAINT IF EXISTS link_types_kind_check;
ALTER TABLE public.link_types DROP COLUMN IF EXISTS kind;

COMMENT ON COLUMN public.link_types.backing_kind IS
  'How the relationship is stored: foreign_key, join_table or object_backed. Foundry offers a choice of backing and no kind of link type, so this is the only classification — see migration 354.';

DO $$
DECLARE leftover text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='link_types' AND column_name='kind') THEN
    RAISE EXCEPTION 'Migration 354: link_types.kind survived';
  END IF;

  -- Functions are not dependency-tracked against a dropped column.
  SELECT string_agg(p.proname, ', ') INTO leftover
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) LIKE '%link_types%'
    AND pg_get_functiondef(p.oid) LIKE '%lt.kind%';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 354: function(s) still read link_types.kind: %', leftover;
  END IF;
END $$;

COMMIT;
