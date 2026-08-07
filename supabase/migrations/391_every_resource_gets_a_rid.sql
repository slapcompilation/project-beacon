-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 391 — resource identifiers.
--
-- Foundry gives every resource a RID. `analytics-connectivity/identify-dataset-rid`
-- names the two ways to point at one: "'RID', which is the dataset identifier"
-- and "'Location', which specifies the filepath location". The Ontology Manager
-- Overview page shows a new object type reading `RID  Set on save`, beside a
-- separate ID and API name — three identifiers, not one.
--
-- No mirrored page states the grammar. It is inferred from ~160 worked examples,
-- and it is unambiguous:
--
--     ri.<service>.<instance>.<type>.<locator>
--
-- The service that OWNS the resource is in the identifier — `ri.mio.…` for media,
-- `ri.compass.main.folder.…` for the filesystem, `ri.phonograph2-objects.main.object.…`
-- for OSv1 objects. A RID says what owns this before it says which one.
--
-- Only forms actually present in the mirror are used here:
--
--     ri.ontology.main.object-type.<uuid>   object-link-types/…
--     ri.object-set.main.object-set.<uuid>  object-backend/overview
--     ri.foundry.main.dataset.<uuid>        132 occurrences
--     ri.foundry.main.transaction.<uuid>    data-lifetime/FAQ
--     ri.compass.main.folder.<uuid>         data-integration/…
--
-- project, link-type, shared-property, interface and action-type have NO
-- attested form, so they get no RID yet. Inventing one is how object_type_impact
-- came back.
--
-- The RID is a GENERATED column over the row's own uuid, not a second identity.
-- It cannot drift from the row, cannot be forged, and needs no backfill.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- `main` is Foundry's instance segment in every example but one; the exception
-- is a Gotham enrollment id, which we have no equivalent of.
CREATE OR REPLACE FUNCTION public.rid_of(p_service text, p_type text, p_id uuid)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT 'ri.' || p_service || '.main.' || p_type || '.' || p_id::text
$$;

COMMENT ON FUNCTION public.rid_of(text, text, uuid) IS
  'Build a resource identifier: ri.<service>.main.<type>.<uuid>. Grammar inferred from ~160 examples in the mirror; no page states it.';

-- The locator half, for the reverse lookup a "paste a RID" filter needs.
-- Data Lifetime's Deletions tab has exactly that, filtering by Transaction ID.
CREATE OR REPLACE FUNCTION public.rid_locator(p_rid text)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT nullif(split_part(p_rid, '.', 5), '')::uuid
$$;

COMMENT ON FUNCTION public.rid_locator(text) IS
  'The <locator> segment of a RID, as a uuid. NULL when the RID is malformed.';

ALTER TABLE public.object_types
  ADD COLUMN rid text
  GENERATED ALWAYS AS (public.rid_of('ontology', 'object-type', id)) STORED;

ALTER TABLE public.object_sets
  ADD COLUMN rid text
  GENERATED ALWAYS AS (public.rid_of('object-set', 'object-set', id)) STORED;

COMMENT ON COLUMN public.object_types.rid IS
  'ri.ontology.main.object-type.<id>. Derived from id — Foundry assigns a RID on save.';
COMMENT ON COLUMN public.object_sets.rid IS
  'ri.object-set.main.object-set.<id>. Ours are permanent and dynamic; Foundry also has temporary-object-set (24h) and versioned-object-set.';

CREATE UNIQUE INDEX object_types_rid_key ON public.object_types (rid);
CREATE UNIQUE INDEX object_sets_rid_key  ON public.object_sets  (rid);

DO $$
DECLARE r text;
BEGIN
  IF public.rid_of('foundry', 'dataset', '00000000-0000-0000-0000-000000000001')
     <> 'ri.foundry.main.dataset.00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Migration 391: rid_of does not match the attested dataset form';
  END IF;

  -- Round-trip, because a builder and a parser that disagree is worse than neither.
  r := public.rid_of('ontology', 'object-type', '00000000-0000-0000-0000-000000000002');
  IF public.rid_locator(r) <> '00000000-0000-0000-0000-000000000002'::uuid THEN
    RAISE EXCEPTION 'Migration 391: rid_locator does not invert rid_of';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='object_types' AND column_name='rid'
                    AND is_generated='ALWAYS') THEN
    RAISE EXCEPTION 'Migration 391: object_types.rid is not generated';
  END IF;
END $$;

COMMIT;
