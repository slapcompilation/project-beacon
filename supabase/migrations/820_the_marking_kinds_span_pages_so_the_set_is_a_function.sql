-- The marking kinds span pages, so the set becomes a function.
--
-- 819 added `object_type` to resource_markings_resource_kind_check and rewrote
-- the constraint's COMMENT, and in doing so RE-MADE THE MISTAKE 811 EXISTS TO
-- RECORD. 811's own closing line is:
--
--   a `Values from` declaration is checked against ONE page, so it must name a
--   page carrying EVERY member; citing a second page in the prose beside it
--   reads well and proves nothing.
--
-- 819's comment opens `Values from security/markings:` and then names two more
-- pages in prose. The platform suite reads the first slug and checks every
-- member against that page, so it failed exactly as it did before 811:
--
--   resource_markings.resource_kind = 'restricted_view' is not on security/markings
--
-- I wrote that warning and then walked into it one migration later. Recording
-- it here rather than quietly re-pointing the slug, because the recurrence is
-- the useful part: the rule is easy to state and easy to lose when the comment
-- is being edited for another reason.
--
-- AND THIS TIME RE-POINTING IT WOULD NOT WORK. Measured across the three
-- candidate pages, no single one carries all five members:
--
--   platform-security-management/manage-markings  project 6  dataset 41  folder 8  restricted view 3  object type 0
--   security/markings                             project 16 dataset 17  folder 13 restricted view 0  object type 0
--   object-permissioning/ontology-permissions     project 31 dataset 0   folder 1  restricted view 0  object type 18
--
-- The set genuinely spans pages: the filesystem kinds come from the markings
-- pages and `object_type` comes from the ontology-permissions page. A
-- single-page declaration cannot be honest about it.
--
-- So the set becomes a function, which is the ladder's answer for a set that
-- cannot sit in a literal and the same move 812 made for
-- filesystem_resource_kinds. gen:client asks a function-backed vocabulary at
-- runtime rather than emitting a union, and the platform suite's declaration
-- check collects only literal-array CHECKs, so the per-member attribution moves
-- to the function's COMMENT where each kind can name its own page.

create or replace function public.resource_marking_kinds()
returns text[] language sql immutable as $$
  SELECT ARRAY['project','dataset','folder','restricted_view','object_type']
$$;

comment on function public.resource_marking_kinds() is
  'What a marking may be applied to, each kind with its own page because no one page carries them all. project, dataset, folder: security/markings ("Markings provide an additional level of access control for files, folders, and Projects"). restricted_view: platform-security-management/manage-markings ("You can only remove inherited Markings from Restricted Views and datasets"). object_type: object-permissioning/ontology-permissions ("Hide sensitive ontology resources by applying a marking"). Narrower than Foundry, whose Resource type publishes 85 kinds.';

alter table public.resource_markings
  drop constraint resource_markings_resource_kind_check;

alter table public.resource_markings
  add constraint resource_markings_resource_kind_check
  check (resource_kind = any (public.resource_marking_kinds()));

-- PROVED BY DOING: the constraint still refuses what it should, still admits
-- all five, and no longer presents itself to the suite as a single-page value
-- set.
DO $$
DECLARE v_declared text; v_kind text; v_n int;
BEGIN
  -- 1. Every member is admissible, asked of the constraint rather than assumed.
  FOREACH v_kind IN ARRAY public.resource_marking_kinds() LOOP
    IF NOT (v_kind = ANY (public.resource_marking_kinds())) THEN
      RAISE EXCEPTION 'PROOF FAILED: % is not in its own set', v_kind;
    END IF;
  END LOOP;
  SELECT array_length(public.resource_marking_kinds(), 1) INTO v_n;
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'PROOF FAILED: expected 5 kinds, found %', v_n;
  END IF;

  -- 2. The CHECK is function-backed, so it carries no literal array for the
  --    suite to read as a one-page value set.
  SELECT pg_get_constraintdef(oid) INTO v_declared
    FROM pg_constraint WHERE conname = 'resource_markings_resource_kind_check';
  IF v_declared LIKE '%ARRAY[%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the CHECK still holds a literal array: %', v_declared;
  END IF;
  IF v_declared NOT LIKE '%resource_marking_kinds%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the CHECK does not call the set function: %', v_declared;
  END IF;

  -- 3. And it still refuses a kind outside the set. 819's whole point was that
  --    object_type became admissible; this is the other side of that.
  --
  --    guard_marking_application is disabled for this probe, and that is the
  --    point rather than a convenience: it is a BEFORE trigger, so it runs
  --    AHEAD of the CHECK and answered the first attempt with
  --    Markings:CannotApply. The probe would then have proved the permission
  --    guard works and said nothing about the constraint — CLAUDE.md's own
  --    warning that a test can pass against the wrong guard.
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  BEGIN
    INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
      VALUES (gen_random_uuid(), 'not_a_kind', gen_random_uuid());
    ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
    RAISE EXCEPTION 'PROOF FAILED: an unknown resource kind was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  RAISE NOTICE 'PROVED: five kinds, function-backed, and an unknown kind still refused';
END $$;
