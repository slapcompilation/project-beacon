-- The Compass Activity log. Built from readings/compass-activity-log.md, whose
-- Decisions block the operator read and approved in full — including the
-- retention deletion, which is this repository's first unattended destructive
-- job.
--
--   "The Activity log provides a running view of changes made throughout the
--   Project and is only visible at the Project level. For teams building out a
--   new Project or maintaining a long-term Project, the Activity log makes it
--   easier to understand recent activity and collaboration. Note that the
--   Activity log only stores the last month of activity."
--   — compass/use-project-details-panel.md
--
-- and the instruction that makes it load-bearing:
--
--   "To confirm the item's state while the listing catches up, review the
--   Activity log for the Project, or open the item or folder directly and
--   verify that it shows as In trash."
--   — compass/use-project-navigation-panel.md
--
-- ── THE ROW GRAMMAR IS OURS, AND SAYS SO ────────────────────────────────────
-- No prose and no capture anywhere shows the feed's rows (the reading counted:
-- one of six images parsed, none of the six is the feed). Actor + action +
-- resource + time is the least structure that serves the quoted purpose. The
-- name is snapshotted because the resource may be deleted later, and a log
-- that dangles is unreadable; it is nullable because some paths genuinely
-- cannot name one.
--
-- The action set therefore DECLARES NO PAGE — it is the event-log kind from
-- 639's distinction (a log records history; a token nothing emits is a false
-- past), so it admits exactly the twelve tokens whose triggers ship in this
-- file, and it joins the undeclared count the platform suite prints, which is
-- the truthful bucket for a vocabulary no page publishes.
--
-- ── WRITERS ARE TRIGGERS, NOT CALL SITES ────────────────────────────────────
-- The client that set trashed_at and forgot trashed_by (636) is the argument:
-- more than one route reaches every change, and a call site forgets. The
-- markings, tags and collections triggers resolve their project through
-- `project_resources`, which IS the (kind, id) → project filing table; a
-- resource not filed in a project produces no row, because unfiled activity is
-- not project activity.
--
-- ── RETENTION IS A DELETION THE PLATFORM RUNS ───────────────────────────────
-- "Only stores the last month" is a fact about storage. Thirty-one days keeps
-- every reading of "a month" and deletes LESS, which is the safe direction of
-- the inference (reading, Question 1). The arm runs daily through the same
-- pg_cron + SET ROLE beacon_runner path the build heartbeat already trusts,
-- and the function is scoped to this one table by name.

CREATE OR REPLACE FUNCTION public.project_activity_actions()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['created', 'renamed', 'moved', 'trashed', 'restored',
               'marking_applied', 'marking_removed', 'tag_applied', 'tag_removed',
               'added_to_collection', 'transaction_committed', 'transaction_aborted']
$$;

COMMENT ON FUNCTION public.project_activity_actions() IS
  'The twelve things this platform can record happening in a Project — one per trigger in 641, no page: the Activity feed''s row grammar is unpublished in prose and pixels (readings/compass-activity-log).';

CREATE TABLE public.project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor uuid,
  action text NOT NULL CHECK (action = ANY (public.project_activity_actions())),
  resource_kind text NOT NULL,
  resource_id uuid NOT NULL,
  -- The name at the time of the change: the resource may be gone later.
  resource_name text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.project_activity IS
  '"A running view of changes made throughout the Project" (compass/use-project-details-panel). One row per change, written by triggers on the paths that change project resources; stores the last month, enforced by expire_project_activity daily.';

CREATE INDEX project_activity_feed ON public.project_activity (project_id, occurred_at DESC);
CREATE INDEX project_activity_by_actor ON public.project_activity (actor) WHERE actor IS NOT NULL;

-- "only visible at the Project level" — project members read their project's
-- log, and nothing writes it but the SECURITY DEFINER trigger writer below.
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read their project's activity" ON public.project_activity
  FOR SELECT USING (
    public.role_rank(public.project_role(project_id)) >= public.role_rank('viewer'));
GRANT SELECT ON public.project_activity TO authenticated;

CREATE OR REPLACE FUNCTION public.record_project_activity(
  p_project uuid, p_action text, p_kind text, p_id uuid, p_name text)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  INSERT INTO public.project_activity
    (project_id, actor, action, resource_kind, resource_id, resource_name)
  SELECT p_project, auth.uid(), p_action, p_kind, p_id, p_name
   WHERE p_project IS NOT NULL
$$;

COMMENT ON FUNCTION public.record_project_activity(uuid, text, text, uuid, text) IS
  'The single writer of project_activity, called only from the 641 triggers. Silently writes nothing for a NULL project: unfiled activity is not project activity.';

REVOKE ALL ON FUNCTION public.record_project_activity(uuid, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_project_activity(uuid, text, text, uuid, text) FROM authenticated;

-- ── the filed resources: folders, datasets, restricted views ────────────────
-- One function for the family; the column that means "where it is filed"
-- differs by table, so the rows are read through jsonb.
CREATE OR REPLACE FUNCTION public.log_compass_resource_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE nrow jsonb := to_jsonb(NEW); orow jsonb; place_col text;
BEGIN
  place_col := CASE TG_TABLE_NAME WHEN 'folders' THEN 'parent_folder_id' ELSE 'folder_id' END;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_project_activity((nrow->>'project_id')::uuid, 'created',
      rtrim(TG_TABLE_NAME, 's'), (nrow->>'id')::uuid, nrow->>'name');
    RETURN NEW;
  END IF;

  orow := to_jsonb(OLD);
  IF nrow->>'name' IS DISTINCT FROM orow->>'name' THEN
    PERFORM public.record_project_activity((nrow->>'project_id')::uuid, 'renamed',
      rtrim(TG_TABLE_NAME, 's'), (nrow->>'id')::uuid, nrow->>'name');
  END IF;
  IF nrow->>place_col IS DISTINCT FROM orow->>place_col THEN
    PERFORM public.record_project_activity((nrow->>'project_id')::uuid, 'moved',
      rtrim(TG_TABLE_NAME, 's'), (nrow->>'id')::uuid, nrow->>'name');
  END IF;
  IF nrow->>'trashed_at' IS NOT NULL AND orow->>'trashed_at' IS NULL THEN
    PERFORM public.record_project_activity((nrow->>'project_id')::uuid, 'trashed',
      rtrim(TG_TABLE_NAME, 's'), (nrow->>'id')::uuid, nrow->>'name');
  ELSIF nrow->>'trashed_at' IS NULL AND orow->>'trashed_at' IS NOT NULL THEN
    PERFORM public.record_project_activity((nrow->>'project_id')::uuid, 'restored',
      rtrim(TG_TABLE_NAME, 's'), (nrow->>'id')::uuid, nrow->>'name');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER log_activity AFTER INSERT OR UPDATE OF name, parent_folder_id, trashed_at
  ON public.folders FOR EACH ROW EXECUTE FUNCTION public.log_compass_resource_activity();
CREATE TRIGGER log_activity AFTER INSERT OR UPDATE OF name, folder_id, trashed_at
  ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.log_compass_resource_activity();
CREATE TRIGGER log_activity AFTER INSERT OR UPDATE OF name, folder_id, trashed_at
  ON public.restricted_views FOR EACH ROW EXECUTE FUNCTION public.log_compass_resource_activity();

-- ── which project a (kind, id) belongs to ───────────────────────────────────
-- Datasets, folders and restricted views carry project_id on their own row;
-- `project_resources` files only the ontology kinds (object_type, object_set)
-- into projects. One resolver, so the three triggers below cannot each get
-- half of that right.
CREATE OR REPLACE FUNCTION public.project_of_resource(p_kind text, p_id uuid)
RETURNS uuid LANGUAGE sql STABLE
SET search_path TO 'public' AS $$
  SELECT CASE p_kind
    WHEN 'dataset' THEN (SELECT d.project_id FROM public.datasets d WHERE d.id = p_id)
    WHEN 'folder' THEN (SELECT f.project_id FROM public.folders f WHERE f.id = p_id)
    WHEN 'restricted_view' THEN (SELECT rv.project_id FROM public.restricted_views rv WHERE rv.id = p_id)
    ELSE (SELECT pr.project_id FROM public.project_resources pr
           WHERE pr.resource_kind = p_kind AND pr.resource_id = p_id)
  END
$$;

COMMENT ON FUNCTION public.project_of_resource(text, uuid) IS
  'Which project a resource belongs to. Filed kinds go through project_resources; datasets, folders and restricted views carry project_id themselves. NULL means not project activity.';

REVOKE ALL ON FUNCTION public.project_of_resource(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_of_resource(text, uuid) FROM authenticated;

-- ── markings and tags, resolved through the resolver ────────────────────────
CREATE OR REPLACE FUNCTION public.log_marking_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r record; v_proj uuid; v_name text;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_proj := public.project_of_resource(r.resource_kind, r.resource_id);
  SELECT m.name INTO v_name FROM public.markings m WHERE m.id = r.marking_id;
  PERFORM public.record_project_activity(v_proj,
    CASE WHEN TG_OP = 'DELETE' THEN 'marking_removed' ELSE 'marking_applied' END,
    r.resource_kind, r.resource_id, v_name);
  RETURN r;
END $$;

CREATE TRIGGER log_activity AFTER INSERT OR DELETE ON public.resource_markings
  FOR EACH ROW EXECUTE FUNCTION public.log_marking_activity();

CREATE OR REPLACE FUNCTION public.log_tag_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r record; v_proj uuid; v_name text;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_proj := public.project_of_resource(r.resource_kind, r.resource_id);
  SELECT t.name INTO v_name FROM public.tags t WHERE t.id = r.tag_id;
  PERFORM public.record_project_activity(v_proj,
    CASE WHEN TG_OP = 'DELETE' THEN 'tag_removed' ELSE 'tag_applied' END,
    r.resource_kind, r.resource_id, v_name);
  RETURN r;
END $$;

CREATE TRIGGER log_activity AFTER INSERT OR DELETE ON public.resource_tags
  FOR EACH ROW EXECUTE FUNCTION public.log_tag_activity();

CREATE OR REPLACE FUNCTION public.log_collection_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_proj uuid; v_name text;
BEGIN
  v_proj := public.project_of_resource(NEW.resource_kind, NEW.resource_id);
  SELECT c.name INTO v_name FROM public.collections c WHERE c.id = NEW.collection_id;
  PERFORM public.record_project_activity(v_proj, 'added_to_collection',
    NEW.resource_kind, NEW.resource_id, v_name);
  RETURN NEW;
END $$;

CREATE TRIGGER log_activity AFTER INSERT ON public.collection_resources
  FOR EACH ROW EXECUTE FUNCTION public.log_collection_activity();

-- ── the transaction lifecycle, which 638 just gave real entry points ────────
CREATE OR REPLACE FUNCTION public.log_transaction_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_proj uuid; v_name text;
BEGIN
  IF NEW.status = OLD.status OR NEW.status = 'OPEN' THEN RETURN NEW; END IF;
  SELECT d.project_id, d.name INTO v_proj, v_name
    FROM public.datasets d WHERE d.id = NEW.dataset_id;
  PERFORM public.record_project_activity(v_proj,
    CASE NEW.status WHEN 'COMMITTED' THEN 'transaction_committed'
                    ELSE 'transaction_aborted' END,
    'dataset', NEW.dataset_id, v_name);
  RETURN NEW;
END $$;

CREATE TRIGGER log_activity AFTER UPDATE OF status ON public.dataset_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_transaction_activity();

-- ── retention: the first unattended destructive job ─────────────────────────
-- SECURITY DEFINER on 553's ledger-helper shape: the runner holds EXECUTE and
-- no table grant, so this function is the only door to the deletion.
CREATE OR REPLACE FUNCTION public.expire_project_activity()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.project_activity
   WHERE occurred_at < now() - interval '31 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.expire_project_activity() IS
  '"The Activity log only stores the last month of activity" — enforced by deletion, daily, as beacon_runner. Thirty-one days is the inference that deletes LESS (reading, Question 1). Scoped to project_activity by name; it can delete nothing else.';

REVOKE ALL ON FUNCTION public.expire_project_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_project_activity() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_project_activity() TO beacon_runner;

-- The same shape as the heartbeat job the builds already trust.
SELECT cron.schedule('beacon-activity-retention', '17 3 * * *',
  'SET ROLE beacon_runner; SELECT public.expire_project_activity();');

-- Proved by DOING the changes as a real caller and reading the feed back —
-- every token the CHECK admits is produced by the path that produces it, which
-- is 622's enumeration discipline — then the retention, by planting an old row
-- and a young one and showing exactly one survives.
DO $$
DECLARE
  v_org uuid; v_proj uuid; v_user uuid; v_folder uuid; v_ds uuid; v_br uuid;
  v_txn uuid; v_mk uuid; v_seen text[]; v_missing text[]; v_n int;
BEGIN
  BEGIN
    SELECT o.id INTO v_org FROM public.organizations o LIMIT 1;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.organization_id = v_org
      ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_user FROM public.users u WHERE u.organization_id = v_org LIMIT 1;
    IF v_proj IS NULL OR v_user IS NULL THEN
      RAISE EXCEPTION 'no project or user: 641 cannot prove its own writers';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    -- created / renamed / moved / trashed / restored, through a folder
    INSERT INTO public.folders (organization_id, project_id, name)
    VALUES (v_org, v_proj, 'Probe 641') RETURNING id INTO v_folder;
    UPDATE public.folders SET name = 'Probe 641 renamed' WHERE id = v_folder;
    UPDATE public.folders SET trashed_at = now() WHERE id = v_folder;
    UPDATE public.folders SET trashed_at = NULL WHERE id = v_folder;

    -- created + moved, through a dataset; committed + aborted through 638's
    -- own entry points, which is the wiring and not just the trigger
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (v_org, v_proj, 'probe641', 'Probe 641 DS') RETURNING id INTO v_ds;
    UPDATE public.datasets SET folder_id = v_folder WHERE id = v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
    VALUES (v_ds, 'master') RETURNING id INTO v_br;
    v_txn := public.create_transaction(v_ds, 'SNAPSHOT');
    PERFORM public.commit_transaction(v_txn);
    v_txn := public.create_transaction(v_ds, 'SNAPSHOT');
    PERFORM public.abort_transaction(v_txn);

    -- a marking, a tag and a collection, all against the dataset — whose
    -- project resolves from its own row, not the filing table.
    -- Self-contained fixtures, because an enumeration probe that silently
    -- skips a token proves nothing (625's lesson, from the other side).
    SELECT m.id INTO v_mk FROM public.markings m LIMIT 1;
    IF v_mk IS NULL THEN
      RAISE EXCEPTION 'no marking exists: 641 cannot fire the marking arms';
    END IF;
    -- Applying needs the apply and remove permissions on the marking plus
    -- Owner on the resource; the probe grants its own caller both halves
    -- rather than quietly running as the table owner.
    INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    VALUES (v_mk, v_user, 'apply'), (v_mk, v_user, 'remove');
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (v_proj, v_user, 'owner', v_org)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
    VALUES (v_mk, 'dataset', v_ds);
    DELETE FROM public.resource_markings
     WHERE marking_id = v_mk AND resource_kind = 'dataset' AND resource_id = v_ds;

    INSERT INTO public.tag_categories (organization_id, name)
    VALUES (v_org, 'Probe 641 cat');
    INSERT INTO public.tags (category_id, name)
    SELECT tc.id, 'probe-641' FROM public.tag_categories tc
     WHERE tc.name = 'Probe 641 cat' AND tc.organization_id = v_org;
    INSERT INTO public.resource_tags (tag_id, resource_kind, resource_id)
    SELECT t.id, 'dataset', v_ds FROM public.tags t WHERE t.name = 'probe-641';
    DELETE FROM public.resource_tags rt USING public.tags t
     WHERE rt.tag_id = t.id AND t.name = 'probe-641';

    INSERT INTO public.collections (organization_id, name)
    VALUES (v_org, 'Probe 641');
    INSERT INTO public.collection_resources (collection_id, resource_kind, resource_id)
    SELECT c.id, 'dataset', v_ds FROM public.collections c
     WHERE c.name = 'Probe 641' AND c.organization_id = v_org;

    -- every token the CHECK admits was produced, through its real path
    SELECT array_agg(DISTINCT action ORDER BY action) INTO v_seen
      FROM public.project_activity WHERE project_id = v_proj;
    SELECT array_agg(t ORDER BY t) INTO v_missing
      FROM unnest(public.project_activity_actions()) t
     WHERE NOT (t = ANY (coalesce(v_seen, '{}')));
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'these actions have no producer: %', array_to_string(v_missing, ', ');
    END IF;

    -- the actor is the caller, not NULL and not the definer
    IF EXISTS (SELECT 1 FROM public.project_activity
                WHERE project_id = v_proj AND actor IS DISTINCT FROM v_user) THEN
      RAISE EXCEPTION 'an activity row names someone other than the caller';
    END IF;

    -- retention: an old row and a young one, exactly one survives
    INSERT INTO public.project_activity
      (project_id, action, resource_kind, resource_id, resource_name, occurred_at)
    VALUES (v_proj, 'created', 'folder', gen_random_uuid(), 'old', now() - interval '40 days'),
           (v_proj, 'created', 'folder', gen_random_uuid(), 'young', now() - interval '2 days');
    SET LOCAL ROLE beacon_runner;
    v_n := public.expire_project_activity();
    RESET ROLE;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'the retention deleted % row(s); one was past the month and one was not', v_n;
    END IF;
    IF EXISTS (SELECT 1 FROM public.project_activity WHERE resource_name = 'old')
       OR NOT EXISTS (SELECT 1 FROM public.project_activity WHERE resource_name = 'young') THEN
      RAISE EXCEPTION 'the retention deleted the wrong row';
    END IF;

    -- and the job is registered with the scheduler
    IF NOT EXISTS (SELECT 1 FROM cron.job
                    WHERE command ~ 'expire_project_activity' AND active) THEN
      RAISE EXCEPTION 'the retention job is not on the scheduler';
    END IF;

    PERFORM set_config('request.jwt.claims', '', true);
    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '641 proved: all twelve actions produced through their real paths, the actor is the caller, and the retention deleted exactly the old row';
  END;
END $$;
