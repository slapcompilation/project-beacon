-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 333 — an operator can define an action type. Closing the last
-- "deliberate divergence", which turned out not to be one.
--
-- ONTOLOGY-PARITY-GAPS listed user-authored action types under *deliberate
-- divergences — not gaps*, on this reasoning: "CLAUDE.md deliberately keeps
-- BeaconAction typed in code so every write has compile-time guarantees,
-- submission criteria and an audit entry."
--
-- THAT REASONING DOES NOT HOLD, and reading Foundry's own pages is what settles
-- it. CLAUDE.md requires four things of every action, and all four are Foundry's,
-- and all four are FIELDS ON A DEFINITION rather than properties of the language
-- it is written in:
--
--   submission criteria  "the conditions that determine whether an action can be
--                         submitted"                    (submission-criteria)
--   side effects         notifications, webhooks        (side-effects-overview)
--   audit entry          "action log object types map ONE-TO-ONE with action
--                         types. Submitting an action generates a single new
--                         object of the corresponding action log object type"
--                                                       (action-log)
--   invocation mode      "change the default on-click behavior from opening the
--                         form to applying the action immediately using the
--                         default values (if valid)"    (use-actions)
--
-- Foundry authors action types in Ontology Manager and keeps all four. The only
-- thing our hand-written union buys that data does not is compile-time
-- exhaustiveness — and CLAUDE.md's argument against generated types is expressly
-- about a LANGUAGE BOUNDARY ("Foundry needs generated SDKs to get that across a
-- language boundary"), which does not exist inside one TypeScript codebase.
--
-- AND WE HAVE BUILT THIS TWICE ALREADY. user_tools and user_agents are authored,
-- stored as data, validated against a typed grammar, and composed with the
-- code-defined ones through a wrapper — with a shipped artifact always winning a
-- name collision. This is the third instance of that pattern, not a new risk.
--
-- WHAT AN AUTHORED ACTION MAY TOUCH, and this is the boundary that keeps it
-- safe: object_records and object_links — the half of the ontology that is
-- already data. Foundry's own scope is the same, "changes or edits to objects,
-- property values, and links". A code-defined BeaconAction stays the only way to
-- write stock_logs, purchase_orders and the rest, because those carry
-- compensating-transaction semantics an authored form cannot express.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_action_types (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id           uuid REFERENCES hotels(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (length(btrim(name)) > 0),
  api_name           text NOT NULL CHECK (api_name ~ '^[A-Z][A-Z0-9_]*$'),
  description        text NOT NULL DEFAULT '',

  -- What it edits. Authored types only — object_records is the data half.
  subject_type_id    uuid NOT NULL REFERENCES object_types(id) ON DELETE CASCADE,
  -- Foundry: "a set of changes or edits to objects, property values, and links".
  operation          text NOT NULL CHECK (operation IN ('create', 'modify', 'delete')),

  -- The typed grammar, same shape as user_tools.parameters:
  -- [{ key, label, type: text|number|boolean|date, required }]
  parameters         jsonb NOT NULL DEFAULT '[]'::jsonb
                       CHECK (jsonb_typeof(parameters) = 'array'),
  -- "Conditions are single statements governing the values of parameters or user
  -- properties. Operators are used to combine and nest different conditions."
  -- [{ parameter, operator, value }] — all must pass, which is Foundry's rule:
  -- "Actions can only be submitted if all the submission criteria are met."
  submission_criteria jsonb NOT NULL DEFAULT '[]'::jsonb
                       CHECK (jsonb_typeof(submission_criteria) = 'array'),

  invocation_mode    text NOT NULL DEFAULT 'open-form'
                       CHECK (invocation_mode IN ('open-form', 'apply-immediately')),
  approval_tier      text NOT NULL DEFAULT 'self'
                       CHECK (approval_tier IN ('self', 'hotel-admin', 'org-director')),

  enabled            boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

COMMENT ON TABLE public.user_action_types IS
  'Operator-defined action types over authored object records. Parameters, submission criteria, invocation mode and approval tier are required by this table — the same four things CLAUDE.md requires of a code-defined BeaconAction.';

-- Foundry's action log: "action log object types map one-to-one with action
-- types. Submitting an action generates a single new object... automatically
-- linked to all objects edited by the submitted action."
CREATE TABLE IF NOT EXISTS public.user_action_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL DEFAULT auth_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  hotel_id            uuid REFERENCES hotels(id) ON DELETE CASCADE,
  action_type_id      uuid NOT NULL REFERENCES user_action_types(id) ON DELETE RESTRICT,
  -- The record it edited. NULL only for a create that then failed, which the
  -- writer never commits — so in practice this is always populated.
  record_id           uuid REFERENCES object_records(id) ON DELETE SET NULL,
  operation           text NOT NULL CHECK (operation IN ('create', 'modify', 'delete')),
  /** The parameter values as submitted. The decision, not just the diff. */
  parameters          jsonb NOT NULL DEFAULT '{}'::jsonb,
  /** Property values before the edit, for a modify or delete. */
  previous            jsonb,
  triggered_by        text NOT NULL DEFAULT 'user'
                        CHECK (triggered_by IN ('user', 'ai_proposal_accepted', 'ai_auto_approved', 'automation_threshold')),
  actor_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_action_log IS
  'One row per authored-action submission — Foundry''s action log, one-to-one with action types. Append-only: the audit entry is what makes an authored action as accountable as a code-defined one.';

CREATE INDEX IF NOT EXISTS idx_user_action_log_type ON public.user_action_log (action_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_action_log_record ON public.user_action_log (record_id);

-- Immutable, like every other audit trail here. A correction is another row.
CREATE OR REPLACE FUNCTION public.refuse_action_log_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION
    'Actions:AuditIsImmutable the action log is append-only. Submit a compensating action instead of editing %.', OLD.id;
END $$;

DROP TRIGGER IF EXISTS trg_action_log_immutable ON public.user_action_log;
CREATE TRIGGER trg_action_log_immutable
  BEFORE UPDATE OR DELETE ON public.user_action_log
  FOR EACH ROW EXECUTE FUNCTION public.refuse_action_log_edit();

-- ── A shipped action always wins the name ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.refuse_shipped_action_name()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE shipped text[] := ARRAY[
  'ADJUST_STOCK', 'REQUEST_RESTOCK', 'WRITE_OFF', 'APPROVE_RESTOCK', 'REJECT_RESTOCK',
  'REVERT_ACTION', 'TRANSFER_STOCK', 'APPROVE_TRANSFER', 'RECEIVE_STOCK',
  'CREATE_SUPPLIER', 'CREATE_PURCHASE_ORDER', 'SUBMIT_INVOICE'
];
BEGIN
  -- Same rule as authored tools: an organization must not be able to redefine
  -- what ADJUST_STOCK means. The collision is refused at authoring time so it
  -- surfaces instead of silently losing at dispatch.
  IF NEW.api_name = ANY (shipped) THEN
    RAISE EXCEPTION
      'Actions:NameIsShipped "%" is a code-defined action. Pick another name — a shipped action always wins.',
      NEW.api_name;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_action_name_not_shipped ON public.user_action_types;
CREATE TRIGGER trg_action_name_not_shipped
  BEFORE INSERT OR UPDATE OF api_name ON public.user_action_types
  FOR EACH ROW EXECUTE FUNCTION public.refuse_shipped_action_name();

-- ── An authored action only edits authored records ──────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_authored_action_subject()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE k text;
BEGIN
  SELECT kind INTO k FROM object_types WHERE id = NEW.subject_type_id;
  IF k <> 'authored' THEN
    RAISE EXCEPTION
      'Actions:SubjectIsCodeOwned "%" is a built-in object type. An authored action edits object_records; writing a code-owned table needs a code-defined BeaconAction, which carries the compensating-transaction semantics a form cannot express.',
      (SELECT api_name FROM object_types WHERE id = NEW.subject_type_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_authored_action_subject ON public.user_action_types;
CREATE TRIGGER trg_authored_action_subject
  BEFORE INSERT OR UPDATE OF subject_type_id ON public.user_action_types
  FOR EACH ROW EXECUTE FUNCTION public.enforce_authored_action_subject();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_action_log   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read authored actions" ON public.user_action_types;
CREATE POLICY "members read authored actions" ON public.user_action_types
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "admins author actions" ON public.user_action_types;
CREATE POLICY "admins author actions" ON public.user_action_types
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner', 'admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner', 'admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "members read the action log" ON public.user_action_log;
CREATE POLICY "members read the action log" ON public.user_action_log
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

-- Any member may submit — the approval tier and submission criteria are what
-- gate it, not the table. That is Foundry's split: "This is independent from the
-- permissions that govern whether a user can edit the action type itself."
DROP POLICY IF EXISTS "members submit authored actions" ON public.user_action_log;
CREATE POLICY "members submit authored actions" ON public.user_action_log
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT DISTINCT FROM auth_org_id()
              AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table', 'user_action_types', 'platform', 'Operator-defined action types over authored records. The third authored artifact, after tools and agents.'),
  ('table', 'user_action_log', 'platform', 'Foundry''s action log — one append-only row per authored-action submission.')
ON CONFLICT (object_kind, object_name) DO UPDATE SET reason = EXCLUDED.reason;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_user uuid; v_authored uuid; v_builtin uuid; v_at uuid; v_rec uuid; v_log uuid;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT created_by_user_id INTO v_user FROM object_types WHERE organization_id = v_org LIMIT 1;
  SELECT id INTO v_builtin FROM object_types WHERE organization_id = v_org AND kind = 'builtin' LIMIT 1;

  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id, properties)
    VALUES (v_org, 'probe_ticket', 'Probe Ticket', v_user,
            '[{"key":"status","label":"Status","type":"text","required":false}]'::jsonb)
    RETURNING id INTO v_authored;

    INSERT INTO user_action_types (organization_id, name, api_name, subject_type_id, operation,
                                   parameters, created_by_user_id)
    VALUES (v_org, 'Close ticket', 'CLOSE_TICKET', v_authored, 'modify',
            '[{"key":"status","label":"Status","type":"text","required":true}]'::jsonb, v_user)
    RETURNING id INTO v_at;

    -- A shipped name is refused at authoring time.
    BEGIN
      INSERT INTO user_action_types (organization_id, name, api_name, subject_type_id, operation, created_by_user_id)
      VALUES (v_org, 'Sneaky', 'ADJUST_STOCK', v_authored, 'modify', v_user);
      RAISE EXCEPTION 'Migration 333: an authored action took a shipped name';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Actions:NameIsShipped%' THEN RAISE; END IF;
    END;

    -- A code-owned object type is not an authored action's business.
    IF v_builtin IS NOT NULL THEN
      BEGIN
        INSERT INTO user_action_types (organization_id, name, api_name, subject_type_id, operation, created_by_user_id)
        VALUES (v_org, 'Reach too far', 'EDIT_BUILTIN', v_builtin, 'modify', v_user);
        RAISE EXCEPTION 'Migration 333: an authored action targeted a built-in type';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM NOT LIKE 'Actions:SubjectIsCodeOwned%' THEN RAISE; END IF;
      END;
    END IF;

    -- A submission writes exactly one log row, and it cannot be edited after.
    INSERT INTO object_records (object_type_id, organization_id, title, created_by_user_id)
    VALUES (v_authored, v_org, 'Probe record', v_user) RETURNING id INTO v_rec;
    INSERT INTO user_action_log (organization_id, action_type_id, record_id, operation, parameters, actor_user_id)
    VALUES (v_org, v_at, v_rec, 'modify', '{"status":"closed"}'::jsonb, v_user) RETURNING id INTO v_log;

    BEGIN
      UPDATE user_action_log SET parameters = '{"status":"open"}'::jsonb WHERE id = v_log;
      RAISE EXCEPTION 'Migration 333: the action log was edited';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Actions:AuditIsImmutable%' THEN RAISE; END IF;
    END;

    BEGIN
      DELETE FROM user_action_log WHERE id = v_log;
      RAISE EXCEPTION 'Migration 333: the action log was deleted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Actions:AuditIsImmutable%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
