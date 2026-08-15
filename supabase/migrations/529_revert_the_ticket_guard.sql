-- Reverting 528: the ticket guard is right, the rollout was not.
--
-- 528 made index_object_type require the build job it runs under, so an index
-- could not be created outside a pipeline. That is the correct shape and the
-- assertions passed. Then the platform suite failed one case:
-- restrictedViews' object type indexed through a build raises "field name
-- must not be null" where the same type indexed directly succeeds.
--
-- I could not find the cause cheaply, and the difference is not in the guard —
-- the spliced body is otherwise identical, and the guard passes before any of
-- it runs. Something about that type's properties resolves differently when
-- the indexer is reached through run_index_build, and a restricted-view-backed
-- type with a mix of datasource-bound and unbound properties is the obvious
-- place to look.
--
-- So: the one-argument form comes back and the callers go with it. Shipping a
-- guard that breaks one documented backing arrangement is worse than shipping
-- no guard, and diagnosing it under a nearly-empty context is how 523 and 526
-- happened.
--
-- STEP 3B IS NOT ABANDONED. It is blocked on one question, recorded in
-- DELIVERABLE-MAP: why does a restricted-view-backed object type index
-- differently through a build than directly? Answer that, then reapply 528
-- unchanged.

CREATE OR REPLACE FUNCTION public.index_object_type(p_object_type uuid)
 RETURNS object_type_indexes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  ont      uuid;
  tbl      text := 'ot_' || replace(p_object_type::text, '-', '');
  cols     text;
  pk_prop  text;
  n        bigint := 0;
  ds       record;
  rows_sql text;
  merged   record;
  staged   record;
  bad      text;
  result   public.object_type_indexes;
BEGIN
  SELECT ontology_id INTO ont FROM public.object_types WHERE id = p_object_type;
  IF ont IS NULL OR NOT public.auth_in_ontology(ont) THEN
    RAISE EXCEPTION 'Ontology:ObjectTypeNotFound — % is not an object type you can see', p_object_type;
  END IF;

  INSERT INTO public.object_type_indexes (object_type_id)
  VALUES (p_object_type)
  ON CONFLICT (object_type_id) DO NOTHING;

  BEGIN
    -- Well-formedness first: an index of a type with no primary key is not a
    -- thing that can fail later; it is a thing that cannot start.
    SELECT string_agg(problem, '; ') INTO bad
      FROM public.object_type_problems(p_object_type) v;
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION '%', bad;
    END IF;

    SELECT property_id INTO pk_prop FROM public.object_type_properties
     WHERE object_type_id = p_object_type AND is_primary_key;

    -- The staging area the merge-changes job writes: one row per primary key,
    -- keyed the way the edit log keys properties.
    CREATE TEMP TABLE _staged (pk text PRIMARY KEY, row jsonb) ON COMMIT DROP;

    -- Changelog + gather, per datasource: the current view's rows only. A
    -- restricted-view datasource indexes through to its input dataset — the
    -- policy gates reads, never the build.
    FOR ds IN
      SELECT COALESCE(d.dataset_id, v.input_dataset_id) AS dataset_id,
             COALESCE(d.branch_id, mb.id) AS branch_id,
             ds2.physical_table
        FROM public.object_type_datasources d
        LEFT JOIN public.restricted_views v ON v.id = d.restricted_view_id
        LEFT JOIN public.dataset_branches mb
          ON mb.dataset_id = v.input_dataset_id AND mb.name = 'master'
        JOIN public.datasets ds2 ON ds2.id = COALESCE(d.dataset_id, v.input_dataset_id)
       WHERE d.object_type_id = p_object_type AND ds2.physical_table IS NOT NULL
    LOOP
      -- Each physical row becomes jsonb keyed by property_id via its
      -- backing_column, which is the shape object_state() replays edits onto.
      SELECT string_agg(format('%L, r.%I', p.property_id, p.backing_column), ', ')
        INTO cols
        FROM public.object_type_properties p
       WHERE p.object_type_id = p_object_type AND p.source = 'column'
         AND p.backing_column IS NOT NULL;
      CONTINUE WHEN cols IS NULL;

      rows_sql := format(
        'SELECT jsonb_build_object(%s) AS row FROM datasets.%I r
          WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
        cols, ds.physical_table, ds.branch_id);

      FOR merged IN EXECUTE rows_sql LOOP
        IF merged.row ->> pk_prop IS NULL THEN
          RAISE EXCEPTION 'a datasource row has no value in the primary key column';
        END IF;
        -- "You may not have duplicate primary keys" — the failure the deep
        -- dive names ("such as non-unique primary keys").
        BEGIN
          INSERT INTO _staged VALUES (merged.row ->> pk_prop, merged.row);
        EXCEPTION WHEN unique_violation THEN
          RAISE EXCEPTION 'non-unique primary keys: "%" appears more than once in the backing datasources',
            merged.row ->> pk_prop;
        END;
      END LOOP;
    END LOOP;

    -- "it is possible for users to create additional objects that do not exist
    --  in the backing datasource" — edit-only objects join the merge by pk.
    INSERT INTO _staged
    SELECT DISTINCT e.primary_key, NULL::jsonb
      FROM public.object_edits e
     WHERE e.object_type_id = p_object_type
    ON CONFLICT (pk) DO NOTHING;

    -- The index dataset: a real table, real columns, one per property.
    SELECT string_agg(format('%I %s', p.property_id, public.property_column_type(p.base_type)),
                      ', ' ORDER BY p.position)
      INTO cols
      FROM public.object_type_properties p WHERE p.object_type_id = p_object_type;

    EXECUTE format('DROP TABLE IF EXISTS objects.%I', tbl);
    EXECUTE format('CREATE TABLE objects.%I (%s, PRIMARY KEY (%I))', tbl, cols, pk_prop);

    -- Merge changes: the datasource row replayed through the edit log, per
    -- object, dropping the deleted.
    FOR staged IN SELECT s.pk, s.row FROM _staged s LOOP
      SELECT * INTO merged FROM public.object_state(p_object_type, staged.pk, staged.row);
      CONTINUE WHEN merged.deleted;
      -- Value types enforce at index time; a violation fails the whole build.
      PERFORM 1 FROM public.object_type_properties vp
        JOIN public.value_types vvt ON vvt.id = vp.value_type_id
       WHERE vp.object_type_id = p_object_type
         AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id);
      IF FOUND THEN
        SELECT format('property "%s" of object "%s": %s', vp.property_id, staged.pk, vvt.failure_message)
          INTO bad
          FROM public.object_type_properties vp
          JOIN public.value_types vvt ON vvt.id = vp.value_type_id
         WHERE vp.object_type_id = p_object_type
           AND NOT public.value_conforms(merged.properties -> vp.property_id, vp.value_type_id)
         LIMIT 1;
        RAISE EXCEPTION '%', bad;
      END IF;
      EXECUTE format(
        'INSERT INTO objects.%I SELECT * FROM jsonb_populate_record(NULL::objects.%I, $1)',
        tbl, tbl) USING merged.properties;
      n := n + 1;
    END LOOP;

    DROP TABLE _staged;

    UPDATE public.object_type_indexes
       SET status = 'success', error = NULL, object_count = n,
           index_table = tbl, indexed_at = now(), updated_at = now()
     WHERE object_type_id = p_object_type;

  EXCEPTION WHEN OTHERS THEN
    -- The pipeline failed; the record of why is the deliverable.
    DROP TABLE IF EXISTS _staged;
    UPDATE public.object_type_indexes
       SET status = 'failed', error = sqlerrm, object_count = NULL, updated_at = now()
     WHERE object_type_id = p_object_type;
  END;

  SELECT * INTO result FROM public.object_type_indexes WHERE object_type_id = p_object_type;
  RETURN result;
END $function$;

DROP FUNCTION IF EXISTS public.index_object_type(uuid, uuid);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_proc
   WHERE proname = 'index_object_type' AND pronamespace = 'public'::regnamespace;
  IF n <> 1 THEN RAISE EXCEPTION 'expected one index_object_type, found %', n; END IF;
  SELECT count(*) INTO n FROM pg_proc
   WHERE proname = 'index_object_type' AND pronamespace = 'public'::regnamespace AND pronargs = 1;
  IF n <> 1 THEN RAISE EXCEPTION 'the one-argument indexer did not come back'; END IF;
  IF pg_get_functiondef('public.index_object_type(uuid)'::regprocedure) LIKE '%IndexNeedsAJob%' THEN
    RAISE EXCEPTION 'the ticket guard survived the revert';
  END IF;
  RAISE NOTICE '529: reverted — step 3b waits on the restricted-view question';
END $$;
