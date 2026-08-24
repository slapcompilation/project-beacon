-- catalog.test's FK-index census caught the one foreign key 661 left
-- unindexed. Corrected forward, because an applied migration cannot be edited.
CREATE INDEX monitoring_views_org ON public.monitoring_views (organization_id);
