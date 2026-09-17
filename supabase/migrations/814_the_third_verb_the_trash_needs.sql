-- The third verb the trash needs.
--
-- 813 gave the Files listing move and trash for every indexed kind and stopped
-- there, so permanent deletion was still the two-table special case the listing
-- had before — which would have left a menu offering Permanently delete on
-- fourteen kinds and meaning it for two. A menu item that does nothing is the
-- empty-shell failure at item scale, and this is the migration that would have
-- caused one.
--
-- Foundry publishes exactly three verbs against a trashed resource, and this is
-- the third:
--
--   "Permanently delete the given resource from the trash. If the resource is not directly trashed, a `ResourceNotTrashed` error will be thrown."
--   — api/v2/filesystem-v2-resources/resources-permanently-delete-resource.md

-- WE DO NOT COPY THE PRECONDITION, and the divergence is scoped rather than
-- silent. Foundry refuses to permanently delete a resource that is not directly
-- trashed; our `trashed_at` is a single timestamp with no directly-versus-
-- ancestor distinction, so the check it wants cannot be expressed here yet.
-- readings/compass-filesystem-api.md §4 records that gap and its Decision 3
-- names the migration that would close it. Until then this deletes what it is
-- given, exactly as the previous per-table client code did — no stricter, no
-- looser.
--
-- Not security definer, for 813's reason: the delete runs as the caller so the
-- owning table's RLS decides it.
create or replace function public.delete_filesystem_resource(p_kind text, p_id uuid)
returns void language plpgsql as $$
DECLARE v_table text;
BEGIN
  v_table := public.filesystem_resource_table(p_kind);
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Compass:UnknownResourceKind — % is not an indexed filesystem kind', p_kind;
  END IF;
  EXECUTE format('DELETE FROM %s WHERE id = $1', v_table) USING p_id;
END $$;

comment on function public.delete_filesystem_resource(text, uuid) is
  'Permanently deletes an indexed resource through its owning table, as the caller. The index row goes with it through 812''s trigger. Does NOT require the resource to be trashed first, which Foundry does — our trashed_at cannot express directly-versus-ancestor trashing yet; see readings/compass-filesystem-api.md.';

-- PROVED BY DOING: delete a real row through the function and require the index
-- to lose it. An assertion that only checked pg_proc would pass on a body that
-- deleted nothing.
DO $$
DECLARE v_project uuid; v_org uuid; v_ds uuid; v_seen int;
BEGIN
  SELECT id, organization_id INTO v_project, v_org
    FROM public.projects ORDER BY created_at LIMIT 1;
  IF v_project IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: no projects'; END IF;

  INSERT INTO public.datasets (project_id, name, api_name, organization_id)
    VALUES (v_project, 'zz-proof-814-dataset', 'zz_proof_814_dataset', v_org)
    RETURNING id INTO v_ds;

  SELECT count(*) INTO v_seen FROM public.project_resources
   WHERE resource_kind = 'dataset' AND resource_id = v_ds;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the fixture is not in the index';
  END IF;

  PERFORM public.delete_filesystem_resource('dataset', v_ds);

  IF EXISTS (SELECT 1 FROM public.datasets WHERE id = v_ds) THEN
    RAISE EXCEPTION 'PROOF FAILED: the dataset survived';
  END IF;
  SELECT count(*) INTO v_seen FROM public.project_resources
   WHERE resource_kind = 'dataset' AND resource_id = v_ds;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: the index kept % row(s)', v_seen;
  END IF;
  RAISE NOTICE 'PROVED: a permanent delete removes the row and its index entry';

  BEGIN
    PERFORM public.delete_filesystem_resource('not_a_kind', v_ds);
    RAISE EXCEPTION 'PROOF FAILED: an unknown kind was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Compass:UnknownResourceKind%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PROVED: an unknown kind is refused by name';
END $$;
