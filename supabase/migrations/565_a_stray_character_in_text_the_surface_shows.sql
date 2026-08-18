-- A typo in 563's seed, in a string the Settings page now renders.
--
-- `view_group_membership`'s description carried a stray Arabic combining mark
-- (U+0651) inside the word "organizations". Harmless to the database and
-- invisible in a diff, which is how it survived review — and visible to a
-- person the moment the workflow catalogue got a surface.
--
-- Worth its own migration rather than a silent edit: 563 is applied and
-- immutable, and the row is data rather than schema, so this is the only way
-- the corrected text reaches an environment that already ran it.

BEGIN;

UPDATE public.workflows
   SET description = 'Widens which organizations'' groups the holder can see. Carried by no default role: no page states which role grants it, so it is composed into a custom role.'
 WHERE api_name = 'view_group_membership';

-- ── assertions ──────────────────────────────────────────────────────────────
DO $do$
DECLARE n int; bad text;
BEGIN
  -- No catalogue text carries a character outside printable ASCII. Asked of
  -- every row rather than the one repaired, since the next stray one will not
  -- announce itself either.
  SELECT count(*), string_agg(api_name, ', ') INTO n, bad
    FROM public.workflows
   WHERE display_name ~ '[^\x20-\x7E]'
      OR (description IS NOT NULL AND description ~ '[^\x20-\x7E]');
  IF n > 0 THEN
    RAISE EXCEPTION '% catalogue row(s) carry a non-printable-ASCII character: %', n, bad;
  END IF;

  -- And the apostrophe survived the escaping, which is the thing an edit like
  -- this actually gets wrong.
  SELECT count(*) INTO n FROM public.workflows
   WHERE api_name = 'view_group_membership' AND description LIKE '%organizations'' groups%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the corrected description did not land';
  END IF;

  RAISE NOTICE '565: a stray character in text the surface shows';
END $do$;

COMMIT;
