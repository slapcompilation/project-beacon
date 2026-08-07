-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 402 — a dataset's access requirements, as the panel shows them.
--
-- Reading: docs/foundry-reference/readings/markings.md
--
-- The access panel asks one question — "Users must meet all of the following
-- requirements to access this file" — and answers it in cards. A surface that
-- assembled those cards from four separate queries would drift from the
-- predicates that actually gate access, which is the failure this repo has hit
-- before: the display was honest while the gate read something else.
--
-- So the panel is one function over the same predicates the policies call.
--
-- Every row carries the two things the UI needs and cannot derive:
--   kind    file | data   — which card it belongs in
--   origin  direct | file_hierarchy | data_dependency
--                         — which sidecar icon the chip gets. Foundry: "A marking
--                           inherited along the file hierarchy is indicated by a
--                           folder sidecar icon"; "along a data dependency… by a
--                           data lineage sidecar icon."
--
-- `satisfied` is per-marking rather than one verdict, because the panel shows
-- which requirement you fail, not merely that you failed.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.dataset_markings(p_dataset uuid)
RETURNS TABLE (
  marking_id uuid,
  name       text,
  color      text,
  category   text,
  kind       text,
  origin     text,
  satisfied  boolean
)
LANGUAGE sql STABLE AS $$
  WITH f AS (SELECT unnest(public.effective_file_markings('dataset', p_dataset)) AS id),
       d AS (SELECT unnest(public.effective_data_markings(p_dataset)) AS id),
       all_of AS (
         SELECT id, 'file'::text AS kind FROM f
         UNION ALL
         SELECT id, 'data'::text FROM d
       )
  SELECT m.id, m.name, m.color, c.name, a.kind,
         CASE WHEN a.kind = 'data' THEN 'data_dependency'
              ELSE public.file_marking_origin('dataset', p_dataset, m.id) END,
         public.satisfies_markings(ARRAY[m.id])
    FROM all_of a
    JOIN public.markings m ON m.id = a.id
    JOIN public.marking_categories c ON c.id = m.category_id
   ORDER BY a.kind DESC, c.name, m.name
$$;

COMMENT ON FUNCTION public.dataset_markings(uuid) IS
  'Every marking a dataset demands, tagged with which card it belongs in (file/data) and how it got there. Reads the same predicates the RLS policies do, so the panel cannot drift from the gate.';

GRANT EXECUTE ON FUNCTION public.dataset_markings(uuid) TO authenticated;

DO $$
DECLARE
  org uuid; proj uuid; raw uuid; clean uuid; cat uuid; mk uuid; n int; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('m402') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm402', 'm402') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm402_raw', 'raw') RETURNING id INTO raw;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm402_clean', 'clean') RETURNING id INTO clean;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (clean, raw);
  INSERT INTO public.marking_categories (name) VALUES ('m402') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'PII') RETURNING id INTO mk;

  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
       VALUES (mk, 'dataset', raw);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  -- The marked dataset: one FILE marking, applied directly.
  SELECT count(*) INTO n FROM public.dataset_markings(raw)
   WHERE kind = 'file' AND origin = 'direct' AND NOT satisfied;
  IF n <> 1 THEN RAISE EXCEPTION 'Migration 402: expected one direct file marking on raw, got %', n; END IF;

  -- Its consumer: the same marking, but as a DATA marking from a dependency.
  SELECT count(*) INTO n FROM public.dataset_markings(clean)
   WHERE kind = 'data' AND origin = 'data_dependency';
  IF n <> 1 THEN RAISE EXCEPTION 'Migration 402: expected one data marking on clean, got %', n; END IF;
  IF EXISTS (SELECT 1 FROM public.dataset_markings(clean) WHERE kind = 'file') THEN
    RAISE EXCEPTION 'Migration 402: an inherited data marking was filed under file markings';
  END IF;

  -- A project-level marking reaches the dataset as file_hierarchy.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = mk;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
       VALUES (mk, 'project', proj);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  SELECT count(*) INTO n FROM public.dataset_markings(raw)
   WHERE kind = 'file' AND origin = 'file_hierarchy';
  IF n <> 1 THEN RAISE EXCEPTION 'Migration 402: a project marking did not read as file_hierarchy'; END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = mk;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  DELETE FROM public.dataset_inputs WHERE dataset_id = clean;
  DELETE FROM public.datasets WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id = org;
  ALTER TABLE public.markings DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE id = mk;
  DELETE FROM public.marking_categories WHERE id = cat;
  ALTER TABLE public.markings ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
END $$;

COMMIT;
