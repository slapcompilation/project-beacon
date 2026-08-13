-- catalog.test.ts, third catch: 495 commented schedules but not its history.
COMMENT ON TABLE public.schedule_runs IS
  'The run history: when a schedule ran and what came of it — Succeeded, Ignored (a build was not created), or Failed.';
