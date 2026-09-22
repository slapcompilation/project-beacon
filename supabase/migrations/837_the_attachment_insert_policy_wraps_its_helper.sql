-- The attachment insert policy wraps its helper.
--
-- A forward correction to 836, which is applied and therefore immutable.
--
-- 836's insert policy called `public.auth_org_id()` bare. `rlsInitPlan.test.ts`
-- refused it — `attachments.upload an attachment into your organization →
-- auth_org_id` — and the refusal is the rule 619 established and this repository
-- already records: a STABLE zero-argument helper written bare is re-evaluated
-- PER ROW, while the same call wrapped in a scalar subquery is hoisted to an
-- InitPlan and evaluated once. The measured cost of getting this wrong was 18x
-- and 47x on the tables where it was found.
--
-- Postgres renders the wrapped form as `( SELECT auth_org_id() AS auth_org_id)`,
-- which is what the suite looks for, and every other policy in the platform
-- already reads that way.
--
-- `auth.uid()` in the same policy was already accepted, but it is wrapped here
-- too, for the reason Supabase's own guidance gives in the words the suite
-- quotes beside it: the wrapped form is the one to write. A policy that mixes
-- both spellings teaches the next reader that the choice is stylistic.
--
-- NOTHING ELSE MOVES. The predicate is the same predicate: same columns, same
-- conjunction, same meaning. Only the call form changes.

drop policy "upload an attachment into your organization" on public.attachments;

create policy "upload an attachment into your organization" on public.attachments
  for insert with check (
    organization_id = (SELECT public.auth_org_id())
    AND uploaded_by = (SELECT auth.uid())
  );

-- The delete policy names auth.uid() bare as well; same treatment, same reason.
drop policy "the uploader removes an unlinked attachment" on public.attachments;

create policy "the uploader removes an unlinked attachment" on public.attachments
  for delete using (
    uploaded_by = (SELECT auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.attachment_links l WHERE l.attachment_id = attachments.id)
  );

-- And the read policy's uploader arm, which 836 wrote over the row's columns to
-- dodge the STABLE-snapshot defect and which still called auth.uid() bare.
drop policy "read attachments of readable objects" on public.attachments;

create policy "read attachments of readable objects" on public.attachments
  for select using (
    (attachments.uploaded_by = (SELECT auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.attachment_links l
                      WHERE l.attachment_id = attachments.id AND l.unlinked_at IS NULL))
    OR EXISTS (SELECT 1 FROM public.attachment_links l
                WHERE l.attachment_id = attachments.id
                  AND l.unlinked_at IS NULL
                  AND public.object_type_instances_readable(l.object_type_id))
  );

-- PROVED BY DOING: the suite's own question, asked here at the moment it lands.
DO $$
DECLARE v_sites text; v_user uuid; v_org uuid; v_att uuid; v_n int; v_unwound boolean := false;
BEGIN
  -- 1. No policy on either attachment table calls a wrapped helper per row.
  --    This is the suite's query, narrowed to the two tables this arc added.
  SELECT string_agg(pol.tablename || '.' || pol.policyname || ' → ' || f.name, ', ')
    INTO v_sites
    FROM pg_policies pol,
         unnest(ARRAY['auth_org_id','auth_role','auth_uid']) f(name)
   WHERE pol.schemaname = 'public'
     AND pol.tablename IN ('attachments','attachment_links')
     AND regexp_replace(coalesce(pol.qual,'') || ' ' || coalesce(pol.with_check,''),
                        '\( SELECT ' || f.name || '\(\)[^)]*\)', '', 'g')
         ~ ('\m' || f.name || '\(\)');
  IF v_sites IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: still called per row — %', v_sites;
  END IF;
  RAISE NOTICE 'PROVED: no attachment policy calls a helper per row';

  -- 2. And the predicate still admits exactly what it admitted before, which is
  --    the half a rewrite can quietly lose.
  SELECT id, organization_id INTO v_user, v_org
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.attachments (filename, size_bytes, media_type, organization_id, uploaded_by)
      VALUES ('zz837.pdf', 10, 'application/pdf', v_org, v_user) RETURNING id INTO v_att;
    SELECT count(*) INTO v_n FROM public.attachments WHERE id = v_att;
    RESET ROLE;
    IF v_n <> 1 THEN RAISE EXCEPTION 'PROOF FAILED: the uploader cannot read their own upload'; END IF;
    RAISE NOTICE 'PROVED: the uploader still inserts and still reads it back';
    RAISE EXCEPTION 'ZZ837_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ837_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;
  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.attachments;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: % attachment(s) survived', v_n; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $$;
