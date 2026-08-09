-- 422 — an object is a replay of its edits
--
-- Reading: docs/foundry-reference/readings/object-edits-and-security.md
--          mirror/object-edits/how-edits-applied (the flowchart and the T0–T14 table)
--          docs/ONTOLOGY-BUILD-MAP.md, phase E1
--
-- ── WHAT AN OBJECT IS ────────────────────────────────────────────────────────
--   "All indexed data in object databases are considered EPHEMERAL."
--   "the Funnel service owns and manages several Foundry datasets, including a
--    MERGED DATASET THAT COMBINES DATA COMING FROM DATASOURCES AND USER EDITS."
--
-- So an object is not stored. It is *resolved* from two durable things: the row
-- in its backing datasource, and the log of instructions applied to it. The
-- index is a cache over that resolution, and this migration builds the two
-- durable halves plus the function that resolves them.
--
-- ── WHAT IDENTIFIES ONE ──────────────────────────────────────────────────────
--   "a single object (that is, A ROW OR OBJECT WITH A SPECIFIC PRIMARY KEY
--    VALUE)"
--
-- The primary key VALUE, not a synthetic id — which is why the course insists it
-- be "a deterministic repeatable process. You should NEVER generate a random ID
-- or GUID for this purpose."
--
-- ── THE RESOLUTION, from the flowchart ───────────────────────────────────────
--   1. Is the latest instruction DELETE?      -> not visible regardless of the
--                                                datasource
--   2. Was there a DELETE, then a create?     -> visible; "the create instruction
--   3. Was there a CREATE at all?                marks the STARTING POINT… and
--                                                the final state IGNORES ALL
--                                                DATASOURCE DATA"
--   4. Is the row present in the datasource?  -> yes: visible, and "properties
--                                                that received user edits IGNORE
--                                                ALL FURTHER DATASOURCE UPDATES.
--                                                For other properties datasource
--                                                updates determine the final
--                                                state"
--                                                no:  "not visible until
--                                                restored in the datasource"
--
-- Steps 2 and 3 collapse: both mean "there is a create in the log", and the
-- state is built from that create forward.
--
-- ── KEYED ON API NAME ────────────────────────────────────────────────────────
-- Both halves use the property's API name, because that is what the merged form
-- already uses: "the API Name metadata of each property is used as the schema of
-- the materialized dataset" (object-edits/materializations).

BEGIN;

CREATE TABLE public.object_edits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type_id uuid NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,

  -- The identity. Text because a primary key may be string, integer or short,
  -- and the log has to hold all three without caring which.
  primary_key    text NOT NULL,

  -- "Create object" / "Modify object(s)" / "Delete object(s)" — the three
  -- Ontology rule kinds that write.
  instruction    text NOT NULL CHECK (instruction IN ('create','modify','delete')),
  -- Keyed by property API name. Empty for a delete.
  properties     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Strategy 2 compares this against the datasource's timestamp column.
  applied_at     timestamptz NOT NULL DEFAULT now(),
  applied_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Which action wrote it, when one did.
  action_type_id uuid REFERENCES public.action_types(id) ON DELETE SET NULL,

  seq            bigserial NOT NULL,

  CHECK (instruction <> 'delete' OR properties = '{}'::jsonb)
);

COMMENT ON TABLE public.object_edits IS
  'The user-edit log — one of the two durable halves of an object. "There is no mechanism to directly undo a single user edit"; the log is append-only and the state is a replay of it.';
COMMENT ON COLUMN public.object_edits.primary_key IS
  'The identity of the object: "a row or object with a specific primary key value".';

CREATE INDEX idx_object_edits_object ON public.object_edits (object_type_id, primary_key, seq);

-- "any `Modify object` Action call will fail" on a deleted object (T14).
CREATE OR REPLACE FUNCTION public.guard_object_edit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest text;
BEGIN
  SELECT e.instruction INTO latest
    FROM public.object_edits e
   WHERE e.object_type_id = NEW.object_type_id AND e.primary_key = NEW.primary_key
   ORDER BY e.seq DESC LIMIT 1;

  IF latest = 'delete' AND NEW.instruction = 'modify' THEN
    RAISE EXCEPTION 'Ontology:ObjectIsDeleted — a Modify object action cannot be applied to a deleted object'
      USING HINT = 'Create it again first; a create marks a new starting point.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_object_edit
  BEFORE INSERT ON public.object_edits
  FOR EACH ROW EXECUTE FUNCTION public.guard_object_edit();

-- ── the replay ───────────────────────────────────────────────────────────────
-- A pure function of the two inputs the published table gives: the datasource
-- row and the edit log. Returns exactly what the table's last column states.

CREATE OR REPLACE FUNCTION public.object_state(
  p_object_type uuid,
  p_primary_key text,
  p_datasource_row jsonb          -- NULL when the row is not in the datasource
) RETURNS TABLE (properties jsonb, deleted boolean)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  latest text; create_seq bigint; state jsonb; e record;
BEGIN
  SELECT i.instruction INTO latest
    FROM public.object_edits i
   WHERE i.object_type_id = p_object_type AND i.primary_key = p_primary_key
   ORDER BY i.seq DESC LIMIT 1;

  -- 1. "Is the latest instruction delete?" -> not visible regardless of the
  --    datasource state.
  IF latest = 'delete' THEN
    RETURN QUERY SELECT '{}'::jsonb, true; RETURN;
  END IF;

  -- 2 and 3. A create anywhere in the log means the object was created — or
  --    recreated after a deletion — and "the create instruction marks the
  --    starting point… the final state ignores all datasource data".
  SELECT max(i.seq) INTO create_seq
    FROM public.object_edits i
   WHERE i.object_type_id = p_object_type AND i.primary_key = p_primary_key
     AND i.instruction = 'create';

  IF create_seq IS NOT NULL THEN
    -- Every declared property, null unless the create or a later modify set it.
    -- T9: a create naming only col3 yields col1 = null, col2 = null even though
    -- the datasource holds values for both.
    SELECT coalesce(jsonb_object_agg(p.api_name, 'null'::jsonb), '{}'::jsonb) INTO state
      FROM public.object_type_properties p WHERE p.object_type_id = p_object_type;

    FOR e IN SELECT i.properties FROM public.object_edits i
              WHERE i.object_type_id = p_object_type AND i.primary_key = p_primary_key
                AND i.seq >= create_seq ORDER BY i.seq
    LOOP
      state := state || e.properties;
    END LOOP;

    RETURN QUERY SELECT state, false; RETURN;
  END IF;

  -- 4. No create. The datasource decides whether it exists at all.
  IF p_datasource_row IS NULL THEN
    RETURN QUERY SELECT '{}'::jsonb, true; RETURN;
  END IF;

  -- "Properties that received user edits through modification instructions
  --  ignore all further datasource updates. For other properties datasource
  --  updates determine the final state."
  state := p_datasource_row;
  FOR e IN SELECT i.properties FROM public.object_edits i
            WHERE i.object_type_id = p_object_type AND i.primary_key = p_primary_key
            ORDER BY i.seq
  LOOP
    state := state || e.properties;
  END LOOP;

  RETURN QUERY SELECT state, false;
END $$;

COMMENT ON FUNCTION public.object_state(uuid, text, jsonb) IS
  'Resolves one object from its datasource row and its edit log, following the four-step decision in object-edits/how-edits-applied. Checked against that page''s T0–T14 table in @beacon/platform.';

REVOKE ALL ON FUNCTION public.object_state(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.object_state(uuid, text, jsonb) TO authenticated;

-- ── the toggle, and where edits are allowed at all ───────────────────────────
--   "User edits can be enabled and disabled using the Edits toggle in the
--    Datasources tab." And per DATASOURCE, not per object type:
--   "Each datasource of the object type can have different resolution
--    strategies."

ALTER TABLE public.object_types
  ADD COLUMN edits_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN track_edit_history  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.object_types.edits_enabled IS
  'The Edits toggle. "Disabling edits will not remove existing edits", so this gates new ones only. Also what makes the Materializations tab appear.';

ALTER TABLE public.object_type_datasources
  ADD COLUMN conflict_resolution text NOT NULL DEFAULT 'apply_user_edits'
    CHECK (conflict_resolution IN ('apply_user_edits','apply_most_recent_value')),
  -- "The `Apply most recent value` option REQUIRES that the datasource contains
  --  a property with the TIMESTAMP type; the date property type will not work."
  ADD COLUMN timestamp_property_id uuid
    REFERENCES public.object_type_properties(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.object_type_datasources.conflict_resolution IS
  'Per datasource, not per object type: "each datasource of the object type can have different resolution strategies".';

CREATE OR REPLACE FUNCTION public.guard_conflict_resolution()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t text;
BEGIN
  IF NEW.conflict_resolution = 'apply_most_recent_value' THEN
    IF NEW.timestamp_property_id IS NULL THEN
      RAISE EXCEPTION 'Ontology:MostRecentValueNeedsATimestamp — this strategy requires a timestamp property on the datasource';
    END IF;
    SELECT base_type INTO t FROM public.object_type_properties
     WHERE id = NEW.timestamp_property_id;
    -- "the DATE property type will not work for this option"
    IF t <> 'timestamp' THEN
      RAISE EXCEPTION 'Ontology:MostRecentValueNeedsATimestamp — the property is %, and the date property type will not work for this option', t
        USING HINT = 'The timestamp property must be in Coordinated Universal Time (UTC).';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_conflict_resolution
  BEFORE INSERT OR UPDATE ON public.object_type_datasources
  FOR EACH ROW EXECUTE FUNCTION public.guard_conflict_resolution();

-- ── access ───────────────────────────────────────────────────────────────────
-- An edit follows its object type, the way a property does. Object and property
-- security policies are a further layer and land with E-security.

ALTER TABLE public.object_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read edits of visible object types" ON public.object_edits
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()));

-- Writing an edit requires the type to ALLOW edits at all. "Disabling edits will
-- not remove existing edits" — so the gate is on the insert, not the read.
CREATE POLICY "members write edits where edits are enabled" ON public.object_edits
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.object_types t WHERE t.id = object_type_id
      AND t.organization_id IS NOT DISTINCT FROM public.auth_org_id()
      AND t.edits_enabled));

GRANT SELECT, INSERT ON public.object_edits TO authenticated;
-- Deliberately no UPDATE or DELETE. "Data already containing user edits can only
-- be updated via ADDITIONAL user edits. There is no mechanism to directly undo a
-- single user edit or deletion." Wiping them is a schema migration, not a row
-- delete.

COMMIT;
