-- The group type vocabulary was one value of a published three.
--
-- 481 created `groups.group_type` with `CHECK (group_type = 'internal')` — a
-- single-value vocabulary, uncited on that line. The page that LISTS the set
-- was already in the mirror when 481 was written, one bullet above the one it
-- did quote:
--
--   "**Group type:** The type of group; external, internal, or rule based.
--   Internal realm group membership is managed in Foundry."
--   — platform-security-management/manage-groups.md
--
-- Three, enumerated. `rule based` is not a loose phrase — it has its own page:
--
--   "As part of setting up an authentication provider, administrators can
--   define rule based groups. Membership to a rule based group is
--   automatically assigned based on rules evaluated at login."
--   — authentication/group-assignment.md
--
-- ── WHY THE FULL SET, WHEN NOTHING HERE PRODUCES TWO OF IT ──────────────────
-- 622 admitted only event types a writer exists for, and this looks like the
-- same question. It is not, and the difference is what the row IS. An event
-- log records history: a type nothing emits would be a false PAST. A resource
-- attribute states a vocabulary: `property_base_types()` has carried all 22
-- from the start, including `vector`, which nothing could even save until 635
-- — and that full set is what let 635 be a bug fix rather than a vocabulary
-- change. Group type is the attribute kind. The set is the page's; producers
-- for `external` (an identity provider realm) and `rule_based` (login-time
-- rule evaluation) arrive with the systems that make them, and the CHECK is
-- ready rather than in the way.
--
-- The DEFAULT stays `internal`, which is not a guess: a group created in this
-- application is managed in it, and the page's own sentence — "Internal realm
-- group membership is managed in Foundry" — is the definition of internal.
--
-- NOT BUILT, named: the `Realm` bullet beside this one ("The authentication
-- source, external or internal") is a second attribute with the same shape and
-- no consumer anywhere here; recorded rather than added, because a column
-- nothing reads or writes is the defect this week keeps finding.

ALTER TABLE public.groups DROP CONSTRAINT groups_group_type_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_group_type_check
  CHECK (group_type = ANY (ARRAY['internal', 'external', 'rule_based']));

COMMENT ON CONSTRAINT groups_group_type_check ON public.groups IS
  'Values from platform-security-management/manage-groups, which enumerates all three: "The type of group; external, internal, or rule based."';

COMMENT ON COLUMN public.groups.group_type IS
  'internal: membership managed here. external: managed by an identity provider''s realm. rule_based: assigned by rules evaluated at login (authentication/group-assignment). Only internal has a producer here; the vocabulary is the page''s full set on the property_base_types precedent.';

-- Both directions: the two new values are accepted, the default holds, and a
-- value outside the page's list is refused.
DO $$
DECLARE v_org uuid; v_err text; v_type text;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'no organization: 639 cannot prove its own vocabulary';
    END IF;

    INSERT INTO public.groups (organization_id, name, group_type)
    VALUES (v_org, 'probe-639-ext', 'external'),
           (v_org, 'probe-639-rule', 'rule_based');

    INSERT INTO public.groups (organization_id, name)
    VALUES (v_org, 'probe-639-default') RETURNING group_type INTO v_type;
    IF v_type <> 'internal' THEN
      RAISE EXCEPTION 'a group created here defaulted to %, not internal', v_type;
    END IF;

    v_err := NULL;
    BEGIN
      INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'probe-639-bad', 'imaginary');
    EXCEPTION WHEN check_violation THEN v_err := SQLERRM; END;
    IF v_err IS NULL THEN
      RAISE EXCEPTION 'a group type outside the page''s list was accepted';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '639 proved: external and rule_based accepted, internal is the default, and a fourth value is refused';
  END;
END $$;
