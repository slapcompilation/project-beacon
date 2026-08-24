-- The api/ audit pass over the realms engine, the day after it shipped. The
-- admin API publishes the wire shapes 654 built from prose and captures, and
-- two corrections follow.
--
-- ── THE REALM HAS A PUBLISHED IDENTIFIER ─────────────────────────────────────
--
--   "Identifies which Realm a User or Group is a member of. The `palantir-internal-realm` is used for Users or Groups that are created in Foundry by administrators and not associated with any SSO provider."
--   — api/admin-v2-resources-authentication-providers-get-authentication-provider.md
--
-- 654 named our internal provider 'internal' — an invented spelling where a
-- published wire constant exists. The realm identifier is vocabulary, not
-- trademark (the same rule that keeps `multipass:email:primary` and the
-- camelCase audit categories verbatim), so the provider row gains a `realm`
-- column holding the published constant.
--
-- ── USERS CARRY A REALM TOO ──────────────────────────────────────────────────
-- The User wire shape carries `realm` as a required field, and usernames are
-- unique WITHIN it:
--
--   "The Foundry username of the User. This is unique within the realm."
--   — api/admin-v2-resources-users-get-user.md
--
-- users.realm arrives as the same FK groups got in 654, backfilled to the
-- internal provider and stamped by trigger.
--
-- ── AND THE AUDIT LINE FINALLY NAMES IT ──────────────────────────────────────
-- The audit.3 ContextualizedUser declares a realm field that Foundry's own
-- pipeline leaves empty for a stated reason that does not apply here:
-- "Populating these fields would require real-time lookups against the
-- identity provider, which is incompatible with the low-latency design of
-- the `audit.3` pipeline" (security/audit-logs-overview) — our identity
-- provider IS the same database, so the lookup is a join. A scoped
-- divergence: we populate realm inside the declared schema; their omission
-- is a latency artifact, not a contract.
--
-- Recorded, not built (the reading's residuals grow by three): the
-- user/group `attributes` map ("Additional attributes may be configured by
-- Foundry administrators in Control Panel and populated by the User's SSO
-- provider upon login" — the general store our conditions' one attribute
-- foreshadows), the Group wire shape's `organizations` LIST ("At least one
-- Organization RID must be listed" — multi-organization group visibility,
-- a policy refactor of its own), and the User `status` enum (ACTIVE,
-- DELETED).

ALTER TABLE public.authentication_providers ADD COLUMN realm text UNIQUE
  CHECK (realm ~ '^[a-z0-9-]+$');
UPDATE public.authentication_providers SET realm = 'palantir-internal-realm'
 WHERE kind = 'internal';
ALTER TABLE public.authentication_providers ALTER COLUMN realm SET NOT NULL;

COMMENT ON COLUMN public.authentication_providers.realm IS
  'The wire identifier of this provider''s realm (api/admin-v2-resources): palantir-internal-realm is the published constant for users and groups created in the platform itself, copied verbatim as wire vocabulary.';

ALTER TABLE public.users ADD COLUMN realm uuid REFERENCES public.authentication_providers(id);
UPDATE public.users SET realm = (SELECT id FROM public.authentication_providers WHERE kind = 'internal');
ALTER TABLE public.users ALTER COLUMN realm SET NOT NULL;
CREATE INDEX users_realm ON public.users (realm);

COMMENT ON COLUMN public.users.realm IS
  'Which provider this user authenticates through — required on the User wire shape, and usernames are "unique within the realm" (api/admin-v2-resources). Everyone here is the internal realm until an external provider exists.';

-- the stamp function is generic over any table with a realm column
CREATE TRIGGER stamp_user_realm BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.stamp_group_realm();

-- The emitter's ContextualizedUser gains its realm. Patch the live
-- definition, never retype it: one anchor, one refusal.
DO $$
DECLARE src text; anchor text;
BEGIN
  src := pg_get_functiondef('public.record_audit_event(text,text[],text,jsonb,jsonb,jsonb)'::regprocedure);
  anchor := 'ELSE jsonb_build_array(jsonb_build_object(''uid'', v_uid)) END,';
  IF position(anchor in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: record_audit_event is not the text 656 read';
  END IF;
  src := replace(src, anchor,
    'ELSE jsonb_build_array(jsonb_build_object(''uid'', v_uid,
            ''realm'', (SELECT p.realm FROM public.authentication_providers p
                         JOIN public.users uu ON uu.realm = p.id
                        WHERE uu.id = v_uid))) END,');
  EXECUTE src;
END $$;

-- Proved by doing: a new user lands in the internal realm without asking,
-- and a producer's audit line names it.
DO $$
DECLARE
  v_org uuid; v_usr uuid; v_email text; v_grp uuid; v_line jsonb;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe656') RETURNING id INTO v_org;
    v_usr := gen_random_uuid();
    v_email := 'probe656-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);

    IF (SELECT p.realm FROM public.users u
          JOIN public.authentication_providers p ON p.id = u.realm
         WHERE u.id = v_usr) <> 'palantir-internal-realm' THEN
      RAISE EXCEPTION 'a new user did not land in the internal realm';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.groups (organization_id, name, group_type)
      VALUES (v_org, 'Probe656', 'internal') RETURNING id INTO v_grp;
    INSERT INTO public.group_members (group_id, member_user_id) VALUES (v_grp, v_usr);

    SELECT e.users -> 0 INTO v_line FROM public.audit_events e
     WHERE e.org_id = v_org AND e.name = 'BEACON_GROUP_MEMBERS_INSERT';
    IF v_line ->> 'uid' IS DISTINCT FROM v_usr::text
       OR v_line ->> 'realm' IS DISTINCT FROM 'palantir-internal-realm' THEN
      RAISE EXCEPTION 'the audit line does not name the caller''s realm: %', v_line;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '656 proved: the published realm constant holds, a new user lands in the internal realm unasked, and the audit line names it';
  END;
END $$;
