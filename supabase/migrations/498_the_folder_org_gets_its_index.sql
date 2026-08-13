-- catalog.test.ts, fourth catch: 497 indexed every folder FK but the org.
CREATE INDEX folders_org_idx ON public.folders (organization_id);
