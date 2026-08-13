-- catalog.test.ts caught 490 within the hour: the new FK had no index on its
-- leading column. The floor holds; this clears it.
CREATE INDEX organizations_marking_idx ON public.organizations (marking_id);
