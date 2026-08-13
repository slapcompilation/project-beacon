-- Q1 answered: the four remaining resource kinds get their RIDs.
--
-- Existence is attested for every one of them, from the pages the operator
-- supplied on 2026-08-13:
--
--   "RID: An automatically generated unique identifier for every resource in
--   Foundry. A link type's RID will be referenced in error messages across
--   the platform." (object-link-types/link-type-metadata.md)
--
--   "Action type RID: Unique identifier for a single action type"
--   (action-types/action-log.md)
--
--   "Local struct property types backed by shared property types will
--   inherit shared property type fields except for the struct field resource
--   identifiers (RIDs)." (object-link-types/struct-shared-properties.md —
--   even a shared property's struct FIELDS carry RIDs, a fortiori the
--   property itself)
--
--   "RID: The string must be a valid rid."
--   (object-link-types/value-type-constraints.md — rid-ness is a first-class
--   constraint kind)
--
-- The type token remains inference, marked: a full-corpus sweep (1,800+
-- pages, 2026-08-13) prints no ri.ontology.main.<any of these four>. Every
-- attested ontology-service RID is ri.ontology.main.<kebab-kind>.<uuid>
-- (ontology, object-type, branch), and object-set, type-group and interface
-- took the same inference before this. Nothing external references these
-- values yet, so a wrong token today is a cheap generated-column re-add —
-- the irreversibility the build map feared arrives only once RIDs are
-- exported, which is exactly why this lands now and not later.

ALTER TABLE public.link_types
  ADD COLUMN rid text GENERATED ALWAYS AS (public.rid_of('ontology', 'link-type', id)) STORED;
ALTER TABLE public.shared_properties
  ADD COLUMN rid text GENERATED ALWAYS AS (public.rid_of('ontology', 'shared-property', id)) STORED;
ALTER TABLE public.action_types
  ADD COLUMN rid text GENERATED ALWAYS AS (public.rid_of('ontology', 'action-type', id)) STORED;
ALTER TABLE public.value_types
  ADD COLUMN rid text GENERATED ALWAYS AS (public.rid_of('ontology', 'value-type', id)) STORED;

COMMENT ON COLUMN public.link_types.rid IS
  'ri.ontology.main.link-type.<id>. Existence attested (link-type-metadata); the type token is inference — no page prints one.';
COMMENT ON COLUMN public.shared_properties.rid IS
  'ri.ontology.main.shared-property.<id>. Existence attested (struct-shared-properties); the type token is inference — no page prints one.';
COMMENT ON COLUMN public.action_types.rid IS
  'ri.ontology.main.action-type.<id>. Existence attested (action-log''s Action type RID); the type token is inference — no page prints one.';
COMMENT ON COLUMN public.value_types.rid IS
  'ri.ontology.main.value-type.<id>. Existence attested (value-type-constraints); the type token is inference — no page prints one.';

CREATE UNIQUE INDEX link_types_rid_key ON public.link_types (rid);
CREATE UNIQUE INDEX shared_properties_rid_key ON public.shared_properties (rid);
CREATE UNIQUE INDEX action_types_rid_key ON public.action_types (rid);
CREATE UNIQUE INDEX value_types_rid_key ON public.value_types (rid);

DO $$
BEGIN
  IF public.rid_of('ontology', 'link-type', '00000000-0000-0000-0000-000000000001')
     <> 'ri.ontology.main.link-type.00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Migration 488: the link-type RID does not follow the attested ontology-service form';
  END IF;
  RAISE NOTICE '488: every ontology resource kind now carries a RID; four type tokens are marked inference';
END $$;
