-- That CHECK names no new vocabulary.
--
-- 769 gave `action_type_rules_interface_link_columns_check` a COMMENT beginning
-- "Values from action-types/rules". That phrase is not decoration: 601 made it
-- a DECLARATION, and the platform suite reads every constraint whose comment
-- carries it, pulls the values out of the CHECK, and proves each one appears on
-- the page named. The two kinds in this CHECK are snake_case identifiers, and
-- the page writes them as "Create link(s) on object(s) of interface" — the
-- parenthesised plural no mechanical form reaches. So the suite was right and
-- the declaration was wrong.
--
-- It was wrong in the more interesting way too. This CHECK adds no vocabulary.
-- The kind names are `action_rule_kinds()`'s, declared where that set is
-- declared; all this says is WHICH kinds may carry the column 769 added, which
-- is a fact about one row and nothing to do with where a value came from. A
-- constraint that borrows the declaration form without adding a set makes the
-- suite check something no page can answer.
--
-- Applied migrations are immutable, so the comment is corrected here rather
-- than in 769.

COMMENT ON CONSTRAINT action_type_rules_interface_link_columns_check ON public.action_type_rules IS
  'The two interface link kinds name an interface link type constraint, and no other kind names one. The kind names themselves are action_rule_kinds()''s vocabulary, declared with that set — this adds none.';

DO $$
DECLARE cm text;
BEGIN
  SELECT obj_description(oid, 'pg_constraint') INTO cm FROM pg_constraint
   WHERE conname = 'action_type_rules_interface_link_columns_check'
     AND conrelid = 'public.action_type_rules'::regclass;
  IF cm IS NULL THEN
    RAISE EXCEPTION 'the constraint should still say what it is';
  END IF;
  IF cm LIKE 'Values from%' THEN
    RAISE EXCEPTION 'it should no longer declare a value set';
  END IF;
END $$;
