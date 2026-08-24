-- The realms engine: providers as config-as-data, groups answering to a
-- realm, and the two rule systems the pages run AT LOGIN. Built from the
-- authentication-and-realms reading, whose Decisions block the operator
-- approved (engine first; the rules-editor surface is its own later PR).
--
--   "Access to Foundry is managed by one or more *identity providers* that give Foundry the ability to validate users. The identity providers provide Foundry with information about users, attributes, and groups."
--   — authentication/overview.md
--
--   "Membership to a rule based group is automatically assigned based on rules evaluated at login. These rules can be configured for each authentication provider."
--   — authentication/group-assignment.md
--
--   "Users are assigned their primary Organization upon login. A user's primary Organization is determined in the Organization assignment section of the identity provider integration used to log in."
--   — authentication/org-assignment.md
--
-- ── WHAT THIS DEPLOYMENT ALREADY IS ──────────────────────────────────────────
-- GoTrue is the page's own fallback made real — "Foundry’s Platform Settings
-- come with an internal implementation of an identity provider"
-- (platform-security-management/manage-groups) — and custom_access_token_hook
-- is the login-time execution point: GoTrue calls it on every token, which is
-- where "evaluated at login" lives. The provider kind vocabulary therefore
-- admits `internal` alone: SAML and OIDC are the published integrations, but
-- a saml row with no SAML machinery would be a lie — the kinds arrive with
-- their machinery (the emit-only rule, applied to a provider kind).
--
-- ── THE RULE GRAMMAR, FROM THE PAGE AND ITS CAPTURES ─────────────────────────
--
--   "Group assignment rules contain one or more `AND` conditions that are evaluated against user attributes or provider groups. For each rule, users who match all conditions will be assigned membership to the specified rule based group. Administrators can specify `OR` conditions by defining separate assignment rules applied to the same group."
--   — authentication/group-assignment.md
--
-- Three match kinds — Includes, Does not include, Is equal to — regex all
-- three. The capture's row reads If user's [attribute] [match kind]
-- [regex] -> [group] (authentication/images/rule-based-groups-rules.png);
-- its attribute picker enumerates Provider groups plus multipass attributes.
-- Ours resolves ONE attribute today, email — the analogue of
-- multipass:email:primary, marked as ours; an unknown attribute matches
-- nothing, fail-closed. Conditions store the attribute as text so the
-- vocabulary grows with the directory, not with migrations.
--
-- Membership is SYNCED at login — assigned on match, removed on no-match —
-- an inference the reading marks (Question 1), leaning on the page's stated
-- point that rule based groups "help guarantee legibility and consistency in
-- group membership"; a stale assignment is neither. And:
--
--   "Rules *do not run retroactively* upon saving."
--   — authentication/group-assignment.md
--
-- so saving a rule touches nothing until logins happen.
--
-- ── ORGANIZATION ASSIGNMENT ──────────────────────────────────────────────────
-- Ordered, first-match, with a refusal the page states outright:
--
--   "If a user is assigned `No organization` (either via the default Organization functionality or by applying advanced rules), then they will be blocked from logging in."
--   — authentication/org-assignment.md
--
-- The hook returns GoTrue's error object rather than claims — a plain
-- RETURN, deliberately outside the hook's own fail-open exception umbrella,
-- so a refusal cannot be swallowed into a pass.
--
-- ── REALMS ───────────────────────────────────────────────────────────────────
--
--   "Groups created in Foundry are assigned to the internal realm."
--   — platform-security-management/manage-groups.md
--
-- groups.realm is a foreign key to the provider; every existing group
-- backfills to the internal realm and new groups default there by trigger. A
-- rule_based group's realm follows the provider its rules hang off. And the
-- page's one hard rule about rule_based membership gets a guard:
--
--   "Of these three group types, only rule based group membership can be defined in Foundry using the automated rules discussed here."
--   — authentication/group-assignment.md
--
-- manual membership writes on rule_based groups are refused outside the
-- evaluator; external groups' read-only membership is refused with the
-- provider that would produce them still absent — "External realms cannot
-- be modified in Foundry and exist in a read-only state"
-- (platform-security-management/manage-groups).

-- ── PROVIDERS ────────────────────────────────────────────────────────────────

CREATE TABLE public.authentication_providers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  kind                    text NOT NULL CHECK (kind = 'internal'),
  org_assignment_enabled  boolean NOT NULL DEFAULT false,
  default_organization_id uuid REFERENCES public.organizations(id),
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.authentication_providers IS
  'Identity providers as config-as-data (authentication/overview). kind admits internal alone — SAML and OIDC arrive with their machinery, never before. org_assignment_enabled turns the login-time organization rules on; a NULL default with no matching rule is the page''s "blocked from logging in".';

COMMENT ON CONSTRAINT authentication_providers_kind_check ON public.authentication_providers IS
  'internal alone, deliberately: the published integrations are SAML 2.0 and OIDC (authentication/overview), and each kind arrives with its machinery — a saml row nothing can serve would be a lie.';

CREATE INDEX authentication_providers_default_org
  ON public.authentication_providers (default_organization_id);

INSERT INTO public.authentication_providers (name, kind) VALUES ('internal', 'internal');

-- ── REALM ON GROUPS ──────────────────────────────────────────────────────────

ALTER TABLE public.groups ADD COLUMN realm uuid REFERENCES public.authentication_providers(id);
UPDATE public.groups SET realm = (SELECT id FROM public.authentication_providers WHERE kind = 'internal');
ALTER TABLE public.groups ALTER COLUMN realm SET NOT NULL;
CREATE INDEX groups_realm ON public.groups (realm);

COMMENT ON COLUMN public.groups.realm IS
  '"The authentication source, external or internal. For external groups, the realm identifies the provider that manages the group" (platform-security-management/manage-groups). Groups created in Foundry default to the internal realm; a rule_based group follows the provider its rules hang off.';

CREATE FUNCTION public.stamp_group_realm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.realm IS NULL THEN
    SELECT id INTO NEW.realm FROM public.authentication_providers WHERE kind = 'internal';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER stamp_group_realm BEFORE INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.stamp_group_realm();

-- ── THE RULES ────────────────────────────────────────────────────────────────

CREATE TABLE public.group_assignment_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.authentication_providers(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.group_assignment_rules IS
  'One rule assigns one rule_based group for one provider; a second rule to the same group is the page''s own OR encoding (authentication/group-assignment). Conditions AND in group_assignment_conditions.';

CREATE INDEX group_assignment_rules_provider ON public.group_assignment_rules (provider_id);
CREATE INDEX group_assignment_rules_group ON public.group_assignment_rules (group_id);

CREATE TABLE public.group_assignment_conditions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id    uuid NOT NULL REFERENCES public.group_assignment_rules(id) ON DELETE CASCADE,
  attribute  text NOT NULL CHECK (length(btrim(attribute)) > 0),
  match_kind text NOT NULL
             CHECK (match_kind = ANY (ARRAY['includes', 'does_not_include', 'is_equal_to'])),
  pattern    text NOT NULL CHECK (length(pattern) > 0)
);

COMMENT ON CONSTRAINT group_assignment_conditions_match_kind_check
  ON public.group_assignment_conditions IS
  'Values from authentication/group-assignment — "Includes pattern matching", "Does not include pattern matching", "Is equal to pattern matching"; regex all three.';

CREATE INDEX group_assignment_conditions_rule ON public.group_assignment_conditions (rule_id);

-- a rule only ever names a rule_based group, and pulls that group into the
-- provider's realm
CREATE FUNCTION public.guard_group_assignment_rule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_type text;
BEGIN
  SELECT g.group_type INTO v_type FROM public.groups g WHERE g.id = NEW.group_id;
  IF v_type IS DISTINCT FROM 'rule_based' THEN
    RAISE EXCEPTION 'Authentication:NotRuleBased — only rule based group membership is defined by rules';
  END IF;
  UPDATE public.groups SET realm = NEW.provider_id WHERE id = NEW.group_id;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_group_assignment_rule BEFORE INSERT OR UPDATE ON public.group_assignment_rules
FOR EACH ROW EXECUTE FUNCTION public.guard_group_assignment_rule();

CREATE TABLE public.org_assignment_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES public.authentication_providers(id) ON DELETE CASCADE,
  "position"      integer NOT NULL CHECK ("position" >= 0),
  attribute       text NOT NULL CHECK (length(btrim(attribute)) > 0),
  match_kind      text NOT NULL
                  CHECK (match_kind = ANY (ARRAY['includes', 'does_not_include', 'is_equal_to'])),
  pattern         text NOT NULL CHECK (length(pattern) > 0),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  UNIQUE (provider_id, "position")
);

COMMENT ON TABLE public.org_assignment_rules IS
  'Ordered organization assignment: applied in order at login, the first rule the user matches wins (authentication/images/advanced-user-rules.png states the order; the prose states the login-time primary assignment). Attribute conditions only for now — the prose admits internal-group conditions while recommending against them (reading, Question 3).';

COMMENT ON CONSTRAINT org_assignment_rules_match_kind_check ON public.org_assignment_rules IS
  'Values from authentication/group-assignment — the same three regex match kinds the group rules use.';

CREATE INDEX org_assignment_rules_org ON public.org_assignment_rules (organization_id);

-- ── VISIBILITY AND WRITERS ───────────────────────────────────────────────────
-- Configuration is Control Panel material: organization administrators read
-- and write; rules never gate reads for ordinary members because nothing
-- here is theirs to see.
ALTER TABLE public.authentication_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_assignment_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins see providers" ON public.authentication_providers
  FOR SELECT USING ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins see group rules" ON public.group_assignment_rules
  FOR SELECT USING ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins write group rules" ON public.group_assignment_rules
  FOR INSERT WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins remove group rules" ON public.group_assignment_rules
  FOR DELETE USING ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins see conditions" ON public.group_assignment_conditions
  FOR SELECT USING ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins write conditions" ON public.group_assignment_conditions
  FOR INSERT WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins remove conditions" ON public.group_assignment_conditions
  FOR DELETE USING ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins see org rules" ON public.org_assignment_rules
  FOR SELECT USING ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins write org rules" ON public.org_assignment_rules
  FOR INSERT WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins reorder org rules" ON public.org_assignment_rules
  FOR UPDATE USING ((SELECT public.auth_role()) IN ('owner', 'admin'))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin'));
CREATE POLICY "admins remove org rules" ON public.org_assignment_rules
  FOR DELETE USING ((SELECT public.auth_role()) IN ('owner', 'admin'));

-- ── THE EVALUATOR ────────────────────────────────────────────────────────────
CREATE FUNCTION public.login_attribute(p_user uuid, p_attribute text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  -- the internal directory's one attribute today; an unknown name resolves
  -- NULL and matches nothing, fail-closed
  SELECT CASE p_attribute
    WHEN 'email' THEN (SELECT u.email FROM public.users u WHERE u.id = p_user)
    ELSE NULL END
$$;

CREATE FUNCTION public.login_condition_matches(p_user uuid, p_attribute text,
  p_match_kind text, p_pattern text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT CASE p_match_kind
    WHEN 'includes'         THEN coalesce(public.login_attribute(p_user, p_attribute) ~ p_pattern, false)
    WHEN 'is_equal_to'      THEN coalesce(public.login_attribute(p_user, p_attribute) ~ p_pattern, false)
    WHEN 'does_not_include' THEN NOT coalesce(public.login_attribute(p_user, p_attribute) ~ p_pattern, false)
    ELSE false END
$$;

-- The Test rules panel's contract, and the probe's instrument: which rules
-- match, which groups follow — writing nothing.
CREATE FUNCTION public.test_group_assignment(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'rule', r.id, 'group', g.name, 'matched', m.matched) ORDER BY g.name), '[]'::jsonb)
  FROM public.group_assignment_rules r
  JOIN public.groups g ON g.id = r.group_id
  CROSS JOIN LATERAL (
    SELECT bool_and(public.login_condition_matches(p_user, c.attribute, c.match_kind, c.pattern))
           AS matched
      FROM public.group_assignment_conditions c WHERE c.rule_id = r.id) m
$$;

COMMENT ON FUNCTION public.test_group_assignment(uuid) IS
  'The Test rules panel''s contract (authentication/images/rule-based-group-testing.png): simulate a user against the configured rules and answer with matches, writing nothing.';

-- Runs at login. Returns false only for the page's refusal: organization
-- rules configured, nothing matched, no default.
CREATE FUNCTION public.apply_login_assignments(p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_provider record; g record; v_org uuid;
BEGIN
  SELECT * INTO v_provider FROM public.authentication_providers
   WHERE kind = 'internal' LIMIT 1;
  IF v_provider.id IS NULL THEN RETURN true; END IF;

  -- sync this provider's rule_based groups: assign on match, remove on
  -- no-match. The evaluator is the one legal writer; the guard below knows
  -- it by this setting.
  PERFORM set_config('beacon.login_assignment', 'on', true);
  FOR g IN
    SELECT gr.id AS group_id,
           bool_or(coalesce(m.matched, false)) AS matched
      FROM public.groups gr
      LEFT JOIN public.group_assignment_rules r
        ON r.group_id = gr.id AND r.provider_id = v_provider.id
      LEFT JOIN LATERAL (
        SELECT bool_and(public.login_condition_matches(p_user, c.attribute, c.match_kind, c.pattern))
               AS matched
          FROM public.group_assignment_conditions c WHERE c.rule_id = r.id) m ON true
     WHERE gr.group_type = 'rule_based' AND gr.realm = v_provider.id
     GROUP BY gr.id
  LOOP
    IF g.matched THEN
      INSERT INTO public.group_members (group_id, member_user_id)
      VALUES (g.group_id, p_user)
      ON CONFLICT (group_id, member_user_id) DO NOTHING;
    ELSE
      DELETE FROM public.group_members
       WHERE group_id = g.group_id AND member_user_id = p_user;
    END IF;
  END LOOP;
  PERFORM set_config('beacon.login_assignment', '', true);

  -- the primary organization: in order, first match wins; else the default;
  -- else the refusal
  IF v_provider.org_assignment_enabled THEN
    SELECT r.organization_id INTO v_org
      FROM public.org_assignment_rules r
     WHERE r.provider_id = v_provider.id
       AND public.login_condition_matches(p_user, r.attribute, r.match_kind, r.pattern)
     ORDER BY r."position" LIMIT 1;
    v_org := coalesce(v_org, v_provider.default_organization_id);
    IF v_org IS NULL THEN RETURN false; END IF;
    UPDATE public.users SET organization_id = v_org
     WHERE id = p_user AND organization_id IS DISTINCT FROM v_org;
  END IF;
  RETURN true;
END $$;

COMMENT ON FUNCTION public.apply_login_assignments(uuid) IS
  'Evaluated at login, from custom_access_token_hook: syncs the internal provider''s rule_based memberships and assigns the primary organization in rule order. false is the page''s refusal — no matching rule, no default — which the hook turns into a blocked login.';

REVOKE ALL ON FUNCTION public.apply_login_assignments(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.login_attribute(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.login_condition_matches(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.test_group_assignment(uuid) FROM PUBLIC, anon;

-- rule_based membership belongs to the evaluator; external is read-only with
-- its producer still absent
CREATE FUNCTION public.guard_group_membership_realm() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_type text; v_gid uuid;
BEGIN
  v_gid := CASE WHEN TG_OP = 'DELETE' THEN OLD.group_id ELSE NEW.group_id END;
  SELECT g.group_type INTO v_type FROM public.groups g WHERE g.id = v_gid;
  IF v_type = 'rule_based'
     AND coalesce(current_setting('beacon.login_assignment', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Authentication:RuleBasedMembership — membership to a rule based group is automatically assigned based on rules evaluated at login';
  END IF;
  IF v_type = 'external' THEN
    RAISE EXCEPTION 'Authentication:ExternalRealmReadOnly — external realms cannot be modified in Foundry and exist in a read-only state';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER guard_group_membership_realm
BEFORE INSERT OR UPDATE OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.guard_group_membership_realm();

-- ── THE HOOK LEARNS TO EVALUATE ──────────────────────────────────────────────
-- Patch the live definition, never retype it: one anchor, and the refusal is
-- a plain RETURN so the hook's own fail-open umbrella cannot swallow it.
DO $$
DECLARE src text; anchor text; replacement text;
BEGIN
  src := pg_get_functiondef('public.custom_access_token_hook(jsonb)'::regprocedure);
  anchor := '  IF NOT FOUND THEN
    RETURN event;
  END IF;';
  IF position(anchor in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: custom_access_token_hook is not the text 654 read';
  END IF;
  replacement := '  IF NOT FOUND THEN
    RETURN event;
  END IF;

  -- rules evaluated at login (654): sync rule_based membership and assign
  -- the primary organization; false is "blocked from logging in"
  IF NOT public.apply_login_assignments((event->>''user_id'')::uuid) THEN
    RETURN jsonb_build_object(''error'', jsonb_build_object(
      ''http_code'', 403,
      ''message'', ''No organization — assignment rules matched nothing and no default is set''));
  END IF;
  SELECT organization_id, role INTO u
    FROM public.users WHERE id = (event->>''user_id'')::uuid;';
  src := replace(src, anchor, replacement);
  EXECUTE src;
END $$;

-- ── PROVED BY DOING: a login, both rule systems, both directions ─────────────
DO $$
DECLARE
  v_org uuid; v_org2 uuid; v_sp uuid; v_admin uuid; v_usr uuid; v_email text;
  v_grp uuid; v_rule uuid; v_provider uuid; v_x jsonb; v_ok boolean; v_n int;
  v_event jsonb;
BEGIN
  BEGIN
    SELECT id INTO v_provider FROM public.authentication_providers WHERE kind = 'internal';
    INSERT INTO public.organizations (name) VALUES ('probe654') RETURNING id INTO v_org;
    INSERT INTO public.organizations (name) VALUES ('probe654b') RETURNING id INTO v_org2;
    INSERT INTO public.spaces (name) VALUES ('probe654') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    v_admin := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe654-admin-' || v_admin || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_admin, 'probe654-admin-' || v_admin || '@beacon.test', 'admin', v_org);
    v_usr := gen_random_uuid();
    v_email := 'probe654-' || v_usr || '@example.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- a rule_based group whose rule matches @example.test emails
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe654 engineering', 'rule_based') RETURNING id INTO v_grp;
    INSERT INTO public.group_assignment_rules (provider_id, group_id)
      VALUES (v_provider, v_grp) RETURNING id INTO v_rule;
    INSERT INTO public.group_assignment_conditions (rule_id, attribute, match_kind, pattern)
      VALUES (v_rule, 'email', 'includes', '@example\.test$');

    -- the rule pulled the group into the provider's realm
    IF (SELECT realm FROM public.groups WHERE id = v_grp) <> v_provider THEN
      RAISE EXCEPTION 'the rule did not set the group''s realm';
    END IF;

    -- saving rules ran nothing: no membership yet
    IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_grp) THEN
      RAISE EXCEPTION 'a rule assigned membership without a login';
    END IF;

    -- manual membership on a rule_based group refuses
    v_ok := false;
    BEGIN
      INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_usr);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%RuleBasedMembership%' THEN v_ok := true; ELSE RAISE; END IF;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'manual rule_based membership was accepted'; END IF;

    -- the test panel's contract, before any login
    v_x := public.test_group_assignment(v_usr);
    IF (v_x -> 0 ->> 'matched')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'the test did not match the matching user: %', v_x;
    END IF;
    IF (public.test_group_assignment(v_admin) -> 0 ->> 'matched')::boolean IS NOT FALSE THEN
      RAISE EXCEPTION 'the test matched a non-matching user';
    END IF;

    -- a login: the hook's own path, called as GoTrue calls it
    v_event := public.custom_access_token_hook(jsonb_build_object(
      'user_id', v_usr::text, 'claims', '{}'::jsonb));
    IF v_event ? 'error' THEN
      RAISE EXCEPTION 'a plain login was refused: %', v_event;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.group_members
                    WHERE group_id = v_grp AND member_user_id = v_usr) THEN
      RAISE EXCEPTION 'login did not assign the matching rule_based membership';
    END IF;

    -- the sync removes what no longer matches: break the rule, log in again
    UPDATE public.group_assignment_conditions
       SET pattern = '@nowhere\.test$' WHERE rule_id = v_rule;
    PERFORM public.custom_access_token_hook(jsonb_build_object(
      'user_id', v_usr::text, 'claims', '{}'::jsonb));
    IF EXISTS (SELECT 1 FROM public.group_members
                WHERE group_id = v_grp AND member_user_id = v_usr) THEN
      RAISE EXCEPTION 'login did not remove the no-longer-matching membership';
    END IF;

    -- organization assignment: first match wins, and the claims carry it
    UPDATE public.authentication_providers
       SET org_assignment_enabled = true WHERE id = v_provider;
    INSERT INTO public.org_assignment_rules
      (provider_id, "position", attribute, match_kind, pattern, organization_id)
    VALUES (v_provider, 0, 'email', 'includes', '@example\.test$', v_org2),
           (v_provider, 1, 'email', 'includes', '.', v_org);
    v_event := public.custom_access_token_hook(jsonb_build_object(
      'user_id', v_usr::text, 'claims', '{}'::jsonb));
    IF v_event -> 'claims' -> 'app_metadata' ->> 'org_id' <> v_org2::text THEN
      RAISE EXCEPTION 'the first matching org rule did not win: %',
        v_event -> 'claims' -> 'app_metadata';
    END IF;
    IF (SELECT organization_id FROM public.users WHERE id = v_usr) <> v_org2 THEN
      RAISE EXCEPTION 'the assignment did not reach the user row';
    END IF;

    -- the refusal: no matching rule, no default — blocked from logging in
    DELETE FROM public.org_assignment_rules WHERE provider_id = v_provider;
    INSERT INTO public.org_assignment_rules
      (provider_id, "position", attribute, match_kind, pattern, organization_id)
    VALUES (v_provider, 0, 'email', 'includes', '@matches-nobody\.test$', v_org);
    v_event := public.custom_access_token_hook(jsonb_build_object(
      'user_id', v_usr::text, 'claims', '{}'::jsonb));
    IF NOT (v_event ? 'error') THEN
      RAISE EXCEPTION 'no rule and no default did not block the login: %', v_event;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '654 proved: rules ran only at login, membership synced both ways, manual rule_based writes refused, the test panel answered without writing, the first org rule won and reached the claims, and no-match-no-default blocked the login';
  END;
END $$;
