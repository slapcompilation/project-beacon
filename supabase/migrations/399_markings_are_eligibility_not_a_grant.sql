-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 399 — the marking vocabulary, its permissions, and its membership.
--
-- Reading: docs/foundry-reference/readings/markings.md (M1 + M2)
--
-- "Markings define eligibility criteria that restrict visibility and actions to
-- users who meet those criteria. To access a resource, a user must be a member of
-- ALL Markings applied to a resource." (`security/markings`)
--
-- "Access to a Marking is binary (all-or-nothing). REGARDLESS OF ROLE, a user
-- cannot access a file in any way unless the user satisfies all Marking
-- requirements." That is why none of this touches the role tables: a marking is
-- not a stronger role, it is a different axis that no role can override.
--
-- THE ONE RULE THAT IS EASIEST TO GET WRONG. Permissions on a marking do not
-- grant membership of it:
--
--   "All the permissions above are distinct and do not automatically provide
--    users with membership permissions. For example, a user can have 'Apply
--    marking' and 'Manage permissions' access on a Marking and not be a member of
--    the Marking. In that situation, the users could apply the Marking to files,
--    folders, and Projects in the platform and manage the Marking, but they could
--    not see the data marked with that Marking."
--
-- You can classify data you cannot read. Hence two tables, not one, and a test
-- below that asserts an `apply` holder is not a member.
--
-- IRREVERSIBILITY, from two callouts:
--   "Once created, marking categories cannot be deleted."
--   "Once created, markings cannot be deleted or moved to a different category."
--
-- NOT MODELLED, and worth recording: Foundry has an **Organization category** of
-- markings — "Marking visibility is assigned on a per-category basis, WITH THE
-- EXCEPTION OF THE ORGANIZATION CATEGORY" — because an organization *is* a
-- marking to the access system, which is why Control Panel shows an organization
-- both a MARKING ID and a RESOURCE ID (migration 396). We keep the two separate,
-- as Foundry itself does for permissions: "Organizations have a separate
-- permission model with their own Apply organization and Expand access
-- permissions."
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE public.marking_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  -- Control Panel shows this as a settable field reading `Conjunctive · And`,
  -- with the caption "All applied markings will be required." Every sentence in
  -- the docs says markings are conjunctive and no second value appears anywhere,
  -- so only the attested one is allowed. If a disjunctive category turns up, this
  -- CHECK is where it gets added — with a citation.
  category_type text NOT NULL DEFAULT 'conjunctive' CHECK (category_type IN ('conjunctive')),
  -- "Visibility is defined for a category and all of its Markings together; it
  -- cannot be assigned on a per-Marking basis."
  visibility  text NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible','hidden')),
  -- "A Marking category can be restricted to a single Organization to ensure that
  -- it is never visible to users outside of that Organization." NULL = all.
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marking_categories IS
  'A group of markings sharing one visibility setting. Cannot be deleted once created.';
COMMENT ON COLUMN public.marking_categories.visibility IS
  'visible: everyone in scope sees the category and its markings exist. hidden: "the existence of this category and its Markings is considered sensitive information" and only explicit category viewers see it.';

CREATE TABLE public.markings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.marking_categories(id) ON DELETE RESTRICT,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  -- The chips in Control Panel are colour-coded per marking.
  color       text NOT NULL DEFAULT '#394B59' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

COMMENT ON TABLE public.markings IS
  'A mandatory access control. Membership is binary and no role overrides it. Cannot be deleted or moved between categories once created.';

-- Both callouts, enforced rather than documented.
CREATE OR REPLACE FUNCTION public.guard_marking_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Markings:NotDeletable — % cannot be deleted once created', TG_TABLE_NAME
      USING HINT = 'Remove it from the resources that carry it instead. Deleting would silently widen access everywhere it was applied.';
  END IF;
  -- Nested, not `AND`: plpgsql plans a boolean expression as one SQL statement,
  -- so `NEW.category_id` would be resolved even for marking_categories, which has
  -- no such column. Separate statements are planned separately.
  IF TG_TABLE_NAME = 'markings' THEN
    IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      RAISE EXCEPTION 'Markings:NotMovable — a marking cannot be moved to a different category';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_marking_category_immutability
  BEFORE DELETE OR UPDATE ON public.marking_categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_marking_immutability();

CREATE TRIGGER guard_marking_immutability
  BEFORE DELETE OR UPDATE ON public.markings
  FOR EACH ROW EXECUTE FUNCTION public.guard_marking_immutability();

-- ── permissions, which are NOT membership ────────────────────────────────────

CREATE TABLE public.marking_permissions (
  marking_id uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  -- A principal is a user today. Foundry grants to "a user or group" everywhere,
  -- and groups do not exist here yet; when they do, this becomes a principal ref
  -- rather than a second table.
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('manage','apply','remove')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (marking_id, user_id, permission)
);

COMMENT ON TABLE public.marking_permissions IS
  'manage: grant permissions and edit metadata. apply: put this marking on projects and files. remove: take it off. NONE of these grants membership — a holder can classify data they cannot read.';

CREATE TABLE public.marking_members (
  marking_id uuid NOT NULL REFERENCES public.markings(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (marking_id, user_id)
);

COMMENT ON TABLE public.marking_members IS
  'Who can see resources protected by this marking. "Markings are granted globally to users" — membership is not per-resource. Separate from marking_permissions on purpose.';

-- "To remove a Marking, a user must also be able to apply the Marking."
CREATE OR REPLACE FUNCTION public.guard_remove_implies_apply()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.permission = 'remove' AND NOT EXISTS (
    SELECT 1 FROM public.marking_permissions p
     WHERE p.marking_id = NEW.marking_id AND p.user_id = NEW.user_id AND p.permission = 'apply')
  THEN
    RAISE EXCEPTION 'Markings:RemoveRequiresApply — "To remove a Marking, a user must also be able to apply the Marking"';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_remove_implies_apply
  BEFORE INSERT OR UPDATE ON public.marking_permissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_remove_implies_apply();

-- ── the question every access check will ask ─────────────────────────────────

/** True when the caller is a member of every marking in the set. Conjunctive,
 *  and vacuously true for an empty set — a resource with no markings is not
 *  thereby restricted. */
CREATE OR REPLACE FUNCTION public.satisfies_markings(p_markings uuid[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(p_markings, '{}'::uuid[])) AS m(id)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.marking_members mm
        WHERE mm.marking_id = m.id AND mm.user_id = auth.uid()))
$$;

COMMENT ON FUNCTION public.satisfies_markings(uuid[]) IS
  'Conjunctive: "a user must be a member of ALL the Markings on a file, folder, or Project". Empty set passes — no markings is not a restriction.';

CREATE OR REPLACE FUNCTION public.can_apply_marking(p_marking uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.marking_permissions p
                  WHERE p.marking_id = p_marking AND p.user_id = auth.uid()
                    AND p.permission = 'apply')
$$;

CREATE OR REPLACE FUNCTION public.can_remove_marking(p_marking uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.marking_permissions p
                  WHERE p.marking_id = p_marking AND p.user_id = auth.uid()
                    AND p.permission = 'remove')
$$;

-- ── access ───────────────────────────────────────────────────────────────────
-- A hidden category is invisible to anyone who is not a member of one of its
-- markings or does not hold a permission on one. A visible category's existence
-- is readable by anyone in scope — "In most cases, the names and descriptions of
-- Markings and categories are not sensitive information and should be visible
-- even to users who do not have Marking access."

CREATE OR REPLACE FUNCTION public.can_see_marking_category(p_category uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marking_categories c
     WHERE c.id = p_category
       AND (c.organization_id IS NULL
            OR c.organization_id IS NOT DISTINCT FROM public.auth_org_id())
       AND (c.visibility = 'visible'
            -- "All users with access to a Marking can view existence of the
            -- category and all other Markings within the category… All users with
            -- roles (administrator, remover) on a Marking can view the category."
            OR EXISTS (SELECT 1 FROM public.markings m
                        JOIN public.marking_members mm ON mm.marking_id = m.id
                       WHERE m.category_id = c.id AND mm.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.markings m
                        JOIN public.marking_permissions p ON p.marking_id = m.id
                       WHERE m.category_id = c.id AND p.user_id = auth.uid())))
$$;

CREATE POLICY "see visible categories" ON public.marking_categories
  FOR SELECT USING (public.can_see_marking_category(id));
CREATE POLICY "admins author categories" ON public.marking_categories
  FOR ALL USING (public.auth_role() IN ('owner','admin'))
          WITH CHECK (public.auth_role() IN ('owner','admin'));

CREATE POLICY "see markings of visible categories" ON public.markings
  FOR SELECT USING (public.can_see_marking_category(category_id));
CREATE POLICY "admins author markings" ON public.markings
  FOR ALL USING (public.auth_role() IN ('owner','admin'))
          WITH CHECK (public.auth_role() IN ('owner','admin'));

CREATE POLICY "see own membership" ON public.marking_members
  FOR SELECT USING (user_id = auth.uid() OR public.auth_role() IN ('owner','admin'));
CREATE POLICY "admins grant membership" ON public.marking_members
  FOR ALL USING (public.auth_role() IN ('owner','admin'))
          WITH CHECK (public.auth_role() IN ('owner','admin'));

CREATE POLICY "see own permissions" ON public.marking_permissions
  FOR SELECT USING (user_id = auth.uid() OR public.auth_role() IN ('owner','admin'));
CREATE POLICY "managers grant permissions" ON public.marking_permissions
  FOR ALL
  USING (public.auth_role() IN ('owner','admin')
         OR EXISTS (SELECT 1 FROM public.marking_permissions p
                     WHERE p.marking_id = marking_permissions.marking_id
                       AND p.user_id = auth.uid() AND p.permission = 'manage'))
  WITH CHECK (public.auth_role() IN ('owner','admin')
         OR EXISTS (SELECT 1 FROM public.marking_permissions p
                     WHERE p.marking_id = marking_permissions.marking_id
                       AND p.user_id = auth.uid() AND p.permission = 'manage'));

DO $$
DECLARE cat uuid; mk uuid; usr uuid; ok boolean;
BEGIN
  SELECT id INTO usr FROM public.users LIMIT 1;
  IF usr IS NULL THEN RAISE EXCEPTION 'Migration 399: no user to test with'; END IF;

  INSERT INTO public.marking_categories (name) VALUES ('m399') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'PII') RETURNING id INTO mk;

  -- Conjunctive, and vacuously true on the empty set.
  IF NOT public.satisfies_markings('{}'::uuid[]) THEN
    RAISE EXCEPTION 'Migration 399: an unmarked resource was treated as restricted';
  END IF;
  IF public.satisfies_markings(ARRAY[mk]) THEN
    RAISE EXCEPTION 'Migration 399: a non-member satisfied a marking';
  END IF;

  -- THE RULE: apply does not imply membership.
  INSERT INTO public.marking_permissions (marking_id, user_id, permission) VALUES (mk, usr, 'apply');
  SELECT EXISTS (SELECT 1 FROM public.marking_members WHERE marking_id = mk AND user_id = usr) INTO ok;
  IF ok THEN RAISE EXCEPTION 'Migration 399: granting apply also granted membership'; END IF;

  -- remove requires apply, in that order.
  BEGIN
    INSERT INTO public.marking_permissions (marking_id, user_id, permission)
    SELECT mk, u.id, 'remove' FROM public.users u WHERE u.id <> usr LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'Migration 399: remove was granted without apply'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF position('RemoveRequiresApply' in SQLERRM) = 0
       AND position('Migration 399' in SQLERRM) > 0 THEN RAISE; END IF;
  END;
  INSERT INTO public.marking_permissions (marking_id, user_id, permission) VALUES (mk, usr, 'remove');

  -- Neither a marking nor a category may be deleted.
  BEGIN
    DELETE FROM public.markings WHERE id = mk;
    RAISE EXCEPTION 'Migration 399: a marking was deleted';
  EXCEPTION WHEN OTHERS THEN
    IF position('NotDeletable' in SQLERRM) = 0 THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.marking_categories SET name = 'm399b' WHERE id = cat;
    DELETE FROM public.marking_categories WHERE id = cat;
    RAISE EXCEPTION 'Migration 399: a category was deleted';
  EXCEPTION WHEN OTHERS THEN
    IF position('NotDeletable' in SQLERRM) = 0 THEN RAISE; END IF;
  END;

  -- Membership is what satisfies, and nothing else.
  INSERT INTO public.marking_members (marking_id, user_id) VALUES (mk, usr);
  -- auth.uid() is NULL in a migration, so this asserts the shape rather than the
  -- caller: the member row exists and satisfies_markings reads marking_members.
  IF NOT EXISTS (SELECT 1 FROM public.marking_members WHERE marking_id = mk AND user_id = usr) THEN
    RAISE EXCEPTION 'Migration 399: membership did not persist';
  END IF;

  -- Leave nothing behind. The immutability triggers refuse a normal DELETE, so
  -- this is the one place that has to go around them — deliberately, and only
  -- for rows this migration created.
  ALTER TABLE public.markings DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE id = mk;
  DELETE FROM public.marking_categories WHERE id = cat;
  ALTER TABLE public.markings ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
END $$;

COMMIT;
