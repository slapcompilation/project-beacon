-- 802 — the execution modes take the page's own words
--
-- 800 declared its execution-mode set as coming from automate/effect-actions,
-- and the platform suite refused two of the three: the page writes
--
--   "**Execute once for each batch of objects:** Split objects into batches up to the configured batch size, and execute the action once for each batch."
--   — automate/effect-actions.md
--
--   "**Execute once for each group of objects:** Group the objects by a set of object properties from the condition's object type."
--   — automate/effect-actions.md
--
-- and I had written `once_per_batch` and `once_per_group`. Per and each are not
-- the same word, and a declared set has to be findable on the page it names —
-- that is the whole point of the declaration, which exists so the next reader
-- can go and read the sentence.
--
-- `once_for_all` already traced, because the page's third option reads "Execute
-- once for all objects". So this renames two of three, and the result is that
-- all three are the page's own phrasing with the verb and the trailing noun
-- dropped, which is how every other snake_case vocabulary here is formed.
--
-- Nothing is stored under the old spellings: 800 landed within the hour, the
-- only rows were its own assertions and the suite's, and both roll back. The
-- rename is therefore free, which is the same condition readings/rid-grammar.md
-- records for the object-set token — a vocabulary correction stays cheap right
-- up until a value is exported, and not one minute longer.

BEGIN;

-- The three constraints that name the literals, rebuilt together so there is no
-- moment where one arm knows the new spelling and another does not.
ALTER TABLE public.automation_effects
  DROP CONSTRAINT automation_effects_execution_mode_known,
  DROP CONSTRAINT automation_effects_batch_size_shape,
  DROP CONSTRAINT automation_effects_group_properties_shape;

UPDATE public.automation_effects
   SET execution_mode = CASE execution_mode
         WHEN 'once_per_batch' THEN 'once_for_each_batch'
         WHEN 'once_per_group' THEN 'once_for_each_group'
         ELSE execution_mode END
 WHERE execution_mode IN ('once_per_batch', 'once_per_group');

ALTER TABLE public.automation_effects
  ADD CONSTRAINT automation_effects_execution_mode_known
    CHECK (execution_mode IS NULL
       OR execution_mode = ANY (ARRAY['once_for_all', 'once_for_each_batch', 'once_for_each_group'])),
  ADD CONSTRAINT automation_effects_batch_size_shape
    CHECK ((batch_size IS NOT NULL) = (execution_mode = 'once_for_each_batch')
        OR (batch_size IS NULL AND execution_mode IS DISTINCT FROM 'once_for_each_batch')),
  ADD CONSTRAINT automation_effects_group_properties_shape
    CHECK ((group_by_properties IS NOT NULL) = (execution_mode = 'once_for_each_group')
        OR (group_by_properties IS NULL AND execution_mode IS DISTINCT FROM 'once_for_each_group'));

COMMENT ON CONSTRAINT automation_effects_execution_mode_known ON public.automation_effects IS
  'Values from automate/effect-actions — the three grouping options it enumerates for object set and object list inputs, in its own words: execute once for all objects, once for each batch of objects, once for each group of objects. 800 wrote per where the page writes each, and the suite refused it.';

-- The executor compares the same literals, patched rather than retyped so that
-- nothing else in it moves.
DO $do$
DECLARE src text; anchored int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'run_effect_for_set';

  SELECT count(*) INTO anchored FROM regexp_matches(src, '''once_per_batch''', 'g');
  IF anchored <> 1 THEN
    RAISE EXCEPTION 'expected one batch-mode comparison, found %', anchored;
  END IF;
  SELECT count(*) INTO anchored FROM regexp_matches(src, '''once_per_group''', 'g');
  IF anchored <> 1 THEN
    RAISE EXCEPTION 'expected one group-mode comparison, found %', anchored;
  END IF;

  src := replace(src, '''once_per_batch''', '''once_for_each_batch''');
  src := replace(src, '''once_per_group''', '''once_for_each_group''');
  EXECUTE src;
END $do$;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE d text; n integer;
BEGIN
  SELECT pg_get_constraintdef(x.oid) INTO d FROM pg_constraint x
   WHERE x.conrelid = 'public.automation_effects'::regclass
     AND x.conname = 'automation_effects_execution_mode_known';
  IF d LIKE '%once_per_%' THEN
    RAISE EXCEPTION 'the old spellings are still in the value set';
  END IF;
  FOR n IN SELECT 1 LOOP NULL; END LOOP;
  IF d NOT LIKE '%once_for_each_batch%' OR d NOT LIKE '%once_for_each_group%' THEN
    RAISE EXCEPTION 'the page''s own words are not in the value set';
  END IF;

  -- The executor and the constraint must agree, or a mode that saves cannot run.
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'run_effect_for_set'
     AND p.prosrc LIKE '%once_per_%';
  IF n <> 0 THEN
    RAISE EXCEPTION 'the executor still compares the old spellings';
  END IF;
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'run_effect_for_set'
     AND p.prosrc LIKE '%once_for_each_batch%' AND p.prosrc LIKE '%once_for_each_group%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the executor does not know both renamed modes';
  END IF;

  -- And nothing was left behind under an old spelling.
  SELECT count(*) INTO n FROM public.automation_effects
   WHERE execution_mode LIKE 'once_per_%';
  IF n <> 0 THEN
    RAISE EXCEPTION '% effect(s) still carry an old spelling', n;
  END IF;

  RAISE NOTICE '802 proved: three modes in the page''s words, and the executor agrees';
END $do$;

COMMIT;
