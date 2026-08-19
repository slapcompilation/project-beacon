-- Phase B7. A property's value can come from objects it links to.
--
-- ── THE THIRD SOURCE, AND THE EVIDENCE IT IS A THIRD SOURCE ────────────────
-- `configure-derived-property-source-tab.png` draws **Source type** as one
-- radio group of exactly three, each with its own subtitle:
--
--   Datasource     "Back this property with a dataset, restricted view or stream"
--   User edits     "Back this property exclusively with edits from user inputs"
--   Linked objects "Use a property from another object type"
--
-- Our `source` CHECK carries the first two as `column` and `user_input`. This
-- adds the third under the name the control uses. It is not a new kind of
-- property and not a new table — it is the same control with a third position,
-- which is why it belongs on `object_type_properties`.
--
-- ── AND THAT SUBTITLE SETTLES WHICH DERIVED PROPERTY THIS IS ───────────────
-- There are two pages and they describe two surfaces. `ontology/derived-
-- properties` defines them broadly — "calculated at runtime based on the values
-- of other properties or links on objects" — and lists exactly one place they
-- are available: "**Ontology SDK:** Derived properties can be used in the
-- TypeScript OSDK with the `withProperties` operation". That is a QUERY-time
-- construct, computed per request.
--
-- `object-link-types/derived-properties` is the Ontology Manager one: a property
-- ON the object type, whose Source type control says "Use a property from
-- another object type". So the same-object derivation the broad wording allows
-- belongs to the OSDK surface, not to a property definition. **What is modelled
-- here is not a narrowed version of the concept; it is the whole of the half
-- that lives in the ontology.**
--
-- ── THE CHAIN ─────────────────────────────────────────────────────────────
-- `configure-derived-property-aggregation.png` is the entire configuration in
-- one frame, and it fixes an order the prose spreads over three numbered steps:
--
--   Linked objects   Movie Roles [Role] · Movie [Movie] · Add linked object
--   Aggregation      Collect set
--   Property         Title
--   Limit            10
--
-- Each hop row is a LINK TYPE showing the object type it reaches. So a hop
-- points at `link_types` and the object type is computed, never stored beside
-- it — the same reason `object_links` was deleted three times.
--
-- **The cap counts links, not object types.** Step 4 calls them "levels of
-- connections"; the multi-hop procedure adds one level per link ("Select your
-- first link type… Add linked object to add another level… Repeat up to 3
-- levels total"); and both screenshots draw exactly two rows for the two-link
-- worked example, with the starting object type not a row at all. Three hops,
-- four object types.
--
-- ── WHAT IS ENFORCED HERE, AND WHAT CANNOT BE ─────────────────────────────
-- Of the ten Known limitations, three are statements about a property's own
-- definition and are enforced as CHECKs:
--
--   "Derived properties cannot be marked as required (non-nullable)."
--   "Properties with value types cannot be converted to derived properties."
--   "Primary key properties cannot be derived properties."
--
-- The rest are about queries (OSv1 indexing, text search, structs in the OSDK),
-- about mechanisms we do not model (inline actions, rule set bindings, base
-- formatters, property type constraints), or about a Default ontology we have
-- no counterpart for. Refusing something we cannot represent would be theatre.
--
-- The primary-key one is worth a note: `object_type_properties_check3` already
-- says a primary key must be `required`, so "cannot be required" alone implies
-- "cannot be a primary key". Both are stated on the page and both are asserted,
-- because a rule that holds only as a consequence of another rule is one
-- refactor from gone.
--
-- ── WHERE THE CHAIN RULES LIVE, AND WHY NOT ALL IN A TRIGGER ──────────────
-- A hop can be checked as it is written: the link type must touch the object
-- type the chain has reached, and positions run 1..3 without gaps. That is
-- structural and goes in a trigger.
--
-- Three rules cannot be checked that way, because they are only knowable once
-- the chain is COMPLETE, and Foundry builds it incrementally — the panel exists
-- in a half-configured state, with "Select linked object" still empty. A
-- trigger that demanded completeness would make the documented authoring order
-- impossible. Those go to `ontology_violations()`, which is where this repo puts
-- "is the ontology we have well-formed":
--
--   * a derived property with no hops at all
--   * an aggregation missing when some hop is a "many"
--     ("If any link in your chain has a 'many' cardinality … you must select an
--      Aggregation")
--   * a derived-from property that does not belong to the object type the chain
--     actually reaches
--
-- ── BETA, SAID OUT LOUD ────────────────────────────────────────────────────
-- "As a beta feature under active development, derived properties currently
-- have some capability limitations." We have shipped Beta before (the branch
-- overlay) but deliberately. This is deliberate.

BEGIN;

-- ── §1 the third source ────────────────────────────────────────────────────
ALTER TABLE public.object_type_properties
  DROP CONSTRAINT object_type_properties_source_check,
  ADD CONSTRAINT object_type_properties_source_check
    CHECK (source = ANY (ARRAY['column', 'user_input', 'linked_objects']));

-- 545's arms said every property names either a column or a datasource. A
-- derived property names NEITHER: "Derived properties use the security of all
-- objects involved in the calculation, so they do not expose information a user
-- would otherwise be unable to see." Security comes from the source objects, so
-- there is nothing to permission and nothing to read.
ALTER TABLE public.object_type_properties
  DROP CONSTRAINT object_type_properties_source_names_its_data,
  ADD CONSTRAINT object_type_properties_source_names_its_data
    CHECK (
      (source = 'column'         AND backing_column IS NOT NULL)
      OR (source = 'user_input'  AND backing_column IS NULL AND datasource_id IS NOT NULL)
      OR (source = 'linked_objects' AND backing_column IS NULL AND datasource_id IS NULL));

-- ── §2 the nine aggregations ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.derived_aggregations()
RETURNS TABLE (name text, needs_property boolean, takes_limit boolean)
LANGUAGE sql IMMUTABLE AS $fn$
  VALUES
    -- "For Count aggregation, you do not need to select a property as objects
    --  are automatically counted."
    ('count',                  false, false),
    ('average',                true,  false),
    ('sum',                    true,  false),
    ('minimum',                true,  false),
    ('maximum',                true,  false),
    ('approximate_cardinality',true,  false),
    ('exact_cardinality',      true,  false),
    -- "If you selected Collect list or Collect set as your aggregation, you can
    --  optionally set a limit on the number of items collected."
    ('collect_list',           true,  true),
    ('collect_set',            true,  true)
$fn$;
REVOKE ALL ON FUNCTION public.derived_aggregations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.derived_aggregations() TO authenticated;

-- A CHECK cannot hold a subquery, so the vocabulary is also an array, the way
-- `property_base_types()` already serves the base-type CHECK.
CREATE OR REPLACE FUNCTION public.derived_aggregation_names()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT ARRAY['count','average','sum','minimum','maximum',
               'approximate_cardinality','exact_cardinality',
               'collect_list','collect_set']
$fn$;

-- ── §3 the terminal, beside the property as `column`'s backing already is ──
ALTER TABLE public.object_type_properties
  ADD COLUMN derived_aggregation text,
  ADD COLUMN derived_from_property_id uuid REFERENCES public.object_type_properties(id) ON DELETE RESTRICT,
  -- "The default limit is 10 items."
  ADD COLUMN derived_limit integer CHECK (derived_limit IS NULL OR derived_limit > 0);

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT derived_fields_only_when_derived CHECK (
    source = 'linked_objects'
    OR (derived_aggregation IS NULL AND derived_from_property_id IS NULL AND derived_limit IS NULL)),
  ADD CONSTRAINT derived_aggregation_is_published CHECK (
    derived_aggregation IS NULL
    OR derived_aggregation = ANY (public.derived_aggregation_names())),
  -- Count takes no property; everything else does.
  ADD CONSTRAINT derived_count_takes_no_property CHECK (
    derived_aggregation IS DISTINCT FROM 'count' OR derived_from_property_id IS NULL),
  -- A limit belongs to the two collect aggregations and nothing else.
  ADD CONSTRAINT derived_limit_is_for_collect CHECK (
    derived_limit IS NULL
    OR derived_aggregation IN ('collect_list', 'collect_set')),
  -- The three limitations that are about a property's own definition.
  ADD CONSTRAINT derived_is_not_required CHECK (
    source <> 'linked_objects' OR NOT required),
  ADD CONSTRAINT derived_takes_no_value_type CHECK (
    source <> 'linked_objects' OR value_type_id IS NULL),
  ADD CONSTRAINT derived_is_not_a_primary_key CHECK (
    source <> 'linked_objects' OR NOT is_primary_key);

COMMENT ON COLUMN public.object_type_properties.derived_aggregation IS
  'Which of the nine aggregations combines the linked values. Required when any hop is a "many"; the chain is checked by ontology_violations() because Foundry authors it incrementally.';
COMMENT ON COLUMN public.object_type_properties.derived_from_property_id IS
  'The property on the object type the hop chain reaches. Null exactly for count, which needs no property.';
COMMENT ON COLUMN public.object_type_properties.derived_limit IS
  'Collect list/set only. Foundry defaults it to 10; null here means unset, not unlimited.';

-- ── §4 the hops ───────────────────────────────────────────────────────────
CREATE TABLE public.derived_property_hops (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES public.object_type_properties(id) ON DELETE CASCADE,
  -- "Repeat up to 3 levels total", and a level is a link.
  position     integer NOT NULL CHECK (position BETWEEN 1 AND 3),
  link_type_id uuid NOT NULL REFERENCES public.link_types(id) ON DELETE RESTRICT,
  UNIQUE (property_id, position)
);
CREATE INDEX derived_property_hops_property ON public.derived_property_hops (property_id);
CREATE INDEX derived_property_hops_link ON public.derived_property_hops (link_type_id);

COMMENT ON TABLE public.derived_property_hops IS
  'The ordered link chain a derived property traverses, one row per hop as the Linked objects panel draws it. The object type each hop reaches is computed from the link, never stored — a hop names a link type and nothing else.';

ALTER TABLE public.derived_property_hops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read hops in scope" ON public.derived_property_hops
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = derived_property_hops.property_id
       AND (select public.auth_in_ontology(t.ontology_id))));
CREATE POLICY "admins author hops" ON public.derived_property_hops
  FOR ALL USING ((select public.auth_role()) = ANY (ARRAY['owner','admin']) AND EXISTS (
    SELECT 1 FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
     WHERE p.id = derived_property_hops.property_id
       AND (select public.auth_member_of_ontology(t.ontology_id))))
  WITH CHECK ((select public.auth_role()) = ANY (ARRAY['owner','admin']));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.derived_property_hops TO authenticated;

-- ── §5 traversal, both ways, because a link has two ends ──────────────────
-- "The dropdown menu shows all available link types from your current object
--  type." A link type is available from either end, so a hop may run against
--  the arrow — 417 built the two ends precisely so that is expressible.
CREATE OR REPLACE FUNCTION public.link_other_end(p_link uuid, p_from uuid)
RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT CASE
    WHEN l.source_object_type_id = p_from THEN l.target_object_type_id
    WHEN l.target_object_type_id = p_from THEN l.source_object_type_id
  END
  FROM public.link_types l WHERE l.id = p_link
$fn$;
COMMENT ON FUNCTION public.link_other_end(uuid, uuid) IS
  'The object type a hop reaches, or NULL when the link does not touch the one it starts from. A self-link resolves to the same type, which is correct.';

-- Which side is "many" depends on which end you enter from: one_to_many is many
-- forwards and one backwards, and many_to_one is the reverse. 417 reads the
-- forward half the same way when it picks get() over all().
CREATE OR REPLACE FUNCTION public.link_hop_is_many(p_link uuid, p_from uuid)
RETURNS boolean LANGUAGE sql STABLE AS $fn$
  SELECT CASE
    WHEN l.source_object_type_id = p_from
      THEN l.cardinality IN ('one_to_many', 'many_to_many')
    WHEN l.target_object_type_id = p_from
      THEN l.cardinality IN ('many_to_one', 'many_to_many')
  END
  FROM public.link_types l WHERE l.id = p_link
$fn$;

-- Where the chain stands after every hop it has: the object type it reaches,
-- and whether anything along it was a many.
CREATE OR REPLACE FUNCTION public.derived_chain(p_property uuid)
RETURNS TABLE (reached uuid, any_many boolean, hops integer)
LANGUAGE plpgsql STABLE AS $fn$
DECLARE h record; cur uuid; many boolean := false; n int := 0;
BEGIN
  SELECT object_type_id INTO cur FROM public.object_type_properties WHERE id = p_property;
  FOR h IN SELECT link_type_id FROM public.derived_property_hops
            WHERE property_id = p_property ORDER BY position LOOP
    many := many OR coalesce(public.link_hop_is_many(h.link_type_id, cur), false);
    cur  := public.link_other_end(h.link_type_id, cur);
    n    := n + 1;
    EXIT WHEN cur IS NULL;
  END LOOP;
  RETURN QUERY SELECT cur, many, n;
END $fn$;

-- ── §6 the hop guard: what can be known as each hop is written ────────────
CREATE OR REPLACE FUNCTION public.guard_derived_property_hop()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE src text; cur uuid; n int;
BEGIN
  SELECT source INTO src FROM public.object_type_properties WHERE id = NEW.property_id;
  IF src IS DISTINCT FROM 'linked_objects' THEN
    RAISE EXCEPTION 'Ontology:HopOnNonDerivedProperty — only a linked_objects property traverses links';
  END IF;

  -- Contiguous from 1: the panel adds one row at a time, so a gap is not a
  -- chain Foundry could have authored.
  SELECT count(*) INTO n FROM public.derived_property_hops
   WHERE property_id = NEW.property_id AND position < NEW.position;
  IF n <> NEW.position - 1 THEN
    RAISE EXCEPTION 'Ontology:HopChainHasAGap — hop % has no hop % before it', NEW.position, NEW.position - 1;
  END IF;

  -- Where the chain stands entering this hop, then whether the link touches it.
  SELECT object_type_id INTO cur FROM public.object_type_properties WHERE id = NEW.property_id;
  IF NEW.position > 1 THEN
    SELECT reached INTO cur FROM public.derived_chain(NEW.property_id);
  END IF;
  IF public.link_other_end(NEW.link_type_id, cur) IS NULL THEN
    RAISE EXCEPTION 'Ontology:HopLinkDoesNotReach — that link type does not touch the object type this chain has reached'
      USING HINT = 'The dropdown shows all available link types from the current object type; a hop must start where the previous one landed.';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER derived_hop_is_reachable
  BEFORE INSERT OR UPDATE ON public.derived_property_hops
  FOR EACH ROW EXECUTE FUNCTION public.guard_derived_property_hop();

-- ── §7 the three rules only a complete chain can answer ───────────────────
CREATE OR REPLACE FUNCTION public.derived_property_problems()
RETURNS TABLE (object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  WITH d AS (
    SELECT p.id, p.property_id, p.derived_aggregation, p.derived_from_property_id,
           t.api_name AS ot, c.reached, c.any_many, c.hops
      FROM public.object_type_properties p
      JOIN public.object_types t ON t.id = p.object_type_id
      CROSS JOIN LATERAL public.derived_chain(p.id) c
     WHERE p.source = 'linked_objects')
  SELECT ot, 'property', property_id,
         'Derived property traverses no links; a linked_objects property needs at least one hop'
    FROM d WHERE hops = 0
  UNION ALL
  -- "If any link in your chain has a 'many' cardinality … you must select an
  --  Aggregation to combine the values"
  SELECT ot, 'property', property_id,
         'Derived property crosses a "many" link and names no aggregation'
    FROM d WHERE any_many AND derived_aggregation IS NULL
  UNION ALL
  -- "The dropdown menu shows all available properties from the final object
  --  type in your link chain."
  SELECT d.ot, 'property', d.property_id,
         format('Derived property reads "%s", which is not a property of the object type its chain reaches', f.property_id)
    FROM d JOIN public.object_type_properties f ON f.id = d.derived_from_property_id
   WHERE d.reached IS NOT NULL AND f.object_type_id IS DISTINCT FROM d.reached
  UNION ALL
  SELECT ot, 'property', property_id,
         'Derived property names an aggregation that needs a property, and names none'
    FROM d WHERE derived_aggregation IS NOT NULL
      AND derived_from_property_id IS NULL
      AND (SELECT needs_property FROM public.derived_aggregations() a WHERE a.name = derived_aggregation)
$fn$;
REVOKE ALL ON FUNCTION public.derived_property_problems() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.derived_property_problems() TO authenticated;

-- The existing body is kept verbatim under a new name rather than retyped into
-- a wrapper: retyping it is how a linter quietly loses a check.
ALTER FUNCTION public.ontology_violations() RENAME TO ontology_violations_core;

CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE (object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT * FROM public.ontology_violations_core()
  UNION ALL
  SELECT * FROM public.derived_property_problems()
$fn$;

DO $do$
DECLARE g text;
BEGIN
  -- Whatever the original carried, the wrapper carries too.
  FOR g IN SELECT 'authenticated' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.ontology_violations_core() FROM PUBLIC');
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.ontology_violations_core() TO %I', g);
    EXECUTE format('REVOKE ALL ON FUNCTION public.ontology_violations() FROM PUBLIC');
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.ontology_violations() TO %I', g);
  END LOOP;
END $do$;

-- ── assertions, which build a real two-hop chain and break it four ways ────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; usr uuid;
  actor uuid; role_ot uuid; movie uuid;
  l_roles uuid; l_movie uuid; l_far uuid; far uuid; studio uuid; l_studio uuid;
  prop uuid; title uuid; other uuid; n int; ok boolean; got_reached uuid; got_many boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe576') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe576') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe576', 'Probe576') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe576@beacon.test') RETURNING id INTO usr;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe576', 'Probe576', false) RETURNING id INTO ont;

    -- The page's own example: Actor —Movie Roles→ Role —Movie→ Movie.
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Actor', 'Actor') RETURNING id INTO actor;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Role', 'Role') RETURNING id INTO role_ot;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Movie', 'Movie') RETURNING id INTO movie;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Unrelated', 'Unrelated') RETURNING id INTO far;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Studio', 'Studio') RETURNING id INTO studio;

    INSERT INTO public.link_types (ontology_id, project_id, api_name, label,
        source_object_type_id, target_object_type_id, cardinality,
        source_api_name, target_api_name, source_label, target_label)
      VALUES (ont, proj, 'movie-roles', 'Movie Roles', actor, role_ot, 'one_to_many',
              'actor', 'roles', 'Actor', 'Roles') RETURNING id INTO l_roles;
    INSERT INTO public.link_types (ontology_id, project_id, api_name, label,
        source_object_type_id, target_object_type_id, cardinality,
        source_api_name, target_api_name, source_label, target_label)
      VALUES (ont, proj, 'role-movie', 'Movie', role_ot, movie, 'many_to_one',
              'roles', 'movie', 'Roles', 'Movie') RETURNING id INTO l_movie;
    INSERT INTO public.link_types (ontology_id, project_id, api_name, label,
        source_object_type_id, target_object_type_id, cardinality,
        source_api_name, target_api_name, source_label, target_label)
      -- Deliberately touches NEITHER end of where the chain lands. An earlier
      -- draft pointed this at Movie and the guard correctly accepted it: a link
      -- is traversable from either end, so Unrelated--Movie IS reachable once
      -- the chain has reached Movie. The test was wrong, not the rule.
      VALUES (ont, proj, 'far-link', 'Far', far, role_ot, 'one_to_one',
              'far', 'role', 'Far', 'Role') RETURNING id INTO l_far;
    INSERT INTO public.link_types (ontology_id, project_id, api_name, label,
        source_object_type_id, target_object_type_id, cardinality,
        source_api_name, target_api_name, source_label, target_label)
      VALUES (ont, proj, 'movie-studio', 'Studio', movie, studio, 'many_to_one',
              'movies', 'studio', 'Movies', 'Studio') RETURNING id INTO l_studio;

    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (movie, 'title', 'title', 'Title', 'string', 'title') RETURNING id INTO title;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (actor, 'name', 'name', 'Name', 'string', 'name') RETURNING id INTO other;

    -- ── the derived property itself: neither column nor datasource ─────────
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type,
       source, derived_aggregation, derived_from_property_id, derived_limit)
      VALUES (actor, 'movieTitles', 'movieTitles', 'Movie titles', 'string',
              'linked_objects', 'collect_set', title, 10) RETURNING id INTO prop;

    -- ── the chain ─────────────────────────────────────────────────────────
    INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
      VALUES (prop, 1, l_roles);
    INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
      VALUES (prop, 2, l_movie);

    SELECT c.reached, c.any_many INTO got_reached, got_many FROM public.derived_chain(prop) c;
    IF got_reached IS DISTINCT FROM movie THEN
      RAISE EXCEPTION 'a two-hop chain did not reach Movie';
    END IF;
    -- one_to_many forwards is a many; many_to_one forwards is not.
    IF NOT got_many THEN RAISE EXCEPTION 'the one_to_many hop was not seen as a many'; END IF;

    -- Complete and legal: the linter says nothing about it.
    SELECT count(*) INTO n FROM public.derived_property_problems() WHERE subject = 'movieTitles';
    IF n <> 0 THEN
      RAISE EXCEPTION 'a well-formed derived property reported % problem(s)', n;
    END IF;

    -- ── the hop guard ─────────────────────────────────────────────────────
    -- A link that does not touch where the chain stands.
    ok := false;
    BEGIN
      INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
        VALUES (prop, 3, l_far);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%HopLinkDoesNotReach%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a hop attached to an unreachable link type'; END IF;

    -- A gap in the chain.
    ok := false;
    BEGIN
      INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
        VALUES (other, 2, l_roles);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%HopOnNonDerivedProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a hop attached to a column-backed property'; END IF;

    -- Three hops is the cap, four is not. The fourth has to be otherwise LEGAL
    -- to reach the CHECK at all: a BEFORE trigger runs ahead of a constraint,
    -- so an earlier draft that jumped straight to position 4 only ever proved
    -- the gap guard fires. Hop 3 is added first, and hop 4 traverses a link
    -- that genuinely touches where hop 3 landed.
    INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
      VALUES (prop, 3, l_studio);
    SELECT c.reached INTO got_reached FROM public.derived_chain(prop) c;
    IF got_reached IS DISTINCT FROM studio THEN
      RAISE EXCEPTION 'the third hop did not land on Studio';
    END IF;

    ok := false;
    BEGIN
      INSERT INTO public.derived_property_hops (property_id, position, link_type_id)
        VALUES (prop, 4, l_studio);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a fourth hop was accepted past the documented cap'; END IF;

    -- Put the chain back to the two-hop shape the rest of the block assumes.
    DELETE FROM public.derived_property_hops WHERE property_id = prop AND position = 3;

    -- ── the three documented limitations ──────────────────────────────────
    ok := false;
    BEGIN
      UPDATE public.object_type_properties SET required = true WHERE id = prop;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a derived property was marked required'; END IF;

    ok := false;
    BEGIN
      UPDATE public.object_type_properties SET is_primary_key = true WHERE id = prop;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a derived property became a primary key'; END IF;

    -- ── and the terminal shape ────────────────────────────────────────────
    -- Count takes no property.
    ok := false;
    BEGIN
      UPDATE public.object_type_properties
         SET derived_aggregation = 'count' WHERE id = prop;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'count kept a derived-from property'; END IF;

    -- A limit belongs to collect only.
    ok := false;
    BEGIN
      UPDATE public.object_type_properties
         SET derived_aggregation = 'sum' WHERE id = prop;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a limit survived a non-collect aggregation'; END IF;

    -- A column-backed property may carry none of the derived fields.
    ok := false;
    BEGIN
      UPDATE public.object_type_properties SET derived_aggregation = 'sum' WHERE id = other;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a column property carried an aggregation'; END IF;

    -- ── the linter catches what the trigger cannot ────────────────────────
    -- A derived property with no hops at all.
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source)
      VALUES (actor, 'empty', 'empty', 'Empty', 'string', 'linked_objects');
    SELECT count(*) INTO n FROM public.derived_property_problems()
     WHERE subject = 'empty' AND problem LIKE '%at least one hop%';
    IF n <> 1 THEN RAISE EXCEPTION 'the linter missed a hopless derived property'; END IF;

    -- A many chain with no aggregation.
    UPDATE public.object_type_properties
       SET derived_aggregation = NULL, derived_from_property_id = NULL, derived_limit = NULL
     WHERE id = prop;
    SELECT count(*) INTO n FROM public.derived_property_problems()
     WHERE subject = 'movieTitles' AND problem LIKE '%names no aggregation%';
    IF n <> 1 THEN RAISE EXCEPTION 'the linter missed a many chain with no aggregation'; END IF;

    -- A derived-from property on the wrong object type.
    UPDATE public.object_type_properties
       SET derived_aggregation = 'collect_set', derived_from_property_id = other
     WHERE id = prop;
    SELECT count(*) INTO n FROM public.derived_property_problems()
     WHERE subject = 'movieTitles' AND problem LIKE '%not a property of the object type%';
    IF n <> 1 THEN RAISE EXCEPTION 'the linter missed a derived-from on the wrong type'; END IF;

    -- And ontology_violations() actually carries them, plus what it had before.
    SELECT count(*) INTO n FROM public.ontology_violations() WHERE subject = 'movieTitles';
    IF n = 0 THEN RAISE EXCEPTION 'the wrapper dropped the derived-property arm'; END IF;

    RAISE EXCEPTION 'probe576:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe576:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe576';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '576: a property may be derived from linked objects';
END $do$;

COMMIT;
