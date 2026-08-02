-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 309 — promotion: the portal stops being a hardcoded list.
--
-- W4 of docs/WORKSHOP-PLAN.md. W1-W3 made a module real; nobody can find one.
-- ApplicationsPage is a TypeScript array, so a module a manager built is
-- reachable only by typing its URL.
--
-- FOUNDRY'S MODEL (app-building/curating-apps), adopted:
--
--   PROMOTION IS ITS OWN RESOURCE, not a flag on the app. It points at the app,
--   and "you can change the resource that a promotion references to release new
--   applications in a controlled manner" — so the promotion is where the
--   published version is pinned, and un-promoting is removing the promotion,
--   not deleting the module.
--
--   REQUIRED to promote: name, icon, owner, thumbnail, COLLECTION.
--   Optional: tags, description.
--
--   COLLECTIONS are "titles of sections in Applications Portal" — top-level,
--   sidebar-shaped, and "only appear if they contain promoted apps accessible
--   to the user". That last clause is a visibility rule, not a UI nicety, so
--   get_promoted_apps() applies it in SQL rather than leaving empty headings.
--
--   TAGS are "labels on the promoted app cards" that filter. Different thing,
--   different shape: many per app, no sections.
--
-- DELIBERATE DIVERGENCE — thumbnail is nullable. Foundry requires one; we have
-- no upload surface for app art, and a required column nobody can populate is a
-- promotion nobody can make. The card falls back to the icon. When an upload
-- surface exists this becomes NOT NULL, and that is the only change needed.
--
-- Permissions follow Foundry's shape (org admin, plus editor on the app) using
-- the roles this system already has: owner/admin promote, everyone reads what
-- their scope allows.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_name        text NOT NULL CHECK (api_name ~ '^[a-z][a-zA-Z0-9_]*$'),
  title           text NOT NULL,
  description     text NOT NULL DEFAULT '',
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_name)
);

COMMENT ON TABLE public.app_collections IS
  'Sections of the Applications portal. A collection with no promoted app the viewer can reach is not shown — Foundry''s rule, enforced in get_promoted_apps.';

CREATE TABLE IF NOT EXISTS public.app_promotions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = the whole org. A hotel-scoped promotion is how W5 lets one property
  -- publish something its siblings do not see.
  hotel_id        uuid REFERENCES public.hotels(id) ON DELETE CASCADE,

  module_id       uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  -- Which version the portal publishes. The module may move ahead; the promotion
  -- is what "release in a controlled manner" means.
  module_version  integer NOT NULL,

  collection_id   uuid NOT NULL REFERENCES public.app_collections(id) ON DELETE RESTRICT,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  icon            text NOT NULL CHECK (length(btrim(icon)) > 0),
  owner_user_id   uuid NOT NULL REFERENCES public.users(id),
  description     text NOT NULL DEFAULT '',
  thumbnail_url   text,
  tags            text[] NOT NULL DEFAULT '{}',

  promoted_by     uuid REFERENCES public.users(id),
  promoted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, organization_id)
);

COMMENT ON TABLE public.app_promotions IS
  'A promotion points at a module and pins the version the portal publishes. Un-promoting deletes the promotion, never the module.';
COMMENT ON COLUMN public.app_promotions.thumbnail_url IS
  'Nullable by deliberate divergence — Foundry requires a thumbnail; we have no upload surface for app art yet, and the card falls back to the icon.';

CREATE INDEX IF NOT EXISTS idx_app_promotions_collection
  ON public.app_promotions (organization_id, collection_id);

ALTER TABLE public.app_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_promotions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read collections in org" ON public.app_collections;
CREATE POLICY "members read collections in org" ON public.app_collections
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "admins curate collections" ON public.app_collections;
CREATE POLICY "admins curate collections" ON public.app_collections
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

DROP POLICY IF EXISTS "members read promotions in scope" ON public.app_promotions;
CREATE POLICY "members read promotions in scope" ON public.app_promotions
  FOR SELECT TO authenticated
  USING (organization_id IS NOT DISTINCT FROM auth_org_id()
         AND (hotel_id IS NULL OR hotel_is_in_user_scope(hotel_id)));

DROP POLICY IF EXISTS "admins promote" ON public.app_promotions;
CREATE POLICY "admins promote" ON public.app_promotions
  FOR ALL TO authenticated
  USING (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id())
  WITH CHECK (auth_role() IN ('owner','admin') AND organization_id IS NOT DISTINCT FROM auth_org_id());

-- ── The portal, as one call ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_promoted_apps()
RETURNS TABLE (
  collection_api_name text,
  collection_title    text,
  collection_position integer,
  promotion_id        uuid,
  module_api_name     text,
  module_version      integer,
  published_version   integer,
  name                text,
  icon                text,
  description         text,
  thumbnail_url       text,
  tags                text[],
  owner_email         text,
  hotel_id            uuid
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT c.api_name, c.title, c.position,
         p.id, m.api_name, m.version, p.module_version,
         p.name, p.icon, p.description, p.thumbnail_url, p.tags,
         u.email, p.hotel_id
  FROM app_promotions p
  JOIN app_collections c ON c.id = p.collection_id
  JOIN modules m         ON m.id = p.module_id
  LEFT JOIN users u      ON u.id = p.owner_user_id
  -- RLS on each table decides what this sees; a collection with nothing visible
  -- in it simply produces no rows, which is Foundry's "only appear if they
  -- contain promoted apps accessible to the user".
  ORDER BY c.position, c.title, p.name;
$$;

REVOKE ALL ON FUNCTION public.get_promoted_apps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_promoted_apps() TO authenticated;

INSERT INTO public.shape_registry (object_kind, object_name, classification, reason) VALUES
  ('table','app_collections','platform','Sections of the Applications portal'),
  ('table','app_promotions','platform','A published module, with the version the portal serves')
ON CONFLICT (object_kind, object_name) DO NOTHING;

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_org uuid; v_col uuid; v_mod uuid; v_user uuid;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT id INTO v_user FROM users LIMIT 1;
  BEGIN
    INSERT INTO app_collections (organization_id, api_name, title)
    VALUES (v_org, 'probe_col', 'Probe') RETURNING id INTO v_col;
    INSERT INTO modules (organization_id, api_name, title)
    VALUES (v_org, 'probe_promo_mod', 'Probe') RETURNING id INTO v_mod;

    -- A promotion with no name must be refused: the metadata IS the contract.
    BEGIN
      INSERT INTO app_promotions (organization_id, module_id, module_version,
                                  collection_id, name, icon, owner_user_id)
      VALUES (v_org, v_mod, 1, v_col, '  ', 'application', v_user);
      RAISE EXCEPTION 'Migration 309: a promotion with a blank name was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO app_promotions (organization_id, module_id, module_version,
                                collection_id, name, icon, owner_user_id)
    VALUES (v_org, v_mod, 1, v_col, 'Probe app', 'application', v_user);

    -- One promotion per module per org — promoting twice is an edit, not a copy.
    BEGIN
      INSERT INTO app_promotions (organization_id, module_id, module_version,
                                  collection_id, name, icon, owner_user_id)
      VALUES (v_org, v_mod, 2, v_col, 'Probe again', 'application', v_user);
      RAISE EXCEPTION 'Migration 309: a module was promoted twice in one org';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- Un-promoting must not take the module with it.
    DELETE FROM app_promotions WHERE module_id = v_mod;
    IF NOT EXISTS (SELECT 1 FROM modules WHERE id = v_mod) THEN
      RAISE EXCEPTION 'Migration 309: un-promoting deleted the module';
    END IF;

    RAISE EXCEPTION 'rollback_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;
END $$;

COMMIT;
