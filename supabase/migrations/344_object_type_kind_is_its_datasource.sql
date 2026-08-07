-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 344 — Foundry has no built-in object types. Neither do we now.
--
-- `object_types.kind` (223) split the ontology into 'builtin' and 'authored'.
-- Foundry has no such taxonomy. Every object type there is created the same way;
-- the only variable is what backs it (`mirror/object-link-types/create-object-type.md`):
--
--   "If you have an existing datasource in Foundry containing data to back the
--    object type then you can select it... If you do not have an existing
--    datasource containing data for the object type, you can choose to continue
--    without an existing datasource and select a location to generate a dataset."
--
-- and `object-types-overview.md`: "Objects are created and displayed in user
-- applications by ADDING BACKING DATASOURCES to an object type." The axis is the
-- datasource. `marketplace-ontology-types.md` names the other end of it directly
-- — "Object types with no datasource" — as a category, not a kind of type.
--
-- We already store the datasource: `source_table`. And `kind` was exactly
-- derivable from it — 40 built-ins all with a source_table, 3 authored all
-- without, no exceptions. So this was not a badly-named column, it was a SECOND
-- ENCODING of one we already had, which is the failure the "two similar
-- functionalities" rule exists to catch. The datasource wins because it is
-- Foundry's axis and because it cannot lie: a type points at a real table or it
-- does not.
--
-- THIS CLOSES A LATENT HOLE. The INSERT policy checked `kind = 'authored'` and
-- said nothing about source_table, so an operator could author a type that named
-- `stock_logs` as its backing and have it treated as code-owned by every reader
-- downstream. Deriving from the datasource makes that unsayable: the policy now
-- requires source_table IS NULL, so an operator-authored type cannot claim a
-- code table at all.
--
-- `link_types.kind` is NOT touched. Checked, and it is not derivable there —
-- there is an authored join_table alongside built-in ones, so it carries
-- information `backing_kind` does not. Removing it needs its own evidence.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Policies: authored means "no backing datasource" ─────────────────────────
DROP POLICY IF EXISTS "admins author object types" ON public.object_types;
CREATE POLICY "admins author object types" ON public.object_types
  FOR INSERT TO authenticated
  WITH CHECK (
    source_table IS NULL
    AND auth_role() = ANY (ARRAY['owner','admin'])
    AND NOT (organization_id IS DISTINCT FROM auth_org_id())
    AND ((hotel_id IS NULL) OR hotel_is_in_user_scope(hotel_id))
    AND created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "admins update object types" ON public.object_types;
CREATE POLICY "admins update object types" ON public.object_types
  FOR UPDATE TO authenticated
  USING (
    source_table IS NULL
    AND NOT (organization_id IS DISTINCT FROM auth_org_id())
    AND (auth_role() = ANY (ARRAY['owner','admin'])
         OR has_resource_role('object_type', id, 'editor'))
  )
  WITH CHECK (
    -- Also stops an update ADDING a source_table to an authored type, which the
    -- old kind-based policy allowed.
    source_table IS NULL
    AND NOT (organization_id IS DISTINCT FROM auth_org_id())
    AND (auth_role() = ANY (ARRAY['owner','admin'])
         OR has_resource_role('object_type', id, 'editor'))
  );

DROP POLICY IF EXISTS "admins delete object types" ON public.object_types;
CREATE POLICY "admins delete object types" ON public.object_types
  FOR DELETE TO authenticated
  USING (
    source_table IS NULL
    AND auth_role() = ANY (ARRAY['owner','admin'])
    AND NOT (organization_id IS DISTINCT FROM auth_org_id())
  );

-- ── Functions ────────────────────────────────────────────────────────────────

-- Already carried `source_table IS NOT NULL` beside the kind check; now the
-- datasource is simply the whole test.
CREATE OR REPLACE FUNCTION public.builtin_property_drift()
RETURNS TABLE (api_name text, property_key text, problem text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT t.api_name, p->>'key',
         CASE WHEN c.column_name IS NULL THEN 'column no longer exists'
              ELSE 'column type changed to ' || c.data_type END
  FROM public.object_types t
  CROSS JOIN LATERAL jsonb_array_elements(t.properties) p
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = t.source_table AND c.column_name = p->>'key'
  WHERE t.source_table IS NOT NULL
    AND (
      c.column_name IS NULL
      OR NOT (
        (p->>'type') = CASE
           WHEN c.data_type IN ('integer','bigint','smallint','numeric','real','double precision') THEN 'number'
           WHEN c.data_type = 'boolean' THEN 'boolean'
           WHEN c.data_type LIKE 'timestamp%' OR c.data_type = 'date' THEN 'date'
           ELSE 'text' END
        OR (p->>'type' = 'media_reference' AND c.data_type = 'text')
        OR (p->>'type' = 'vector'          AND c.udt_name  = 'vector')
        OR (p->>'type' = 'geopoint'        AND c.data_type = 'text')
      )
    )
  UNION ALL
  SELECT t.api_name, t.title_key, 'title_key is not a property of this type'
  FROM public.object_types t
  WHERE t.source_table IS NOT NULL AND t.title_key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(t.properties) p WHERE p->>'key' = t.title_key
    );
$$;

REVOKE EXECUTE ON FUNCTION public.builtin_property_drift() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.builtin_property_drift() TO authenticated;

-- An authored action may only target an authored type, which is now the same
-- statement as "a type with no backing datasource".
CREATE OR REPLACE FUNCTION public.enforce_authored_action_subject()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE backed boolean;
BEGIN
  SELECT source_table IS NOT NULL INTO backed FROM object_types WHERE id = NEW.subject_type_id;
  IF backed IS NULL THEN
    RAISE EXCEPTION 'UserActionTypes:UnknownSubject: object type % does not exist', NEW.subject_type_id;
  END IF;
  IF backed THEN
    RAISE EXCEPTION 'UserActionTypes:BuiltInSubject: % is backed by a code-owned table; writing it needs a code-defined action', NEW.subject_type_id;
  END IF;
  RETURN NEW;
END;
$$;

-- The remaining three bodies are 61, 64 and 113 lines and only a PREDICATE
-- changes in each. Reproducing them by hand to alter one clause risks a
-- transcription error in a SECURITY DEFINER function — so the migration edits
-- exactly the substrings named below and asserts the result, rather than
-- retyping bodies it did not need to change.
DO $$
DECLARE
  r record;
  edits text[][] := ARRAY[
    -- adoption_metrics: authored types count toward operator adoption.
    ARRAY['adoption_metrics',
          'FROM object_types WHERE kind = ''authored''',
          'FROM object_types WHERE source_table IS NULL'],
    -- export_ontology_package: `t.` is object_types; `lt.kind` is link_types and
    -- must survive untouched. The leading space is load-bearing — without it
    -- this matches the tail of `lt.kind` too.
    ARRAY['export_ontology_package',
          ' t.kind = ''authored''',
          ' t.source_table IS NULL'],
    -- install_ontology_package: the object_types INSERT. The link_types INSERT a
    -- few lines below still writes `kind`, so both strings are anchored on
    -- title_key to keep this away from it.
    ARRAY['install_ontology_package',
          'title_key, kind, created_by_user_id)',
          'title_key, created_by_user_id)'],
    ARRAY['install_ontology_package',
          'e->>''title_key'', ''authored'', auth.uid());',
          'e->>''title_key'', auth.uid());']
  ];
  i int; def text; new_def text;
BEGIN
  FOR i IN 1 .. array_length(edits, 1) LOOP
    SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = edits[i][1] AND p.prokind = 'f';

    IF def IS NULL THEN
      RAISE EXCEPTION 'Migration 344: % not found', edits[i][1];
    END IF;
    IF position(edits[i][2] IN def) = 0 THEN
      RAISE EXCEPTION 'Migration 344: % does not contain the expected clause %',
        edits[i][1], edits[i][2];
    END IF;

    new_def := replace(def, edits[i][2], edits[i][3]);
    EXECUTE new_def;

    SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = edits[i][1] AND p.prokind = 'f';
    IF position(edits[i][2] IN def) > 0 THEN
      RAISE EXCEPTION 'Migration 344: % still contains %', edits[i][1], edits[i][2];
    END IF;
  END LOOP;
END $$;

-- ── The column goes ──────────────────────────────────────────────────────────
ALTER TABLE public.object_types DROP CONSTRAINT IF EXISTS object_types_kind_check;
ALTER TABLE public.object_types DROP COLUMN kind;

COMMENT ON COLUMN public.object_types.source_table IS
  'The backing datasource. NULL means the records live in object_records — Foundry''s "object type with no datasource". Set means a code-owned table, and operators cannot write such a row. This column is the authority; there is no separate kind.';

DO $$
DECLARE n int; leftover text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='object_types' AND column_name='kind') THEN
    RAISE EXCEPTION 'Migration 344: object_types.kind survived';
  END IF;

  -- Functions are not dependency-tracked against a dropped column, so a missed
  -- reference would only surface at runtime. Catch it here instead.
  -- `lt.kind` is link_types, which keeps its kind deliberately; strip those
  -- before looking, so the net stays tight on object_types.
  SELECT string_agg(p.proname, ', ') INTO leftover
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prokind = 'f'
    AND pg_get_functiondef(p.oid) LIKE '%object_types%'
    AND (replace(pg_get_functiondef(p.oid), 'lt.kind', 'LINKTYPECOL') LIKE '%kind = ''authored''%'
      OR replace(pg_get_functiondef(p.oid), 'lt.kind', 'LINKTYPECOL') LIKE '%kind = ''builtin''%');
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 344: function(s) still read object_types.kind: %', leftover;
  END IF;

  SELECT count(*) INTO n FROM builtin_property_drift();
  IF n > 0 THEN RAISE EXCEPTION 'Migration 344: % drift row(s) once kind stopped gating', n; END IF;

  SELECT count(*) INTO n FROM object_types WHERE source_table IS NOT NULL;
  IF n <> 40 THEN RAISE EXCEPTION 'Migration 344: expected 40 backed types, found %', n; END IF;

  SELECT count(*) INTO n FROM link_types WHERE kind IS NOT NULL;
  IF n = 0 THEN RAISE EXCEPTION 'Migration 344: link_types.kind was not supposed to change'; END IF;

  -- The policies must still be able to tell the two apart.
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname='public' AND tablename='object_types'
     AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%source_table IS NULL%';
  IF n <> 3 THEN RAISE EXCEPTION 'Migration 344: % of 3 write policies gate on the datasource', n; END IF;
END $$;

COMMIT;
