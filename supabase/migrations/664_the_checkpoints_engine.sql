-- The checkpoints engine, from readings/checkpoints.md (built after a human
-- read its Decisions block and chose the server-side gate).
--
--   "Checkpoints allows you to interrupt potentially sensitive user interactions with prompts requesting justification for the activity."
--   — checkpoints/overview.md
--
-- Three nouns, three tables (plus the items):
--
--   "The prompt in each checkpoint and the type of justification required is set in a **checkpoint configuration**."
--   — checkpoints/overview.md
--
--   "Once submitted, each checkpoint produces a **checkpoint record** that contains the contextual data associated with an interaction governed by a checkpoint."
--   — checkpoints/overview.md
--
-- ── WHERE ENFORCEMENT LIVES, AND WHY ─────────────────────────────────────────
-- No page states where Foundry enforces; the captures' observable contract is
-- that the interaction is HELD until a record exists: the export dialog sits
-- over a verifying-download toast, and an action form's submit stays disabled
-- with a some-prompts-not-justified tooltip (both paraphrased from the
-- checkpoints captures, whose text is not quotable here). Ours enforces in the
-- producing path — INFERENCE, operator-approved: a BEFORE trigger on each
-- produced table calls checkpoint_gate; with an applicable configuration and
-- no unconsumed record, the write refuses with
-- Checkpoints:JustificationRequired carrying the configured language; the
-- surface collects the justification, submit_checkpoint writes the record,
-- and the retried write consumes it, stamping the interaction reference the
-- wire calls interactionRid. System paths (the login hook, beacon_runner's
-- heartbeats) carry no JWT claims and are exempt by that fact — a checkpoint
-- describes a USER interaction.
--
-- ── SCOPE: WHO THE USER IS, OR WHERE THE RESOURCE LIVES ──────────────────────
--
--   "A checkpoint configured with an organization scope will only prompt users who are members of that organization."
--   — checkpoints/configure-checkpoints.md
--
--   "A checkpoint configured with a space scope will only prompt users when they are interacting with a resource that is contained within that space, regardless of the user's organization."
--   — checkpoints/configure-checkpoints.md
--
-- The api names the same split USER_SCOPED / RESOURCE_SCOPED ("Indicates
-- whether the checkpoint was scoped to a user or resource." —
-- api/checkpoints-v2-resources-records-get-record.md); derived here, never
-- stored. Space scope is admitted only for types whose interaction carries a
-- located resource — for this tranche the role-grant pair, whose project
-- names its space.
--
-- ── CONDITIONS: ONE MATCHER PER KIND, EXEMPTIONS UNLIMITED ───────────────────
--
--   "If the `NOT` option is selected, the checkpoint will only show up if the condition is false."
--   — checkpoints/configure-checkpoints.md
--
--   "You can specify only one matcher of each type per checkpoint configuration, but there is no limit on the number of groups, users, resources, or markings you can exempt with exemption matchers."
--   — checkpoints/configure-checkpoints.md
--
-- Held by a partial unique index over (config, kind) WHERE NOT negated.
--
-- ── THE RECORD IS A STATIC SNAPSHOT ──────────────────────────────────────────
--
--   "These values are inherited from the checkpoint configuration but are static; they always reflect the text shown to a user in the checkpoint and will not be updated if the underlying checkpoint configuration is edited or deleted."
--   — checkpoints/core-concepts.md
--
-- So records copy title/prompt/description and the configuration's RID as
-- text; the configuration FK is SET NULL on delete and the record outlives
-- it. Records are immutable to callers; only the gate's consumption touches
-- them. The RID grammar ri.checkpoints.main.record / .configuration is
-- INFERENCE — no page prints one.
--
-- ── WHAT IS ADMITTED, EMIT-ONLY ──────────────────────────────────────────────
-- Eleven checkpoint types, each snake_case of its checkpoint-types table row,
-- each wired to its producing table IN THIS MIGRATION: the group-member pair,
-- the marking-member pair, the role-grant pair, the four schedule types, run
-- build, and schedule run. Excluded with reasons the reading records: login
-- (the page's own callout demands a dedicated asynchronous user manager even
-- in Foundry, and our login path has no prompt surface), reauthentication
-- justifications (no re-auth ceremony), submit_action and the export/import
-- types (they arrive with their interception — apply_action's patch and the
-- surfaces), the object-set condition variants, and the ~80 types of
-- products we do not build.
--
-- Name and description are reviewer-facing and hidden from the base grant —
-- the name-and-description capture states that the configuration title is
-- visible only to reviewers and never appears in the checkpoint itself
-- (paraphrased from checkpoints/images/checkpoint-config-name-description.png);
-- admins read the pair through checkpoint_configuration_admin_listing.

-- ── THE VOCABULARIES, FUNCTION-VALUED ────────────────────────────────────────

CREATE FUNCTION public.checkpoint_types() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'group_member_addition', 'group_member_removal',
    'marking_member_addition', 'marking_member_removal',
    'role_grant_addition', 'role_grant_removal',
    'schedule_create', 'schedule_modify', 'schedule_delete', 'schedule_run',
    'run_build']
$$;

COMMENT ON FUNCTION public.checkpoint_types() IS
  'The checkpoint types whose producing path is intercepted here — each snake_case of its checkpoints/checkpoint-types table row. Emit-only: the catalogue''s ~100 are the ceiling and the spelling authority; a type arrives WITH its producer trigger, never before.';

-- "Some checkpoint types (like **Login**) do not describe interactions that
-- involve resources in spaces, and so these checkpoint types cannot be
-- configured with a space scope."
-- — checkpoints/configure-checkpoints.md
CREATE FUNCTION public.space_scopable_checkpoint_types() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['role_grant_addition', 'role_grant_removal']
$$;

COMMENT ON FUNCTION public.space_scopable_checkpoint_types() IS
  'Types whose interaction involves a located resource, so a space scope can resolve — this tranche, the role-grant pair (a grant''s project names its space). Group, marking, schedule and build interactions carry no filesystem location here.';

CREATE FUNCTION public.checkpoint_condition_kinds() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['location', 'user_submitting', 'selected_principal', 'marking']
$$;

COMMENT ON FUNCTION public.checkpoint_condition_kinds() IS
  'The condition kinds the gate evaluates, of configure-checkpoints'' seven: Locations, User submitting checkpoint, Selected user or group, Markings. Action type arrives with submit_action; the six object-set variants wait for their artifacts.';

-- ── CONFIGURATIONS ───────────────────────────────────────────────────────────

CREATE FUNCTION public.checkpoint_justification_config_valid(p_type text, c jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'acknowledgment' THEN c ? 'checkbox_text'
    WHEN 'response'       THEN jsonb_typeof(c) = 'object'
    WHEN 'dropdown'       THEN jsonb_typeof(c -> 'options') = 'array'
                               AND jsonb_array_length(c -> 'options') > 0
    ELSE false END
$$;

COMMENT ON FUNCTION public.checkpoint_justification_config_valid(text, jsonb) IS
  'Per-type required rule components (configure-checkpoints): acknowledgment carries its Checkbox Text; response optionally carries regex (Response Validation), placeholder and display_recent; dropdown carries a non-empty options list, each with a label and a free_response of disabled/optional/mandatory, plus a multiple flag.';

CREATE TABLE public.checkpoint_configurations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('checkpoints', 'configuration', id)) STORED,
  -- organization XOR space — the two scopes, USER_SCOPED and RESOURCE_SCOPED
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  space_id        uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  -- reviewer-facing, hidden from the base grant
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text NOT NULL DEFAULT '',
  -- the shown language; the 45-character title guidance is a recommendation,
  -- so no CHECK ("Use less than 45 characters to render fully")
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  prompt          text NOT NULL CHECK (length(btrim(prompt)) > 0),
  checkpoint_description text NOT NULL DEFAULT '',
  justification_type text NOT NULL
                  CHECK (justification_type = ANY (ARRAY['acknowledgment', 'response', 'dropdown'])),
  justification_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  checkpoint_types text[] NOT NULL,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(organization_id, space_id) = 1),
  CHECK (array_length(checkpoint_types, 1) >= 1
         AND checkpoint_types <@ public.checkpoint_types()),
  CHECK (space_id IS NULL OR checkpoint_types <@ public.space_scopable_checkpoint_types()),
  CHECK (public.checkpoint_justification_config_valid(justification_type, justification_config))
);

COMMENT ON TABLE public.checkpoint_configurations IS
  'A checkpoint configuration (checkpoints/core-concepts): the prompt language and justification type, the checkpoint types it interrupts, and one scope — an organization (prompts its members) or a space (prompts whoever touches its resources). Name and description are reviewer-only, held back by the column grant.';

COMMENT ON CONSTRAINT checkpoint_configurations_justification_type_check ON public.checkpoint_configurations IS
  'Values from checkpoints/configure-checkpoints — Acknowledgment, Response, Dropdown. Reauthentication is the fourth published type, excluded: this platform has no reauthentication ceremony to invoke.';

CREATE UNIQUE INDEX checkpoint_configurations_rid_key ON public.checkpoint_configurations (rid);
CREATE INDEX checkpoint_configurations_org ON public.checkpoint_configurations (organization_id);
CREATE INDEX checkpoint_configurations_space ON public.checkpoint_configurations (space_id);
CREATE INDEX checkpoint_configurations_created_by ON public.checkpoint_configurations (created_by);

CREATE TABLE public.checkpoint_conditions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id  uuid NOT NULL REFERENCES public.checkpoint_configurations(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind = ANY (public.checkpoint_condition_kinds())),
  -- false = matcher (AND), true = exemption (NOT)
  negated    boolean NOT NULL DEFAULT false,
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  group_id   uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  include_member_groups boolean NOT NULL DEFAULT false,
  marking_id uuid REFERENCES public.markings(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  space_id   uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  CONSTRAINT checkpoint_conditions_payload CHECK (
    CASE kind
      WHEN 'user_submitting'    THEN num_nonnulls(user_id, group_id) = 1
                                     AND num_nonnulls(marking_id, project_id, space_id) = 0
      WHEN 'selected_principal' THEN num_nonnulls(user_id, group_id) = 1
                                     AND num_nonnulls(marking_id, project_id, space_id) = 0
      WHEN 'marking'            THEN marking_id IS NOT NULL
                                     AND num_nonnulls(user_id, group_id, project_id, space_id) = 0
      WHEN 'location'           THEN num_nonnulls(project_id, space_id) = 1
                                     AND num_nonnulls(user_id, group_id, marking_id) = 0
    END)
);

COMMENT ON TABLE public.checkpoint_conditions IS
  'One condition row per matcher or exemption (configure-checkpoints): every matcher must hold and every exemption must not, for the checkpoint to show. include_member_groups is the Selected-user-or-group flag extending a group to its member groups.';

-- one matcher of each kind; exemptions unlimited
CREATE UNIQUE INDEX checkpoint_conditions_one_matcher_per_kind
  ON public.checkpoint_conditions (config_id, kind) WHERE NOT negated;
CREATE INDEX checkpoint_conditions_config ON public.checkpoint_conditions (config_id);
CREATE INDEX checkpoint_conditions_user ON public.checkpoint_conditions (user_id);
CREATE INDEX checkpoint_conditions_group ON public.checkpoint_conditions (group_id);
CREATE INDEX checkpoint_conditions_marking ON public.checkpoint_conditions (marking_id);
CREATE INDEX checkpoint_conditions_project ON public.checkpoint_conditions (project_id);
CREATE INDEX checkpoint_conditions_space ON public.checkpoint_conditions (space_id);

-- ── RECORDS ──────────────────────────────────────────────────────────────────

CREATE FUNCTION public.checkpoint_justification_valid(j jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE j ->> 'kind'
    WHEN 'acknowledgment' THEN (j ->> 'acknowledged')::boolean IS TRUE
    WHEN 'response'       THEN length(btrim(coalesce(j ->> 'response', ''))) > 0
    WHEN 'dropdown'       THEN jsonb_typeof(j -> 'selections') = 'array'
                               AND jsonb_array_length(j -> 'selections') > 0
    ELSE false END
$$;

COMMENT ON FUNCTION public.checkpoint_justification_valid(jsonb) IS
  'The record''s justification union, api/checkpoints-v2-resources shapes flattened to a kind discriminator: an acknowledgment is a checked box, a response is non-empty text, a dropdown is at least one selection. Config-dependent validation (regex, option membership, mandatory extras) lives in submit_checkpoint.';

CREATE TABLE public.checkpoint_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('checkpoints', 'record', id)) STORED,
  config_id       uuid REFERENCES public.checkpoint_configurations(id) ON DELETE SET NULL,
  -- survives the configuration's deletion, like the language snapshot
  config_rid      text NOT NULL,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  checkpoint_type text NOT NULL CHECK (checkpoint_type = ANY (public.checkpoint_types())),
  -- the static language snapshot
  title           text NOT NULL,
  prompt          text NOT NULL,
  description     text NOT NULL DEFAULT '',
  justification   jsonb NOT NULL CHECK (public.checkpoint_justification_valid(justification)),
  -- stamped by the gate at consumption — the wire's interactionRid
  interaction_ref uuid,
  consumed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checkpoint_records IS
  'One submitted checkpoint (checkpoints/core-concepts): the language as shown (static — never updated when the configuration changes or dies), the typed justification, and the interaction it was consumed by. Immutable to callers; the gate alone consumes.';

CREATE UNIQUE INDEX checkpoint_records_rid_key ON public.checkpoint_records (rid);
CREATE INDEX checkpoint_records_config ON public.checkpoint_records (config_id);
CREATE INDEX checkpoint_records_org ON public.checkpoint_records (organization_id);
CREATE INDEX checkpoint_records_user ON public.checkpoint_records (user_id, created_at DESC);
CREATE INDEX checkpoint_records_unconsumed
  ON public.checkpoint_records (config_id, user_id) WHERE consumed_at IS NULL;

CREATE FUNCTION public.checkpoint_item_kinds() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['user', 'group', 'marking', 'project', 'schedule', 'build', 'dataset']
$$;

COMMENT ON FUNCTION public.checkpoint_item_kinds() IS
  'The checkpointed-item kinds this tranche records, of the api''s ~20-member CheckpointedItem union — the entities the eleven wired types involve.';

CREATE TABLE public.checkpoint_record_items (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.checkpoint_records(id) ON DELETE CASCADE,
  kind      text NOT NULL CHECK (kind = ANY (public.checkpoint_item_kinds())),
  ref_id    uuid NOT NULL,
  -- a name snapshot, because the referent may be renamed or deleted
  name      text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.checkpoint_record_items IS
  'The record''s checkpointed items (checkpoints/core-concepts): typed references to the entities involved in the interaction, with a name snapshot. The api''s redaction wrappers are a read-time concern, recorded as a residual.';

CREATE INDEX checkpoint_record_items_record ON public.checkpoint_record_items (record_id);
CREATE INDEX checkpoint_record_items_ref ON public.checkpoint_record_items (ref_id);

-- ── VISIBILITY ───────────────────────────────────────────────────────────────

ALTER TABLE public.checkpoint_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_record_items ENABLE ROW LEVEL SECURITY;

-- A config is visible to whoever it could prompt: the organization's members,
-- or every member of the space's organizations.
CREATE FUNCTION public.can_see_checkpoint_configuration(p_config uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.checkpoint_configurations c
    WHERE c.id = p_config
      AND ((c.organization_id IS NOT NULL AND public.auth_in_org(c.organization_id))
        OR (c.space_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.space_organizations so
               WHERE so.space_id = c.space_id AND public.auth_in_org(so.organization_id)))))
$$;

REVOKE ALL ON FUNCTION public.can_see_checkpoint_configuration(uuid) FROM PUBLIC, anon;

CREATE POLICY "configs prompt their audience" ON public.checkpoint_configurations
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.auth_in_org(organization_id))
    OR (space_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.space_organizations so
           WHERE so.space_id = checkpoint_configurations.space_id
             AND public.auth_in_org(so.organization_id))));
-- Configuring takes the governance seat — our Data governance officer
-- analogue is the organization admin; the space-scope operation machinery is
-- a recorded residual.
CREATE POLICY "governors add configs" ON public.checkpoint_configurations
  FOR INSERT WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin')
    AND (organization_id IS NULL OR organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())));
CREATE POLICY "governors adjust configs" ON public.checkpoint_configurations
  FOR UPDATE USING ((SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "governors remove configs" ON public.checkpoint_configurations
  FOR DELETE USING ((SELECT public.auth_role()) IN ('owner', 'admin'));

-- "users who see and satisfy the checkpoint will not be able to see the name
-- and description" — the reviewer-facing pair leaves the base grant.
REVOKE SELECT ON public.checkpoint_configurations FROM authenticated;
GRANT SELECT (id, rid, organization_id, space_id, title, prompt,
              checkpoint_description, justification_type, justification_config,
              checkpoint_types, created_at)
  ON public.checkpoint_configurations TO authenticated;

CREATE POLICY "conditions follow their config" ON public.checkpoint_conditions
  FOR SELECT USING (public.can_see_checkpoint_configuration(config_id));
CREATE POLICY "governors add conditions" ON public.checkpoint_conditions
  FOR INSERT WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin')
    AND public.can_see_checkpoint_configuration(config_id));
CREATE POLICY "governors adjust conditions" ON public.checkpoint_conditions
  FOR UPDATE USING ((SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "governors remove conditions" ON public.checkpoint_conditions
  FOR DELETE USING ((SELECT public.auth_role()) IN ('owner', 'admin'));

-- Two of the four review doors this tranche: the record's creator, and the
-- organization's governance seat. Space Administrator and the
-- checkpoints:review-records operation are recorded residuals.
CREATE POLICY "records face their doors" ON public.checkpoint_records
  FOR SELECT USING (user_id = (SELECT auth.uid())
    OR ((SELECT public.auth_role()) IN ('owner', 'admin')
        AND public.auth_in_org(organization_id)));
CREATE POLICY "users submit their own records" ON public.checkpoint_records
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())
    AND organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id()));
-- immutable to callers — consumption is the gate's, as definer
REVOKE UPDATE, DELETE ON public.checkpoint_records FROM authenticated;

CREATE FUNCTION public.can_see_checkpoint_record(p_record uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.checkpoint_records r
    WHERE r.id = p_record
      AND (r.user_id = auth.uid()
        OR (public.auth_role() IN ('owner', 'admin') AND public.auth_in_org(r.organization_id))))
$$;

REVOKE ALL ON FUNCTION public.can_see_checkpoint_record(uuid) FROM PUBLIC, anon;

CREATE POLICY "items follow their record" ON public.checkpoint_record_items
  FOR SELECT USING (public.can_see_checkpoint_record(record_id));
CREATE POLICY "items arrive with their record" ON public.checkpoint_record_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.checkpoint_records r
    WHERE r.id = record_id AND r.user_id = (SELECT auth.uid())));
REVOKE UPDATE, DELETE ON public.checkpoint_record_items FROM authenticated;

-- The reviewer-facing pair, for whoever holds the governance seat.
CREATE FUNCTION public.checkpoint_configuration_admin_listing()
RETURNS TABLE (id uuid, name text, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT c.id, c.name, c.description
    FROM public.checkpoint_configurations c
   WHERE public.auth_role() IN ('owner', 'admin')
     AND ((c.organization_id IS NOT NULL AND public.auth_in_org(c.organization_id))
       OR (c.space_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.space_organizations so
              WHERE so.space_id = c.space_id AND public.auth_in_org(so.organization_id))))
$$;

COMMENT ON FUNCTION public.checkpoint_configuration_admin_listing() IS
  'The reviewer-only name and description, withheld from the base column grant because users who satisfy a checkpoint must not see them (configure-checkpoints). Empty for non-admins by the same predicate the write policies use.';

REVOKE ALL ON FUNCTION public.checkpoint_configuration_admin_listing() FROM PUBLIC, anon;

-- ── SUBMISSION ───────────────────────────────────────────────────────────────

CREATE FUNCTION public.submit_checkpoint(
  p_config uuid, p_justification jsonb, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  c record; v_record uuid; v_sel jsonb; v_opt jsonb; v_n int;
BEGIN
  SELECT id, rid, title, prompt, checkpoint_description, justification_type,
         justification_config, checkpoint_types
    INTO c FROM public.checkpoint_configurations WHERE id = p_config;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkpoints:NoSuchConfiguration — %', p_config;
  END IF;
  IF p_justification ->> 'kind' IS DISTINCT FROM c.justification_type THEN
    RAISE EXCEPTION 'Checkpoints:WrongJustificationType — this checkpoint takes %, not %',
      c.justification_type, coalesce(p_justification ->> 'kind', 'nothing');
  END IF;

  IF c.justification_type = 'response' THEN
    -- "If left empty, any user-submitted response will be accepted."
    IF c.justification_config ? 'regex'
       AND NOT (p_justification ->> 'response' ~ (c.justification_config ->> 'regex')) THEN
      RAISE EXCEPTION 'Checkpoints:ResponseRejected — the response does not match the configured validation';
    END IF;
  ELSIF c.justification_type = 'dropdown' THEN
    v_n := jsonb_array_length(p_justification -> 'selections');
    IF NOT coalesce((c.justification_config ->> 'multiple')::boolean, false) AND v_n > 1 THEN
      RAISE EXCEPTION 'Checkpoints:OneSelection — this checkpoint takes a single selection';
    END IF;
    FOR v_sel IN SELECT * FROM jsonb_array_elements(p_justification -> 'selections') LOOP
      SELECT o INTO v_opt FROM jsonb_array_elements(c.justification_config -> 'options') o
       WHERE o ->> 'label' = v_sel ->> 'option';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Checkpoints:NoSuchOption — % is not a configured dropdown value',
          v_sel ->> 'option';
      END IF;
      IF v_opt ->> 'free_response' = 'mandatory'
         AND length(btrim(coalesce(v_sel ->> 'additional_response', ''))) = 0 THEN
        RAISE EXCEPTION 'Checkpoints:ResponseRequired — % requires an accompanying response',
          v_sel ->> 'option';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.checkpoint_records
    (config_id, config_rid, checkpoint_type, title, prompt, description, justification)
  VALUES (c.id, c.rid, c.checkpoint_types[1], c.title, c.prompt,
          c.checkpoint_description, p_justification)
  RETURNING id INTO v_record;

  INSERT INTO public.checkpoint_record_items (record_id, kind, ref_id, name)
  SELECT v_record, i ->> 'kind', (i ->> 'ref_id')::uuid, coalesce(i ->> 'name', '')
    FROM jsonb_array_elements(p_items) i;

  RETURN v_record;
END $$;

COMMENT ON FUNCTION public.submit_checkpoint(uuid, jsonb, jsonb) IS
  'Writes one checkpoint record as the caller: validates the justification against the configuration (type, response regex, dropdown option membership, mandatory extras, single-vs-multiple), snapshots the language, and attaches the items. The record waits unconsumed until the gate spends it on an interaction.';

REVOKE ALL ON FUNCTION public.submit_checkpoint(uuid, jsonb, jsonb) FROM PUBLIC, anon;

-- ── THE GATE ─────────────────────────────────────────────────────────────────

CREATE FUNCTION public.checkpoint_gate(
  p_type text, p_interaction uuid,
  p_project uuid DEFAULT NULL, p_sel_user uuid DEFAULT NULL,
  p_sel_group uuid DEFAULT NULL, p_marking uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE cfg record; cond record; v_holds boolean; v_applicable boolean; v_rec uuid;
BEGIN
  FOR cfg IN
    SELECT c.* FROM public.checkpoint_configurations c
     WHERE p_type = ANY (c.checkpoint_types)
       AND ((c.organization_id IS NOT NULL AND public.auth_in_org(c.organization_id))
         OR (c.space_id IS NOT NULL AND p_project IS NOT NULL
             AND EXISTS (SELECT 1 FROM public.projects pr
                          WHERE pr.id = p_project AND pr.space_id = c.space_id)))
  LOOP
    v_applicable := true;
    FOR cond IN SELECT * FROM public.checkpoint_conditions WHERE config_id = cfg.id LOOP
      v_holds := CASE cond.kind
        WHEN 'user_submitting' THEN
          (cond.user_id IS NOT NULL AND cond.user_id = auth.uid())
          OR (cond.group_id IS NOT NULL
              AND cond.group_id = ANY (coalesce(public.auth_group_ids(), '{}')))
        WHEN 'selected_principal' THEN
          (cond.user_id IS NOT NULL AND cond.user_id = p_sel_user)
          OR (cond.group_id IS NOT NULL AND (cond.group_id = p_sel_group
              OR (cond.include_member_groups AND p_sel_group IS NOT NULL
                  AND EXISTS (SELECT 1 FROM public.group_members gm
                               WHERE gm.group_id = cond.group_id
                                 AND gm.member_group_id = p_sel_group))))
        WHEN 'marking' THEN
          cond.marking_id = p_marking
        WHEN 'location' THEN
          (cond.project_id IS NOT NULL AND cond.project_id = p_project)
          OR (cond.space_id IS NOT NULL AND p_project IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.projects pr
                           WHERE pr.id = p_project AND pr.space_id = cond.space_id))
      END;
      -- a matcher must hold; an exemption must not
      IF (NOT cond.negated AND NOT coalesce(v_holds, false))
         OR (cond.negated AND coalesce(v_holds, false)) THEN
        v_applicable := false;
        EXIT;
      END IF;
    END LOOP;
    CONTINUE WHEN NOT v_applicable;

    SELECT r.id INTO v_rec FROM public.checkpoint_records r
     WHERE r.config_id = cfg.id AND r.user_id = auth.uid() AND r.consumed_at IS NULL
     ORDER BY r.created_at LIMIT 1;
    IF v_rec IS NULL THEN
      RAISE EXCEPTION 'Checkpoints:JustificationRequired — "%" awaits your justification (configuration %)',
        cfg.title, cfg.id;
    END IF;
    UPDATE public.checkpoint_records
       SET consumed_at = clock_timestamp(), interaction_ref = p_interaction
     WHERE id = v_rec;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.checkpoint_gate(text, uuid, uuid, uuid, uuid, uuid) IS
  'The enforcement point: for each applicable configuration (type + scope + conditions with exemptions) the caller must have an unconsumed record, which the gate spends — stamping interaction_ref, the wire''s interactionRid. No record: the write refuses with the configured language. Multiple applicable configurations each demand their own record, the documented multiple-checkpoints case.';

REVOKE ALL ON FUNCTION public.checkpoint_gate(text, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;

-- ── THE PRODUCERS ────────────────────────────────────────────────────────────
-- One trigger function, dispatching on the table; branches never evaluate for
-- other tables, so per-table columns resolve safely. A path without JWT
-- claims (the login hook, beacon_runner) is a system path, not a user
-- interaction — it passes untouched.
CREATE FUNCTION public.checkpoint_producer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  CASE TG_TABLE_NAME
    WHEN 'group_members' THEN
      IF TG_OP = 'INSERT' THEN
        PERFORM public.checkpoint_gate('group_member_addition', NEW.group_id,
          p_sel_user => NEW.member_user_id, p_sel_group => NEW.member_group_id);
      ELSE
        PERFORM public.checkpoint_gate('group_member_removal', OLD.group_id,
          p_sel_user => OLD.member_user_id, p_sel_group => OLD.member_group_id);
      END IF;
    WHEN 'marking_members' THEN
      IF TG_OP = 'INSERT' THEN
        PERFORM public.checkpoint_gate('marking_member_addition', NEW.marking_id,
          p_sel_user => NEW.user_id, p_marking => NEW.marking_id);
      ELSE
        PERFORM public.checkpoint_gate('marking_member_removal', OLD.marking_id,
          p_sel_user => OLD.user_id, p_marking => OLD.marking_id);
      END IF;
    WHEN 'project_role_grants' THEN
      IF TG_OP = 'INSERT' THEN
        PERFORM public.checkpoint_gate('role_grant_addition', NEW.project_id,
          p_project => NEW.project_id, p_sel_user => NEW.user_id);
      ELSE
        PERFORM public.checkpoint_gate('role_grant_removal', OLD.project_id,
          p_project => OLD.project_id, p_sel_user => OLD.user_id);
      END IF;
    WHEN 'schedules' THEN
      IF TG_OP = 'INSERT' THEN
        PERFORM public.checkpoint_gate('schedule_create', NEW.id);
      ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.checkpoint_gate('schedule_modify', NEW.id);
      ELSE
        PERFORM public.checkpoint_gate('schedule_delete', OLD.id);
      END IF;
    WHEN 'schedule_runs' THEN
      PERFORM public.checkpoint_gate('schedule_run', NEW.schedule_id);
    WHEN 'builds' THEN
      PERFORM public.checkpoint_gate('run_build', NEW.id);
  END CASE;
  RETURN coalesce(NEW, OLD);
END $$;

COMMENT ON FUNCTION public.checkpoint_producer() IS
  'Maps a produced row to its checkpoint type and the gate''s context. BEFORE the write on purpose: an unjustified interaction never lands. The interaction reference is the produced row''s id where one exists, else the target resource''s.';

CREATE TRIGGER checkpoint_group_members BEFORE INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.checkpoint_producer();
CREATE TRIGGER checkpoint_marking_members BEFORE INSERT OR DELETE ON public.marking_members
FOR EACH ROW EXECUTE FUNCTION public.checkpoint_producer();
CREATE TRIGGER checkpoint_project_role_grants BEFORE INSERT OR DELETE ON public.project_role_grants
FOR EACH ROW EXECUTE FUNCTION public.checkpoint_producer();
CREATE TRIGGER checkpoint_schedules BEFORE INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.checkpoint_producer();
CREATE TRIGGER checkpoint_schedule_runs BEFORE INSERT ON public.schedule_runs
FOR EACH ROW EXECUTE FUNCTION public.checkpoint_producer();
CREATE TRIGGER checkpoint_builds BEFORE INSERT ON public.builds
FOR EACH ROW EXECUTE FUNCTION public.checkpoint_producer();

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_usr uuid; v_email text; v_grp uuid;
  v_cfg uuid; v_cfg2 uuid; v_rec uuid; v_target uuid;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe664') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe664') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe664', 'Probe664') RETURNING id INTO v_proj;
    v_usr := gen_random_uuid();
    v_email := 'probe664-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    v_target := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_target, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe664-target-' || v_target || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_target, 'probe664-target-' || v_target || '@beacon.test', 'admin', v_org);
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe664', 'internal') RETURNING id INTO v_grp;

    -- an org-scoped acknowledgment checkpoint on adding group members
    INSERT INTO public.checkpoint_configurations
      (organization_id, name, description, title, prompt, justification_type,
       justification_config, checkpoint_types, created_by)
    VALUES (v_org, 'Membership governance', 'Reviewer-facing why',
            'Sensitive membership change', 'Confirm this addition follows policy.',
            'acknowledgment', '{"checkbox_text": "I confirm"}',
            ARRAY['group_member_addition'], NULL)
    RETURNING id INTO v_cfg;

    -- a system path (no claims yet in this transaction) passes untouched
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_usr);
    DELETE FROM public.group_members WHERE group_id = v_grp AND member_user_id = v_usr;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);

    SET LOCAL ROLE authenticated;

    -- unjustified: the write refuses with the configured language
    BEGIN
      INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_target);
      RAISE EXCEPTION 'an unjustified addition was admitted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Checkpoints:JustificationRequired%' THEN RAISE; END IF;
    END;

    -- a wrong-typed justification refuses; the right one is accepted
    BEGIN
      PERFORM public.submit_checkpoint(v_cfg, '{"kind": "response", "response": "x"}');
      RAISE EXCEPTION 'a response satisfied an acknowledgment checkpoint';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Checkpoints:WrongJustificationType%' THEN RAISE; END IF;
    END;
    v_rec := public.submit_checkpoint(v_cfg,
      '{"kind": "acknowledgment", "acknowledged": true}',
      jsonb_build_array(jsonb_build_object('kind', 'group', 'ref_id', v_grp, 'name', 'Probe664')));

    -- the retry consumes the record and lands the row
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_target);
    IF NOT EXISTS (SELECT 1 FROM public.checkpoint_records
                    WHERE id = v_rec AND consumed_at IS NOT NULL AND interaction_ref = v_grp) THEN
      RAISE EXCEPTION 'the record was not consumed with its interaction reference';
    END IF;

    -- a second identical interaction needs a second record
    BEGIN
      INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_usr);
      RAISE EXCEPTION 'a consumed record satisfied a second interaction';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Checkpoints:JustificationRequired%' THEN RAISE; END IF;
    END;

    -- an exemption: NOT user_submitting(me) makes the config inapplicable
    INSERT INTO public.checkpoint_conditions (config_id, kind, negated, user_id)
      VALUES (v_cfg, 'user_submitting', true, v_usr);
    DELETE FROM public.group_members WHERE group_id = v_grp AND member_user_id = v_target;
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_target);

    -- one matcher of each kind: a second non-negated marking matcher refuses
    INSERT INTO public.checkpoint_conditions (config_id, kind, negated, user_id)
      VALUES (v_cfg, 'user_submitting', false, v_target);
    BEGIN
      INSERT INTO public.checkpoint_conditions (config_id, kind, negated, user_id)
        VALUES (v_cfg, 'user_submitting', false, v_usr);
      RAISE EXCEPTION 'a second matcher of one kind was admitted';
    EXCEPTION WHEN unique_violation THEN NULL; END;

    -- a space-scoped role-grant checkpoint refuses, then consumes
    INSERT INTO public.checkpoint_configurations
      (space_id, name, title, prompt, justification_type, justification_config, checkpoint_types)
    VALUES (v_sp, 'Grant governance', 'Role grant review',
            'Justify this grant.', 'response', '{"regex": "^because .+"}',
            ARRAY['role_grant_addition'])
    RETURNING id INTO v_cfg2;
    BEGIN
      INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
        VALUES (v_proj, v_target, 'viewer', v_org);
      RAISE EXCEPTION 'an unjustified grant was admitted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Checkpoints:JustificationRequired%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.submit_checkpoint(v_cfg2, '{"kind": "response", "response": "no reason"}');
      RAISE EXCEPTION 'a response failing the validation regex was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Checkpoints:ResponseRejected%' THEN RAISE; END IF;
    END;
    PERFORM public.submit_checkpoint(v_cfg2,
      '{"kind": "response", "response": "because the auditor asked"}');
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_target, 'viewer', v_org);

    RESET ROLE;
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '664 proved: an unjustified interaction refuses with the configured language, a submitted record is consumed once with its interaction reference, an exemption lifts the prompt, one matcher per kind holds, a space-scoped response checkpoint validates its regex, and a claims-less system path passes untouched';
  END;
END $$;
