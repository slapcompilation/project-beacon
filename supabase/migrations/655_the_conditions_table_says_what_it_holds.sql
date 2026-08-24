-- catalog.test.ts refused 654 within the hour: every public table carries a
-- COMMENT, and group_assignment_conditions shipped without one — the only
-- table of the four that did, because its meaning lived on its CHECK instead.

COMMENT ON TABLE public.group_assignment_conditions IS
  'The AND conditions of one group assignment rule (authentication/group-assignment): an attribute or provider-groups target, one of the three regex match kinds, and the pattern. All must match for the rule to assign.';

DO $$
BEGIN
  IF obj_description('public.group_assignment_conditions'::regclass, 'pg_class') IS NULL THEN
    RAISE EXCEPTION 'the comment did not land';
  END IF;
END $$;
