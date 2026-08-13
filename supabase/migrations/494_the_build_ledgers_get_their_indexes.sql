-- catalog.test.ts caught 493 the same way it caught 490: three FKs with no
-- index on their leading column. The floor holds; this clears it.
CREATE INDEX build_jobs_transaction_idx ON public.build_jobs (transaction_id);
CREATE INDEX builds_requested_by_idx ON public.builds (requested_by);
CREATE INDEX job_specs_published_by_idx ON public.job_specs (published_by);
