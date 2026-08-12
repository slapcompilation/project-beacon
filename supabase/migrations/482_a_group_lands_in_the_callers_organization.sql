-- The same idiom project_role_grants already has: the writer never names the
-- organization, the session does.
ALTER TABLE public.groups ALTER COLUMN organization_id SET DEFAULT public.auth_org_id();
