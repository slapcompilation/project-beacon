-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 382 — the hotel tier goes; the organization is the tenant.
--
-- `hotels` survived every previous cut because eight ontology tables carried
-- hotel_id and sixteen RLS policies resolved it. That is not a reason to keep
-- it — it is what it means for a hospitality concept to be load-bearing.
--
-- Foundry has one tenancy tier that matters here: the Organization. Our second
-- tier was a property, and every policy read
--
--   organization_id = auth_org_id() AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id))
--
-- Dropping the second half leaves the first, which is the whole rule Foundry
-- needs. Two tables had ONLY the hotel half and get an organization instead:
-- relationship_edges_store gains organization_id, and users is scoped through
-- its org membership.
--
-- Also gone:
--   object_links   a generic edge-per-row store. Foundry backs a link with a
--                  DATASOURCE — object type foreign keys or a join dataset
--                  (create-link-type.md) — never a universal link table. Ours
--                  was an approximation of a thing Foundry does not have.
--   profiles       a per-hotel user profile; users + memberships is the shape.
--
-- Every table here is empty, so the column drops move no data.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. The two tables with no organization of their own.
ALTER TABLE public.relationship_edges_store
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.relationship_edges_store ALTER COLUMN organization_id SET DEFAULT auth_org_id();

DROP POLICY IF EXISTS re_select_in_scope   ON public.relationship_edges_store;
DROP POLICY IF EXISTS re_insert_in_scope   ON public.relationship_edges_store;
DROP POLICY IF EXISTS re_delete_provenance ON public.relationship_edges_store;
CREATE POLICY re_select_in_scope ON public.relationship_edges_store
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM auth_org_id()));
CREATE POLICY re_insert_in_scope ON public.relationship_edges_store
  FOR INSERT WITH CHECK (NOT (organization_id IS DISTINCT FROM auth_org_id()));

DROP POLICY IF EXISTS hotel_isolation ON public.users;
CREATE POLICY org_isolation ON public.users
  USING (EXISTS (SELECT 1 FROM public.user_org_memberships m
                  WHERE m.user_id = users.id
                    AND NOT (m.organization_id IS DISTINCT FROM auth_org_id())));

-- 2. The ontology tables keep the organization half of every scope rule.
DROP POLICY IF EXISTS "read records in scope"   ON public.object_records;
DROP POLICY IF EXISTS "write records in scope"  ON public.object_records;
DROP POLICY IF EXISTS "update records in scope" ON public.object_records;
DROP POLICY IF EXISTS "delete records in scope" ON public.object_records;
CREATE POLICY "read records in scope" ON public.object_records
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM auth_org_id()));
CREATE POLICY "write records in scope" ON public.object_records
  FOR INSERT WITH CHECK (NOT (organization_id IS DISTINCT FROM auth_org_id())
                         AND created_by_user_id = auth.uid());
CREATE POLICY "update records in scope" ON public.object_records
  FOR UPDATE USING (NOT (organization_id IS DISTINCT FROM auth_org_id()))
         WITH CHECK (NOT (organization_id IS DISTINCT FROM auth_org_id()));
CREATE POLICY "delete records in scope" ON public.object_records
  FOR DELETE USING (NOT (organization_id IS DISTINCT FROM auth_org_id()));

DROP POLICY IF EXISTS "members read object sets in scope"  ON public.object_sets;
DROP POLICY IF EXISTS "admins author object sets in scope" ON public.object_sets;
CREATE POLICY "members read object sets in scope" ON public.object_sets
  FOR SELECT USING (NOT (organization_id IS DISTINCT FROM auth_org_id()));
CREATE POLICY "admins author object sets in scope" ON public.object_sets
  USING (auth_role() = ANY (ARRAY['owner','admin'])
         AND NOT (organization_id IS DISTINCT FROM auth_org_id()))
  WITH CHECK (auth_role() = ANY (ARRAY['owner','admin'])
              AND NOT (organization_id IS DISTINCT FROM auth_org_id())
              AND (subject_type_id IS NULL OR EXISTS (
                    SELECT 1 FROM object_types t WHERE t.id = object_sets.subject_type_id
                      AND NOT (t.organization_id IS DISTINCT FROM auth_org_id())))
              AND (subject_interface_id IS NULL OR EXISTS (
                    SELECT 1 FROM ontology_interfaces i WHERE i.id = object_sets.subject_interface_id
                      AND NOT (i.organization_id IS DISTINCT FROM auth_org_id()))));

-- 3. The hotel tier itself. CASCADE takes the remaining hotel-aware policies on
--    object_types and link_types, which keep their organization policies.
ALTER TABLE public.object_types            DROP COLUMN IF EXISTS hotel_id CASCADE;
ALTER TABLE public.link_types              DROP COLUMN IF EXISTS hotel_id CASCADE;
ALTER TABLE public.object_records          DROP COLUMN IF EXISTS hotel_id CASCADE;
ALTER TABLE public.object_sets             DROP COLUMN IF EXISTS hotel_id CASCADE;
ALTER TABLE public.relationship_edges_store DROP COLUMN IF EXISTS hotel_id CASCADE;
ALTER TABLE public.users                   DROP COLUMN IF EXISTS hotel_id CASCADE;

DROP TABLE IF EXISTS public.object_links CASCADE;
DROP TABLE IF EXISTS public.profiles     CASCADE;
DROP TABLE IF EXISTS public.hotels       CASCADE;

DROP FUNCTION IF EXISTS public.hotel_is_in_user_scope(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.auth_hotel_id() CASCADE;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN ('hotels','profiles','object_links');
  IF n > 0 THEN RAISE EXCEPTION 'Migration 382: % of the three survived', n; END IF;

  SELECT count(*) INTO n FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relkind='r' AND a.attname='hotel_id' AND NOT a.attisdropped;
  IF n > 0 THEN RAISE EXCEPTION 'Migration 382: % hotel_id column(s) remain', n; END IF;

  -- Fail-closed is not the goal: an ontology table with no policy denies reads
  -- to everyone, which looks like a security win and is a broken app.
  FOR n IN SELECT 1 FROM unnest(ARRAY['object_types','object_records','object_sets',
                                      'link_types','relationship_edges_store']) t
            WHERE NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
                               WHERE c.relname = t)
  LOOP
    RAISE EXCEPTION 'Migration 382: an ontology table lost every policy';
  END LOOP;
END $$;

COMMIT;
