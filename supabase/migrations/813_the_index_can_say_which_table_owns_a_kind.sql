-- The index can say which table owns a kind, so the web never has to.
--
-- 812 made `project_resources` a real index: one row per filesystem resource,
-- maintained by a trigger on each of the fourteen tables that carry placement.
-- A listing can now read it with no join. But a listing also MOVES and TRASHES
-- things, and those writes belong to the owning table — the index is derived,
-- and writing to it directly would be writing to the shadow instead of the
-- thing.
--
-- So the web needs kind → table. The obvious way is a fourteen-entry map in
-- TypeScript, which is the same hand-maintained branch list this whole arc
-- exists to delete, only moved across the boundary where no guard can see it.
--
-- THE MAP IS ALREADY IN THE CATALOGUE. 812 attached `index_in_filesystem` to
-- each table with its kind as the trigger argument, so the pairs are
-- pg_trigger rows. Deriving the lookup from there means the mapping cannot
-- drift from the indexing: a table that is indexed is resolvable, and one that
-- is not is neither.
--
-- tgargs is a null-separated bytea of the trigger's arguments; with one
-- argument, decoding it and trimming the trailing NUL gives the kind.
create or replace function public.filesystem_resource_table(p_kind text)
returns text language sql stable as $$
  SELECT t.tgrelid::regclass::text
    FROM pg_trigger t
   WHERE t.tgname = 'index_in_filesystem'
     AND NOT t.tgisinternal
     AND rtrim(encode(t.tgargs, 'escape'), E'\\000') = p_kind
   LIMIT 1
$$;

comment on function public.filesystem_resource_table(text) is
  'The table that owns a filesystem resource kind, derived from the index_in_filesystem triggers 812 attached rather than from a second list. A kind that is indexed is resolvable; one that is not is neither.';

-- The two writes a Files listing makes. Deliberately NOT security definer: the
-- update must run as the caller so the owning table's RLS decides it, exactly
-- as a direct update from the client would. 553's lesson is that elevating a
-- write path to reach a row is how a policy stops applying — these functions
-- exist to spare the web a lookup table, not to grant it anything.
create or replace function public.move_filesystem_resource(
  p_kind text, p_id uuid, p_folder uuid)
returns void language plpgsql as $$
DECLARE v_table text;
BEGIN
  v_table := public.filesystem_resource_table(p_kind);
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Compass:UnknownResourceKind — % is not an indexed filesystem kind', p_kind;
  END IF;
  EXECUTE format('UPDATE %s SET folder_id = $1 WHERE id = $2', v_table)
    USING p_folder, p_id;
END $$;

create or replace function public.set_filesystem_resource_trashed(
  p_kind text, p_id uuid, p_trashed boolean)
returns void language plpgsql as $$
DECLARE v_table text;
BEGIN
  v_table := public.filesystem_resource_table(p_kind);
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Compass:UnknownResourceKind — % is not an indexed filesystem kind', p_kind;
  END IF;
  -- workbook_templates has no trashed_at, so the trash is not offered for it;
  -- saying so here is better than a cryptic "column does not exist".
  -- Asked of pg_attribute by oid, not of information_schema by name:
  -- regclass::text returns `datasets` when public is on the search_path and
  -- `public.datasets` when it is not, so any name-splitting here is a
  -- coin-flip that fails silently as "this kind has no trash".
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = v_table::regclass
       AND a.attname = 'trashed_at'
       AND a.attnum > 0 AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'Compass:NotTrashable — % has no trash', p_kind;
  END IF;
  EXECUTE format('UPDATE %s SET trashed_at = $1 WHERE id = $2', v_table)
    USING (CASE WHEN p_trashed THEN now() END), p_id;
END $$;

comment on function public.move_filesystem_resource(text, uuid, uuid) is
  'Moves an indexed resource to a folder, as the caller, so the owning table''s RLS decides it. The index follows through 812''s trigger.';
comment on function public.set_filesystem_resource_trashed(text, uuid, boolean) is
  'Trashes or restores an indexed resource, as the caller. Refuses a kind whose table has no trashed_at rather than failing on a missing column.';

-- PROVED BY DOING: resolve every indexed kind, then actually move a real row
-- through the function and watch the index follow it.
DO $$
DECLARE
  v_kind text; v_unresolved text[] := '{}'; v_n int;
  v_project uuid; v_org uuid; v_ds uuid; v_folder uuid; v_seen uuid;
BEGIN
  FOREACH v_kind IN ARRAY public.filesystem_resource_kinds() LOOP
    -- object_type and object_set predate the index and own no filesystem table.
    CONTINUE WHEN v_kind IN ('object_type', 'object_set');
    IF public.filesystem_resource_table(v_kind) IS NULL THEN
      v_unresolved := v_unresolved || v_kind;
    END IF;
  END LOOP;
  IF array_length(v_unresolved, 1) > 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: kind(s) with no owning table: %', v_unresolved;
  END IF;
  SELECT count(*) INTO v_n FROM unnest(public.filesystem_resource_kinds()) k
   WHERE k NOT IN ('object_type', 'object_set');
  RAISE NOTICE 'PROVED: all % filesystem kind(s) resolve to an owning table', v_n;

  SELECT id, organization_id INTO v_project, v_org
    FROM public.projects ORDER BY created_at LIMIT 1;
  IF v_project IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no projects'; END IF;

  INSERT INTO public.datasets (project_id, name, api_name, organization_id)
    VALUES (v_project, 'zz-proof-813-dataset', 'zz_proof_813_dataset', v_org)
    RETURNING id INTO v_ds;
  INSERT INTO public.folders (project_id, name, organization_id)
    VALUES (v_project, 'zz-proof-813-folder', v_org) RETURNING id INTO v_folder;

  PERFORM public.move_filesystem_resource('dataset', v_ds, v_folder);
  SELECT folder_id INTO v_seen FROM public.project_resources
   WHERE resource_kind = 'dataset' AND resource_id = v_ds;
  IF v_seen IS DISTINCT FROM v_folder THEN
    RAISE EXCEPTION 'PROOF FAILED: the move did not reach the index (folder_id=%)', v_seen;
  END IF;

  PERFORM public.set_filesystem_resource_trashed('dataset', v_ds, true);
  IF (SELECT trashed_at FROM public.project_resources
       WHERE resource_kind='dataset' AND resource_id=v_ds) IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: the trash did not reach the index';
  END IF;
  RAISE NOTICE 'PROVED: move and trash go through the owning table and land in the index';

  BEGIN
    PERFORM public.move_filesystem_resource('not_a_kind', v_ds, NULL);
    RAISE EXCEPTION 'PROOF FAILED: an unknown kind was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Compass:UnknownResourceKind%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PROVED: an unknown kind is refused by name';

  DELETE FROM public.datasets WHERE id = v_ds;
  DELETE FROM public.folders  WHERE id = v_folder;
END $$;
