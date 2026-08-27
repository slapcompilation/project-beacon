-- 706: the post-build re-read caught the compiler NARROWER than the page.
--
-- 705 compiled a pivoted histogram as count(*) alone. The board's own
-- section — which I had only read as far as the matrix when 705 shipped —
-- prints the general form as its SQL equivalent ("SELECT
-- start_neighborhood, mean(trip_time_in_secs) … GROUP BY") and enumerates
-- the aggregates:
--
--   "The available aggregate metrics are: **Count** (number of records), **Unique Count**, **Min**, **Max**, **Sum**, **Mean**, **Approx. median**, **Standard Deviation**, and **Variance**."
--   — contour/boards-descriptions.md
--
--   "Except for **Count**, you must specify which column the aggregate applies to. For **Unique Count**, you can select any column."
--   — contour/boards-descriptions.md
--
-- So the pivot arm now honors configuration.agg and configuration.value_column,
-- refusing an aggregate outside the nine by name. Two divergences, scoped:
-- Approx. median calls Spark's percentile_approx in Foundry; ours is
-- percentile_cont(0.5), exact — same number, different algorithm. And the
-- names compile to Postgres aggregates, the 705 divergence continued.
--
-- Patched from pg_get_functiondef; nothing else in the function moves.

DO $$
DECLARE src text; anchor text; replacement text;
BEGIN
  src := replace(pg_get_functiondef('public.compile_contour_path(uuid)'::regprocedure), chr(13), '');
  anchor := '      IF b.pivoted THEN
        sql_text := format(''SELECT %I, count(*) AS count FROM (%s) AS s GROUP BY %I'',
                           col, sql_text, col);
        agg := true;
      END IF;';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'the pivot arm does not occur exactly once';
  END IF;
  replacement := '      IF b.pivoted THEN
        -- the nine aggregates the page enumerates; count needs no column
        op := coalesce(b.configuration ->> ''agg'', ''count'');
        IF op <> ''count'' AND (b.configuration ->> ''value_column'') IS NULL THEN
          RAISE EXCEPTION ''Contour:AggregateNeedsAColumn — except for Count, you must specify which column the aggregate applies to'';
        END IF;
        IF op = ''count'' THEN
          cond := ''count(*)'';
        ELSIF op = ''unique_count'' THEN
          cond := format(''count(DISTINCT %I)'', b.configuration ->> ''value_column'');
        ELSIF op IN (''min'', ''max'', ''sum'') THEN
          cond := format(''%s(%I)'', op, b.configuration ->> ''value_column'');
        ELSIF op = ''mean'' THEN
          cond := format(''avg(%I)'', b.configuration ->> ''value_column'');
        ELSIF op = ''approx_median'' THEN
          -- Foundry calls Spark percentile_approx; ours is exact — recorded
          cond := format(''percentile_cont(0.5) WITHIN GROUP (ORDER BY %I)'', b.configuration ->> ''value_column'');
        ELSIF op = ''stddev'' THEN
          cond := format(''stddev(%I)'', b.configuration ->> ''value_column'');
        ELSIF op = ''variance'' THEN
          cond := format(''variance(%I)'', b.configuration ->> ''value_column'');
        ELSE
          RAISE EXCEPTION ''Contour:UnknownAggregate — % is not one of the nine the histogram offers'', op;
        END IF;
        sql_text := format(''SELECT %I, %s AS %I FROM (%s) AS s GROUP BY %I'',
                           col, cond, op, sql_text, col);
        agg := true;
      END IF;';
  EXECUTE replace(src, anchor, replacement);
END $$;

COMMENT ON FUNCTION public.compile_contour_path(uuid) IS
  'The Contour backend''s code generation, in the substrate we run: boards become one nested SELECT over the head input''s CTE. Filters compile their predicate — or NOTHING when their parameter has no value, the capture''s rule; expressions pass through as Postgres, the recorded divergence; a pivoted histogram groups by its bucket column under one of the NINE aggregates the page enumerates (Count, Unique Count, Min, Max, Sum, Mean, Approx. median, Standard Deviation, Variance), with Approx. median exact here rather than Spark''s percentile_approx; disabled and display-only boards compile to nothing but their selection. Refuses a restricted-view head, transitively.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; a uuid; p1 uuid;
  ds uuid; outd uuid; br uuid; txn uuid; fid uuid; phys text;
  n numeric;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('ct-706') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('ct-706') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct706@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'ct706@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'ct_706', 'CT 706') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'rides_706', 'rides_706') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (ds, txn, '[{"name": "hood", "type": "STRING"}, {"name": "secs", "type": "DOUBLE"}]'::jsonb);
    SELECT public.dataset_materialize(ds, txn) INTO phys;
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (ds, txn, 'seed/rides.rows', 3) RETURNING id INTO fid;
    EXECUTE format('INSERT INTO datasets.%I (_file, hood, secs) VALUES ($1, ''SoHo'', 100), ($1, ''SoHo'', 300), ($1, ''Chelsea'', 60)', phys) USING fid;
    PERFORM public.commit_transaction(txn);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'ride_means_706', 'ride_means_706') RETURNING id INTO outd;

    -- the page's own example: mean trip time by neighborhood
    SELECT public.create_contour_analysis(proj, 'Rides 706') INTO a;
    INSERT INTO public.contour_paths (analysis_id, name, head_dataset_id)
    VALUES (a, 'Main', ds) RETURNING id INTO p1;
    INSERT INTO public.contour_boards (path_id, position, kind, pivoted, configuration)
    VALUES (p1, 0, 'histogram', true,
      '{"bucket_column": "hood", "agg": "mean", "value_column": "secs"}'::jsonb);
    PERFORM public.save_contour_path_as_dataset(p1, outd);
    PERFORM public.run_build(ARRAY[outd], true);
    SELECT d.physical_table INTO phys FROM public.datasets d WHERE d.id = outd;
    EXECUTE format('SELECT mean FROM datasets.%I WHERE hood = ''SoHo''', phys) INTO n;
    IF n <> 200 THEN RAISE EXCEPTION 'mean(100, 300) should be 200, got %', n; END IF;

    -- an aggregate outside the nine refuses by name; a column-less mean too
    UPDATE public.contour_boards SET configuration = '{"bucket_column": "hood", "agg": "mode", "value_column": "secs"}'::jsonb
     WHERE path_id = p1;
    BEGIN
      PERFORM public.compile_contour_path(p1);
      RAISE EXCEPTION 'an aggregate outside the nine was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:UnknownAggregate%' THEN RAISE; END IF;
    END;
    UPDATE public.contour_boards SET configuration = '{"bucket_column": "hood", "agg": "mean"}'::jsonb
     WHERE path_id = p1;
    BEGIN
      PERFORM public.compile_contour_path(p1);
      RAISE EXCEPTION 'a column-less mean was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Contour:AggregateNeedsAColumn%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '706 proved, as the caller: the page''s own example — mean trip time by neighborhood — builds to SoHo:200 through the job spec; an aggregate outside the nine refuses by name; and every aggregate but Count demands its column, in the page''s words';
  END;
END $$;
