-- dataset_markings() loses the color it never had.
--
-- 463 dropped the invented markings.color, and this function still selected
-- it — a DROP COLUMN cannot see into function bodies, which is the same trap
-- that left auth_org_id() reading a dropped table for a day. The nightly
-- report said nothing depended on the column; the function catalog said
-- otherwise. Restated without the column; the signature shrinks with it, so
-- the old signature is dropped first and the generated client re-learns the
-- shape from the grant.

DROP FUNCTION public.dataset_markings(uuid);

CREATE FUNCTION public.dataset_markings(p_dataset uuid)
RETURNS TABLE(marking_id uuid, name text, category text, kind text, origin text, satisfied boolean)
LANGUAGE sql
STABLE
AS $function$
  WITH f AS (SELECT unnest(public.effective_file_markings('dataset', p_dataset)) AS id),
       d AS (SELECT unnest(public.effective_data_markings(p_dataset)) AS id),
       all_of AS (
         SELECT id, 'file'::text AS kind FROM f
         UNION ALL
         SELECT id, 'data'::text FROM d
       )
  SELECT m.id, m.name, c.name, a.kind,
         CASE WHEN a.kind = 'data' THEN 'data_dependency'
              ELSE public.file_marking_origin('dataset', p_dataset, m.id) END,
         public.satisfies_markings(ARRAY[m.id])
    FROM all_of a
    JOIN public.markings m ON m.id = a.id
    JOIN public.marking_categories c ON c.id = m.category_id
   ORDER BY a.kind DESC, c.name, m.name
$function$;

REVOKE ALL ON FUNCTION public.dataset_markings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dataset_markings(uuid) TO authenticated;

-- ── assertion: the function answers again ───────────────────────────────────
DO $$
BEGIN
  PERFORM * FROM public.dataset_markings(gen_random_uuid());
END $$;
