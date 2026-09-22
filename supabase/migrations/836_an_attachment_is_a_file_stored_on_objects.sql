-- An attachment is a file stored on objects.
--
-- Item 101 of the parity queue. It is not a missing feature so much as a
-- vocabulary member with nothing behind it: `attachment` is one of the
-- twenty-two values `property_base_types()` admits, and it appears in ZERO
-- tables, ZERO functions and ZERO CHECK constraints. A property could be
-- declared an attachment and there was nowhere for the file to be.
--
--   "**Attachment:** A type for storing files on objects"
--   — object-link-types/base-types.md
--
-- THE RID IS PUBLISHED, so it is not invented: every example in the mirror reads
-- `ri.attachments.main.attachment.<uuid>`, which is service `attachments` and
-- type `attachment` under the grammar 391 settled. The wire shape is published
-- too — `AttachmentV2` is rid, filename, sizeBytes, mediaType
-- (api/ontologies-v2-resources-attachment-properties-get-attachment-property-by-rid)
-- — and those four are the columns here, plus who uploaded it and when.
--
-- THE SIZE LIMIT IS A FACT ABOUT ONE ROW, so it is a CHECK:
--
--   "Attachments are supported for both logic-backed and function-backed actions. There is a global, fixed file size limit of 200MB."
--   — action-types/upload-attachments.md
--
-- THE TEN-OBJECT CAP IS THE DESIGN, AND ITS SECOND CLAUSE IS WHY:
--
--   "Each attachment can be linked to a maximum of ten objects in its lifetime. If an attachment has been linked to ten objects, it cannot be linked to any other objects even if one or more of the original linked objects has been deleted."
--   — action-types/upload-attachments.md
--
-- `in its lifetime`, and explicitly counting objects that have since been
-- deleted. So a link row is never deleted — unlinking stamps `unlinked_at` and
-- the row stays, because the row IS the record that the budget was spent. A
-- design that removed the row would let the cap be reset by deleting an object,
-- which is the case the sentence goes out of its way to forbid. The same
-- sentence makes the cap count DISTINCT OBJECTS rather than link events, which
-- is what the UNIQUE gives: relinking the same object reuses its row.
--
-- PERMISSIONS ARE NOT THE ATTACHMENT'S OWN:
--
--   "Permissions to view, edit, and delete an attachment are consistent with the object to which they are uploaded. For example, if a user has view permissions to an object, they will be able to view and download attachments stored on this object."
--   — action-types/upload-attachments.md
--
-- So there is no ACL here. The read policy asks whether the caller can read the
-- instances of an object type this attachment is linked to. The uploader arm is
-- the other published state — an attachment exists BEFORE it is linked to
-- anything, because "attachments are immediately uploaded to Foundry once they
-- are added to an action form" — and without it a caller could not see the file
-- they just uploaded while the form is still open.
--
-- WHAT THIS DOES NOT BUILD, each recorded rather than half-done:
--
-- * The SWEEPER. "attachments that belong to deleted objects or are no longer
--   mapped to an object ... will eventually automatically be permanently
--   deleted". The page says `eventually` and `after some time` and names no
--   interval, so there is nothing to implement to; `unlinked_at` and an
--   unlinked attachment are recorded so a sweeper has something to read when
--   the interval is known.
-- * The BACKING COLUMN RULE. "The corresponding column in the object-backing
--   dataset must be a **String**", and an **Array** when Allow multiple is on.
--   That is a coherence rule between a datasource schema and a property base
--   type, which is item 42 of the queue and its own chunk. Putting the
--   attachment half here would build a third of 42 in the wrong file.
-- * The ACTION PARAMETER of type Attachment, and Allow multiple. Tier 4.

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  rid text generated always as (public.rid_of('attachments', 'attachment', id)) stored,
  filename text not null,
  size_bytes bigint not null,
  media_type text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid references public.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  constraint attachments_filename_check check (length(btrim(filename)) > 0),
  constraint attachments_media_type_check check (length(btrim(media_type)) > 0),
  constraint attachments_size_check check (size_bytes >= 0 AND size_bytes <= 200 * 1024 * 1024)
);

create unique index attachments_rid_key on public.attachments (rid);
create index attachments_organization_idx on public.attachments (organization_id);
create index attachments_uploaded_by_idx on public.attachments (uploaded_by);

comment on table public.attachments is
  'A file stored on objects — the storage behind the `attachment` base type. Its rid follows the published ri.attachments.main.attachment.<uuid>, and filename/size_bytes/media_type are the AttachmentV2 wire shape.';
comment on constraint attachments_size_check on public.attachments is
  'There is a global, fixed file size limit of 200MB (action-types/upload-attachments).';

-- One row per (attachment, object) it has EVER been linked to.
create table public.attachment_links (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.attachments (id) on delete cascade,
  object_type_id uuid not null references public.object_types (id) on delete cascade,
  primary_key text not null,
  property_id text not null,
  linked_by uuid references public.users (id) on delete set null,
  linked_at timestamptz not null default now(),
  -- Set rather than deleting the row: the cap counts the attachment's LIFETIME,
  -- including objects that have since been deleted.
  unlinked_at timestamptz,
  constraint attachment_links_primary_key_check check (length(btrim(primary_key)) > 0),
  constraint attachment_links_one_per_object unique (attachment_id, object_type_id, primary_key)
);

create index attachment_links_attachment_idx on public.attachment_links (attachment_id);
create index attachment_links_object_idx on public.attachment_links (object_type_id, primary_key);
create index attachment_links_linked_by_idx on public.attachment_links (linked_by);

comment on table public.attachment_links is
  'Every object an attachment has ever been linked to. Rows are stamped unlinked, never deleted, because the ten-object cap counts the attachment''s lifetime and explicitly still counts objects that have been deleted.';
comment on column public.attachment_links.unlinked_at is
  'When the link was removed. The row survives so the lifetime cap cannot be reset by unlinking or by deleting the object.';

-- "a maximum of ten objects in its lifetime" — a count over a set of rows, which
-- no CHECK or unique index can hold, so it is the trigger rung.
create or replace function public.guard_attachment_link_cap()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.attachment_links l
   WHERE l.attachment_id = NEW.attachment_id AND l.id IS DISTINCT FROM NEW.id;
  IF n >= 10 THEN
    RAISE EXCEPTION 'Attachments:LinkLimitReached — an attachment may be linked to at most ten objects in its lifetime'
      USING HINT = 'Upload the file again as a new attachment to link it to more objects.';
  END IF;
  RETURN NEW;
END $$;

create trigger guard_attachment_link_cap
  before insert on public.attachment_links
  for each row execute function public.guard_attachment_link_cap();

-- Whether the caller may see this attachment: the uploader while it is still
-- unlinked, or anyone who can read the instances of a type it is linked to.
create or replace function public.attachment_readable(p_attachment uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  SELECT EXISTS (
    SELECT 1 FROM public.attachments a
     WHERE a.id = p_attachment
       AND a.uploaded_by = auth.uid()
       AND NOT EXISTS (SELECT 1 FROM public.attachment_links l
                        WHERE l.attachment_id = a.id AND l.unlinked_at IS NULL))
  OR EXISTS (
    SELECT 1 FROM public.attachment_links l
     WHERE l.attachment_id = p_attachment
       AND l.unlinked_at IS NULL
       AND public.object_type_instances_readable(l.object_type_id))
$$;

comment on function public.attachment_readable(uuid) is
  'Permissions to view, edit, and delete an attachment are consistent with the object to which they are uploaded (action-types/upload-attachments). The uploader arm covers the published state before any link exists, because an attachment is uploaded as soon as it is added to an action form.';

alter table public.attachments enable row level security;
alter table public.attachment_links enable row level security;

-- Over the ROW'S COLUMNS, not `attachment_readable(id)`. The helper looks the
-- row up and is STABLE, so it evaluates against the snapshot taken at statement
-- start and cannot see the row the same statement is inserting — an INSERT ...
-- RETURNING then fails its own SELECT policy. That is 824's defect exactly,
-- which is written down in this repository and which I still reproduced; the
-- dry run caught it. The helper stays for callers holding an attachment that
-- already exists.
create policy "read attachments of readable objects" on public.attachments
  for select using (
    (attachments.uploaded_by = auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.attachment_links l
                      WHERE l.attachment_id = attachments.id AND l.unlinked_at IS NULL))
    OR EXISTS (SELECT 1 FROM public.attachment_links l
                WHERE l.attachment_id = attachments.id
                  AND l.unlinked_at IS NULL
                  AND public.object_type_instances_readable(l.object_type_id))
  );
create policy "upload an attachment into your organization" on public.attachments
  for insert with check (organization_id = public.auth_org_id() AND uploaded_by = auth.uid());
create policy "the uploader removes an unlinked attachment" on public.attachments
  for delete using (
    uploaded_by = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.attachment_links l WHERE l.attachment_id = attachments.id));

create policy "read links of readable attachments" on public.attachment_links
  for select using (public.attachment_readable(attachment_id));
create policy "link an attachment you can read" on public.attachment_links
  for insert with check (public.attachment_readable(attachment_id));
create policy "unlink from an object you can read" on public.attachment_links
  for update using (public.object_type_instances_readable(object_type_id))
  with check (public.object_type_instances_readable(object_type_id));

grant select, insert, delete on public.attachments to authenticated;
grant select, insert, update on public.attachment_links to authenticated;

-- PROVED BY DOING, as `authenticated`. The fixture unwinds in a subtransaction.
DO $$
DECLARE
  v_user uuid; v_org uuid; v_ot uuid; v_att uuid; v_rid text;
  v_n int; v_msg text; v_fired boolean; v_unwound boolean := false;
BEGIN
  SELECT id, organization_id INTO v_user, v_org
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  SELECT id INTO v_ot FROM public.object_types ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ot IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need a user and an object type';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

  BEGIN
    -- 1. An attachment exists, and names itself the way the mirror does.
    SET LOCAL ROLE authenticated;
    INSERT INTO public.attachments (filename, size_bytes, media_type, organization_id, uploaded_by)
      VALUES ('zz836.pdf', 1024, 'application/pdf', v_org, v_user) RETURNING id, rid INTO v_att, v_rid;
    RESET ROLE;
    IF v_rid <> 'ri.attachments.main.attachment.' || v_att::text THEN
      RAISE EXCEPTION 'PROOF FAILED: the rid is %', v_rid;
    END IF;
    RAISE NOTICE 'PROVED: an attachment carries the published rid — %', left(v_rid, 44) || '…';

    -- 2. The 200MB ceiling is a fact about the row.
    v_fired := false;
    BEGIN
      INSERT INTO public.attachments (filename, size_bytes, media_type, organization_id, uploaded_by)
        VALUES ('zz836-big.bin', 200 * 1024 * 1024 + 1, 'application/octet-stream', v_org, v_user);
    EXCEPTION WHEN check_violation THEN v_fired := true;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'PROOF FAILED: a file over 200MB was accepted'; END IF;
    RAISE NOTICE 'PROVED: 200MB is refused at the row';

    -- 3. THE LIFETIME CAP, and the clause that makes it a lifetime. Ten objects
    --    link; the eleventh is refused; unlinking one does NOT free a slot, and
    --    that is the case the page names explicitly.
    FOR v_n IN 1..10 LOOP
      INSERT INTO public.attachment_links (attachment_id, object_type_id, primary_key, property_id, linked_by)
        VALUES (v_att, v_ot, 'pk-' || v_n::text, 'doc', v_user);
    END LOOP;
    v_fired := false;
    BEGIN
      INSERT INTO public.attachment_links (attachment_id, object_type_id, primary_key, property_id, linked_by)
        VALUES (v_att, v_ot, 'pk-11', 'doc', v_user);
    EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
    END;
    IF NOT v_fired OR v_msg NOT LIKE 'Attachments:LinkLimitReached%' THEN
      RAISE EXCEPTION 'PROOF FAILED: an eleventh object linked (%)', coalesce(v_msg, 'no error');
    END IF;
    RAISE NOTICE 'PROVED: the eleventh object is refused by name';

    UPDATE public.attachment_links SET unlinked_at = now()
     WHERE attachment_id = v_att AND primary_key = 'pk-1';
    v_fired := false;
    BEGIN
      INSERT INTO public.attachment_links (attachment_id, object_type_id, primary_key, property_id, linked_by)
        VALUES (v_att, v_ot, 'pk-12', 'doc', v_user);
    EXCEPTION WHEN others THEN v_fired := true;
    END;
    IF NOT v_fired THEN
      RAISE EXCEPTION 'PROOF FAILED: unlinking freed a slot, so the cap is not a lifetime';
    END IF;
    RAISE NOTICE 'PROVED: unlinking does not free a slot — the cap is a lifetime';

    -- 4. Relinking the SAME object reuses its row rather than spending a second
    --    slot, because the cap counts objects and not link events.
    SELECT count(*) INTO v_n FROM public.attachment_links WHERE attachment_id = v_att;
    IF v_n <> 10 THEN RAISE EXCEPTION 'PROOF FAILED: % link rows, expected 10', v_n; END IF;
    UPDATE public.attachment_links SET unlinked_at = NULL
     WHERE attachment_id = v_att AND primary_key = 'pk-1';
    SELECT count(*) INTO v_n FROM public.attachment_links WHERE attachment_id = v_att;
    IF v_n <> 10 THEN RAISE EXCEPTION 'PROOF FAILED: relinking added a row'; END IF;
    RAISE NOTICE 'PROVED: relinking the same object reuses its row';

    -- 5. Permissions come from the object, not from the attachment.
    IF NOT public.attachment_readable(v_att) THEN
      RAISE EXCEPTION 'PROOF FAILED: an attachment on a readable object is not readable';
    END IF;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.attachments WHERE id = v_att;
    RESET ROLE;
    IF v_n <> 1 THEN RAISE EXCEPTION 'PROOF FAILED: RLS hides an attachment on a readable object'; END IF;
    RAISE NOTICE 'PROVED: the object decides, and RLS agrees';

    RAISE EXCEPTION 'ZZ836_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ836_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.attachments;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: % attachment(s) survived the unwind', v_n; END IF;
  RAISE NOTICE 'PROVED: fixture unwound, no attachments remain';
END $$;
