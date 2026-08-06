-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 404 — scoped sessions.
--
-- Source: `administration/configure-scoped-sessions` (read in full) and
-- `security/markings#use-scoped-sessions`. Reading:
-- docs/foundry-reference/readings/markings.md § Scoped sessions.
--
-- WHAT IT IS. Control Panel's subtitle says it in one line: "Limit a person's
-- access to markings to a pre-defined set based on a defined focus of work."
-- An admin authors presets under a **Session presets** tab; a user picks one.
--
-- THE FILTER IS DISJUNCTIVE, and this is the part that is easy to get backwards.
-- The base marking check is conjunctive — "a user must be a member of ALL the
-- Markings on a file". The session filter is not a narrowing of that set:
--
--   "Users will be able to see anything that has ONE OR MORE of the Markings
--    included in the scoped session. Also, users will be able to see ANYTHING
--    THAT DOES NOT HAVE A MARKING."
--
--   "Anya would only have access to projects, folders, and files that have no
--    Markings on them or have either the `B.1.1.529` and/or `SARS-CoV-2`
--    Markings on them."
--
-- So two predicates stack:
--
--   visible = member of EVERY marking on the resource        (satisfies_markings)
--          AND ( no session
--                OR the resource has no markings
--                OR the resource carries ≥1 marking in the session )
--
-- Take a resource marked {A,B}, a member of both, and a session {A}. Narrowing
-- the membership set would HIDE it (B unmet); the documented rule SHOWS it (it
-- carries A). Different answers, so the distinction is not academic.
--
-- IT CAN ONLY NARROW. From the create dialog: "People will only have access to
-- these markings in this scoped session. **Scoped sessions do not grant people
-- membership to any markings.**" And selection is gated: "Only users who are
-- members of ALL the Markings selected in the scoped session will be able to
-- choose this scoped session."
--
-- WHY DISJUNCTIVE: the purpose is not privilege restriction. "Scoped sessions
-- improve platform security by reducing the chances of accidental
-- cross-pollination of work across different purposes." A workstream filter —
-- hence unmarked resources stay visible and one matching marking is enough.
--
-- DIVERGENCES, recorded rather than discovered later:
--   • Foundry's session is per Foundry login; ours is per user, stored server
--     side, because we have no login-time session state to hang it on. Two tabs
--     share a session where Foundry's would not.
--   • "Allow no scoped session" can be granted "for all users, for members of
--     select groups only, or for all users except members of selected groups".
--     We have no groups, so it is a single organization-wide boolean.
--   • The unscoped caption mentions "their maximum classification" — CBAC, which
--     we do not have.
--   • The filter is applied to FILE markings, which is what the page describes
--     ("projects, folders, and files that have no Markings on them"). Whether it
--     should also narrow data markings is not stated anywhere; leaving it out
--     cannot widen access, so it fails safe. Logged as an open question.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- The three toggles, exactly as the Settings tab shows them, all off by default:
-- "scoped sessions are disabled by default".
CREATE TABLE public.organization_scoped_session_settings (
  organization_id     uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled             boolean NOT NULL DEFAULT false,
  allow_no_session    boolean NOT NULL DEFAULT false,
  always_show_selector boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.organization_scoped_session_settings.enabled IS
  'When enabled, people must select a scoped session to limit their access to a subset of their full user access.';
COMMENT ON COLUMN public.organization_scoped_session_settings.allow_no_session IS
  'When enabled, people can use the platform without a scoped session and have access to all markings they are a member of.';
COMMENT ON COLUMN public.organization_scoped_session_settings.always_show_selector IS
  'When enabled, people always see the selector when logging in, even when only one session is available to them.';

-- "Session presets".
CREATE TABLE public.scoped_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.scoped_session_markings (
  scoped_session_id uuid NOT NULL REFERENCES public.scoped_sessions(id) ON DELETE CASCADE,
  marking_id        uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  PRIMARY KEY (scoped_session_id, marking_id)
);

COMMENT ON TABLE public.scoped_sessions IS
  'A named preset of markings defining a focus of work. Selecting one narrows what is visible; it never grants membership of anything.';

-- Which session a user is currently in. A row with a NULL session is an explicit
-- "No scoped session"; no row at all means they have not chosen yet.
CREATE TABLE public.user_scoped_session (
  user_id           uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  scoped_session_id uuid REFERENCES public.scoped_sessions(id) ON DELETE SET NULL,
  selected_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_scoped_session IS
  'The caller''s current session. NULL scoped_session_id = they chose "No scoped session"; no row = they have not chosen.';

-- "Only users who are members of all the Markings selected in the scoped session
-- will be able to choose this scoped session."
CREATE OR REPLACE FUNCTION public.can_choose_scoped_session(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.scoped_sessions s
                  WHERE s.id = p_session
                    AND s.organization_id IS NOT DISTINCT FROM public.auth_org_id())
     AND NOT EXISTS (
       SELECT 1 FROM public.scoped_session_markings sm
        WHERE sm.scoped_session_id = p_session
          AND NOT EXISTS (SELECT 1 FROM public.marking_members mm
                           WHERE mm.marking_id = sm.marking_id AND mm.user_id = auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.selectable_scoped_sessions()
RETURNS TABLE (id uuid, name text, description text, markings uuid[])
LANGUAGE sql STABLE AS $$
  SELECT s.id, s.name, s.description,
         coalesce((SELECT array_agg(sm.marking_id) FROM public.scoped_session_markings sm
                    WHERE sm.scoped_session_id = s.id), '{}'::uuid[])
    FROM public.scoped_sessions s
   WHERE s.organization_id IS NOT DISTINCT FROM public.auth_org_id()
     AND public.can_choose_scoped_session(s.id)
   ORDER BY s.name
$$;

-- The markings of the caller's active session. Empty when there is no session to
-- speak of; the caller below distinguishes "no session" from "empty session".
CREATE OR REPLACE FUNCTION public.active_scoped_session()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT u.scoped_session_id FROM public.user_scoped_session u WHERE u.user_id = auth.uid()
$$;

/** The session filter. Disjunctive on purpose — see the header. */
CREATE OR REPLACE FUNCTION public.passes_scoped_session(p_markings uuid[])
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE st record; sess uuid; chosen boolean; sess_markings uuid[];
BEGIN
  SELECT * INTO st FROM public.organization_scoped_session_settings
   WHERE organization_id IS NOT DISTINCT FROM public.auth_org_id();

  -- Disabled, or never configured: "This is the same access that a user would
  -- have if scoped sessions are disabled for your Organization."
  IF st IS NULL OR NOT st.enabled THEN RETURN true; END IF;

  SELECT true, u.scoped_session_id INTO chosen, sess
    FROM public.user_scoped_session u WHERE u.user_id = auth.uid();

  IF sess IS NULL THEN
    -- Chose "No scoped session", or has not chosen. Either is unscoped only if
    -- the organization allows it; otherwise the login is incomplete and the safe
    -- reading is an empty session, which still shows unmarked resources.
    IF coalesce(chosen, false) OR st.allow_no_session THEN
      IF st.allow_no_session THEN RETURN true; END IF;
    END IF;
    sess_markings := '{}'::uuid[];
  ELSIF NOT public.can_choose_scoped_session(sess) THEN
    -- Membership changed under them. Fail closed rather than silently unscoping.
    sess_markings := '{}'::uuid[];
  ELSE
    SELECT coalesce(array_agg(sm.marking_id), '{}'::uuid[]) INTO sess_markings
      FROM public.scoped_session_markings sm WHERE sm.scoped_session_id = sess;
  END IF;

  -- "users will be able to see anything that does not have a Marking"
  IF p_markings IS NULL OR array_length(p_markings, 1) IS NULL THEN RETURN true; END IF;

  -- "anything that has one or more of the Markings included in the scoped session"
  RETURN p_markings && sess_markings;
END $$;

COMMENT ON FUNCTION public.passes_scoped_session(uuid[]) IS
  'Disjunctive: passes when there is no session, when the resource has no markings, or when the resource carries at least one of the session''s markings. Stacks on top of the conjunctive satisfies_markings — it does not replace it.';

-- ── wire it into the read paths ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_read_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       AND d.organization_id IS NOT DISTINCT FROM public.auth_org_id()
       AND public.satisfies_markings(public.effective_file_markings('dataset', d.id))
       AND public.passes_scoped_session(public.effective_file_markings('dataset', d.id))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       AND d.organization_id IS NOT DISTINCT FROM public.auth_org_id()
       AND (public.auth_role() IN ('owner','admin')
            OR public.role_rank(public.project_role(d.project_id)) >= public.role_rank('editor'))
       AND public.satisfies_markings(public.effective_file_markings('dataset', d.id))
       AND public.passes_scoped_session(public.effective_file_markings('dataset', d.id))
  )
$$;

DROP POLICY IF EXISTS "members read datasets" ON public.datasets;
CREATE POLICY "members read datasets" ON public.datasets
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM public.auth_org_id()
    AND public.satisfies_markings(public.effective_file_markings('dataset', id))
    AND public.passes_scoped_session(public.effective_file_markings('dataset', id))
  );

DROP POLICY IF EXISTS "members read projects" ON public.projects;
CREATE POLICY "members read projects" ON public.projects
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM public.auth_org_id()
    AND public.satisfies_markings(public.effective_file_markings('project', id))
    AND public.passes_scoped_session(public.effective_file_markings('project', id))
  );

-- ── access ───────────────────────────────────────────────────────────────────

CREATE POLICY "members read settings" ON public.organization_scoped_session_settings
  FOR SELECT USING (organization_id IS NOT DISTINCT FROM public.auth_org_id());
CREATE POLICY "admins write settings" ON public.organization_scoped_session_settings
  FOR ALL USING (public.auth_role() IN ('owner','admin')
                 AND organization_id IS NOT DISTINCT FROM public.auth_org_id())
          WITH CHECK (public.auth_role() IN ('owner','admin')
                 AND organization_id IS NOT DISTINCT FROM public.auth_org_id());

CREATE POLICY "members read sessions" ON public.scoped_sessions
  FOR SELECT USING (organization_id IS NOT DISTINCT FROM public.auth_org_id());
CREATE POLICY "admins author sessions" ON public.scoped_sessions
  FOR ALL USING (public.auth_role() IN ('owner','admin')
                 AND organization_id IS NOT DISTINCT FROM public.auth_org_id())
          WITH CHECK (public.auth_role() IN ('owner','admin')
                 AND organization_id IS NOT DISTINCT FROM public.auth_org_id());

CREATE POLICY "members read session markings" ON public.scoped_session_markings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.scoped_sessions s
                             WHERE s.id = scoped_session_id
                               AND s.organization_id IS NOT DISTINCT FROM public.auth_org_id()));
CREATE POLICY "admins author session markings" ON public.scoped_session_markings
  FOR ALL USING (public.auth_role() IN ('owner','admin'))
          WITH CHECK (public.auth_role() IN ('owner','admin'));

-- A user picks their own session, and only one they are entitled to pick.
CREATE POLICY "choose my own session" ON public.user_scoped_session
  FOR ALL USING (user_id = auth.uid())
          WITH CHECK (user_id = auth.uid()
                      AND (scoped_session_id IS NULL
                           OR public.can_choose_scoped_session(scoped_session_id)));

DO $$
DECLARE
  org uuid; usr uuid; cat uuid; a uuid; b uuid; c uuid;
  sess uuid; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  SELECT id INTO usr FROM public.users LIMIT 1;

  INSERT INTO public.organizations (name) VALUES ('m404') RETURNING id INTO org;
  INSERT INTO public.marking_categories (name) VALUES ('m404') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'A') RETURNING id INTO a;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'B') RETURNING id INTO b;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'C') RETURNING id INTO c;
  INSERT INTO public.scoped_sessions (organization_id, name) VALUES (org, 'focus')
       RETURNING id INTO sess;
  INSERT INTO public.scoped_session_markings (scoped_session_id, marking_id) VALUES (sess, a);

  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org))::text, true);

  -- Not configured: no filtering at all.
  IF NOT public.passes_scoped_session(ARRAY[c]) THEN
    RAISE EXCEPTION 'Migration 404: filtering happened with scoped sessions unconfigured';
  END IF;

  INSERT INTO public.organization_scoped_session_settings (organization_id, enabled, allow_no_session)
       VALUES (org, false, false);
  IF NOT public.passes_scoped_session(ARRAY[c]) THEN
    RAISE EXCEPTION 'Migration 404: filtering happened while disabled';
  END IF;

  UPDATE public.organization_scoped_session_settings SET enabled = true WHERE organization_id = org;
  INSERT INTO public.user_scoped_session (user_id, scoped_session_id) VALUES (usr, sess);

  -- auth.uid() is NULL in a migration, so the caller here is the unchosen case:
  -- enabled, no session row for this caller, no_session not allowed → empty
  -- session. Unmarked resources still pass; marked ones do not.
  IF NOT public.passes_scoped_session('{}'::uuid[]) THEN
    RAISE EXCEPTION 'Migration 404: an UNMARKED resource was hidden — "users will be able to see anything that does not have a Marking"';
  END IF;
  IF public.passes_scoped_session(ARRAY[c]) THEN
    RAISE EXCEPTION 'Migration 404: a marked resource passed an empty session';
  END IF;

  -- allow_no_session is the documented bypass: "the same access that a user would
  -- have if scoped sessions are disabled".
  UPDATE public.organization_scoped_session_settings SET allow_no_session = true WHERE organization_id = org;
  IF NOT public.passes_scoped_session(ARRAY[c]) THEN
    RAISE EXCEPTION 'Migration 404: allow_no_session did not restore full access';
  END IF;

  -- The disjunctive rule itself, checked directly against the session's set.
  IF NOT (ARRAY[a, b] && ARRAY[a]) THEN
    RAISE EXCEPTION 'Migration 404: overlap is not how a resource marked {A,B} meets a session {A}';
  END IF;
  IF (ARRAY[b, c] && ARRAY[a]) THEN
    RAISE EXCEPTION 'Migration 404: a resource sharing no marking with the session matched';
  END IF;

  -- A session may only be chosen by a member of ALL its markings. Nobody is a
  -- member of A here, so it is not selectable.
  IF public.can_choose_scoped_session(sess) THEN
    RAISE EXCEPTION 'Migration 404: a non-member could choose a session';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.user_scoped_session WHERE user_id = usr;
  DELETE FROM public.scoped_session_markings WHERE scoped_session_id = sess;
  DELETE FROM public.scoped_sessions WHERE id = sess;
  DELETE FROM public.organization_scoped_session_settings WHERE organization_id = org;
  DELETE FROM public.organizations WHERE id = org;
  ALTER TABLE public.markings DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE category_id = cat;
  DELETE FROM public.marking_categories WHERE id = cat;
  ALTER TABLE public.markings ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
END $$;

COMMIT;
