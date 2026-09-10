-- 793 — a notification is one payload delivered to one person
--
-- Reading: docs/foundry-reference/readings/notifications.md (10 pages, 32 of 34
-- images parsed here and the other two in the effect-inputs pair).
--
-- There is no notifications SECTION in the mirror, and five product pages
-- describe sending one. The question that reading exists to settle was whether
-- that is one mechanism or five, because building a single system over five
-- different designs would be inventing the unification. It is one, and it is a
-- published TYPE rather than a convention:
--
--   "* A `Notification` consists of two fields: a `ShortNotification` and `EmailNotificationContent`."
--   — functions/types-reference.md
--
--   "* A `ShortNotification` represents a summarized version of the notification, which will be shown within the Foundry platform. It includes a short `heading`, `content`, and a collection of `Link`s."
--   — functions/types-reference.md
--
--   "* `EmailNotificationContent` represents a rich version of the notification which can be sent externally via email. It includes a `subject`, a `body` consisting of headless HTML, and a collection of `Link`s."
--   — functions/types-reference.md
--
--   "* A `Link` has a user-facing `label` and a `linkTarget`. The `LinkTarget` can be a URL, an `OntologyObject`, or a `rid` of any resource within Foundry."
--   — functions/types-reference.md
--
-- Four sentences give the whole payload, so the columns below are that type and
-- nothing else. Nothing routed me to that page: it is in `functions/`, and every
-- one of the five product pages populates the type without naming where it lives.
--
-- ── WHAT REACHES IT, WHICH IS WHY THIS IS BUILT NOW ─────────────────────────
-- Four places in this schema already point at a notification system and find
-- none. 517 registers an automation effect kind whose own description says no
-- notification system exists, recorded so a surface could name it. 659 says
-- health-check watchers become the audience if one ever exists. 661 says snooze
-- only silences notifications. 418 records notification as one of three
-- side-effect rules. The audience side is modelled in four places and the
-- delivery side in none, which is the shape the standing rule asks for before
-- building rather than after.
--
-- ── AUDIENCE IS PER PRODUCER, DELIVERY IS NOT ───────────────────────────────
-- Four audience models across the pages: action types configure recipients,
-- data health uses a check's watchers, object monitors use subscribers, the
-- upgrade assistant computes them from a role. So there is NO shared recipients
-- table here. A producer resolves its own principals and hands them over; this
-- file owns only what happens after that, which is uniform.
--
-- Two rules bound every producer, and the second is the reason for the first:
--
--   "Sending directly to email addresses is not supported."
--   — action-types/notifications.md
--
--   "Groups will be resolved to individual users in order to check permissions on the data before sending the notifications."
--   — action-types/notifications.md
--
-- A recipient is a Foundry principal, never an address, and a group is expanded
-- to users. The expansion is recursive because a group may hold a group, and it
-- skips an expired membership because such a member is not one.
--
-- ── THE PERMISSION RULE IS RECORDED AND NOT ENFORCED, WITH ITS REASON ───────
--
--   "Users may only receive notifications containing data which they are allowed to view."
--   — action-types/notifications.md
--
-- That rule exists because Foundry INTERPOLATES ontology data into notification
-- content. Nothing here interpolates: a producer hands over authored text. So
-- the rule has nothing to bite on yet, and enforcing it would mean inventing a
-- per-user readability test over arbitrary rendered prose — a half-built
-- security check, which is worse than a named absence. It becomes real the day
-- templating exists, and the column comment says so where a reader will meet it.
--
-- ── CHANNELS COME FROM THE PAGE THAT ENUMERATES THEM ────────────────────────
-- The preference capture shows email and web per row, and taking the set from
-- there would have missed one. The overview ENUMERATES the mechanisms:
--
--   "Notifications may be sent via:"
--   — object-monitors/overview.md
--
-- In-platform, email, and SMS through a webhook. Only the first is deliverable
-- here — we have no mail transport and no webhooks — and the other two are in
-- the set rather than out of it, because a set trimmed to what we can do stops
-- being the documented set.
--
-- ── WHAT IS DELIBERATELY NOT BUILT ──────────────────────────────────────────
-- The PREFERENCE MATRIX. Its shape is source by event by channel, and its only
-- evidence is a screenshot whose own visible copy says the feature is
-- experimental and may change without notice. Building a three-axis matrix from
-- one experimental capture is how invented structure gets in.
--
-- The OBJECT-MONITOR SUBSCRIBER audience. That product's overview opens by
-- saying it is sunset and names Automate as the replacement, and this repository
-- has a deprecation audit precisely because one deprecated design got in.
--
-- LENGTH CAPS AS CHECKS. The page gives 250 for a subject and 1,000 for a body,
-- and states that they are validated and TRUNCATED when notifications are
-- rendered, with a trailing ellipsis — while the recipient caps FAIL the action.
-- Two different enforcements, so refusing a long body at save would be stricter
-- than Foundry. Truncation happens on the way in here because this send IS the
-- render step; there is no second renderer to do it later, and the header says
-- so rather than leaving a reader to infer it.

BEGIN;

-- ── the enumerated channel set ──────────────────────────────────────────────

CREATE FUNCTION public.notification_channels()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['in_platform', 'email', 'sms']
$$;

COMMENT ON FUNCTION public.notification_channels() IS
  'Values from object-monitors/overview — the three delivery mechanisms it enumerates: the in-platform pop-up in the notifications centre, email, and SMS through a webhook to a third-party service. Only in_platform is deliverable here; the other two are declared because the enumeration is the set, and trimming it to what we can do would make it a different set.';

-- ── the payload, which is the published type ────────────────────────────────

CREATE TABLE public.notifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading            text NOT NULL,
  content            text NOT NULL,
  subject            text,
  body               text,
  links              jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_rid         text,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_heading_present CHECK (length(btrim(heading)) > 0),
  CONSTRAINT notifications_source_is_a_rid CHECK (source_rid IS NULL OR public.rid_valid(source_rid)),
  CONSTRAINT notifications_email_is_whole  CHECK ((subject IS NULL) = (body IS NULL))
);

COMMENT ON TABLE public.notifications IS
  'One notification payload, shaped as functions/types-reference publishes it: a ShortNotification (heading, content) shown in the platform, an optional EmailNotificationContent (subject, body of headless HTML), and one link collection shared by both.';
COMMENT ON COLUMN public.notifications.links IS
  'The shared Link collection. A Link has a label and a linkTarget, and the target is a URL, an ontology object, or the rid of any resource in Foundry (functions/types-reference).';
COMMENT ON COLUMN public.notifications.subject IS
  'The email rendering''s subject, truncated to 250 characters on the way in. action-types/notifications states the cap and says lengths are validated and truncated when notifications are RENDERED; send_notification is the render step here, because there is no second one.';
COMMENT ON COLUMN public.notifications.source_rid IS
  'What produced this — an action type, an automation, a health check. Audience is per producer, so this is the only link back; there is deliberately no shared recipients table.';
COMMENT ON COLUMN public.notifications.content IS
  'The in-platform body. No page caps heading or content, only the email subject and body, so neither is truncated here — being stricter than the page is its own defect.';

-- ── one delivery per recipient, because the audience is people ──────────────

CREATE TABLE public.notification_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel         text NOT NULL DEFAULT 'in_platform',
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_channel_known
    CHECK (channel = ANY (public.notification_channels())),
  UNIQUE (notification_id, user_id, channel)
);

COMMENT ON TABLE public.notification_deliveries IS
  'One row per recipient per channel. Groups are expanded to users before a row exists, because action-types/notifications resolves groups to individuals so that permissions can be checked per person.';
COMMENT ON CONSTRAINT notification_deliveries_channel_known ON public.notification_deliveries IS
  'Values from object-monitors/overview — the three mechanisms it enumerates. Only in_platform is delivered today.';
COMMENT ON COLUMN public.notification_deliveries.delivered_at IS
  'When the channel actually carried it. NULL on email and sms rows for as long as no transport exists, which is what makes an undeliverable channel visible rather than silent.';

CREATE INDEX notification_deliveries_user_idx
  ON public.notification_deliveries (user_id, created_at DESC);
CREATE INDEX notification_deliveries_unread_idx
  ON public.notification_deliveries (user_id) WHERE read_at IS NULL;

-- ── the link list, validated against the published Link ─────────────────────

CREATE FUNCTION public.notification_links_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE e jsonb; t text; k int;
BEGIN
  IF jsonb_typeof(p) <> 'array' THEN RETURN false; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RETURN false; END IF;
    IF jsonb_typeof(e -> 'label') <> 'string' THEN RETURN false; END IF;
    SELECT count(*) INTO k FROM jsonb_object_keys(e);
    IF k <> 2 THEN RETURN false; END IF;
    -- The three published target forms, and no fourth.
    t := e -> 'linkTarget' ->> 'type';
    IF t = 'url' THEN
      IF jsonb_typeof(e -> 'linkTarget' -> 'url') <> 'string' THEN RETURN false; END IF;
    ELSIF t = 'object' THEN
      IF jsonb_typeof(e -> 'linkTarget' -> 'objectType') <> 'string'
         OR jsonb_typeof(e -> 'linkTarget' -> 'primaryKey') <> 'string' THEN RETURN false; END IF;
    ELSIF t = 'rid' THEN
      IF jsonb_typeof(e -> 'linkTarget' -> 'rid') <> 'string'
         OR NOT public.rid_valid(e -> 'linkTarget' ->> 'rid') THEN RETURN false; END IF;
    ELSE
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END $fn$;

COMMENT ON FUNCTION public.notification_links_valid(jsonb) IS
  'A Link has a user-facing label and a linkTarget, and the LinkTarget is a URL, an OntologyObject, or a rid of any resource within Foundry (functions/types-reference). The three target shapes are that sentence; a fourth is refused.';

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_links_valid CHECK (public.notification_links_valid(links));

-- ── sending ─────────────────────────────────────────────────────────────────

CREATE FUNCTION public.notification_render(p text, p_max integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    WHEN length(p) <= p_max THEN p
    ELSE left(p, p_max - 3) || '...'
  END
$$;

COMMENT ON FUNCTION public.notification_render(text, integer) IS
  'Truncates with a trailing ellipsis, which is what action-types/notifications says happens to an over-length subject or body: they are validated and truncated when notifications are rendered. A CHECK would refuse instead, and refusing is what the RECIPIENT caps do, not the length caps.';

CREATE FUNCTION public.send_notification(
  p_heading    text,
  p_content    text,
  p_principals uuid[],
  p_subject    text DEFAULT NULL,
  p_body       text DEFAULT NULL,
  p_links      jsonb DEFAULT '[]'::jsonb,
  p_source_rid text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_id uuid; v_users uuid[]; n integer;
BEGIN
  IF p_principals IS NULL OR array_length(p_principals, 1) IS NULL THEN
    RAISE EXCEPTION 'Notifications:NoRecipients — a notification is sent to at least one principal';
  END IF;

  -- "Groups will be resolved to individual users in order to check permissions
  --  on the data before sending the notifications." Recursive, because a group
  --  may hold a group; an expired membership is not a membership.
  -- One recursive term, not two: a member row names EITHER a user or a group,
  -- so coalescing the two columns walks users and nested groups in one pass.
  -- Postgres allows a recursive CTE exactly one self-reference.
  WITH RECURSIVE reached AS (
    SELECT unnest(p_principals) AS principal
    UNION
    SELECT coalesce(m.member_user_id, m.member_group_id)
      FROM public.group_members m
      JOIN reached r ON r.principal = m.group_id
     WHERE (m.expires_at IS NULL OR m.expires_at > now())
  )
  SELECT array_agg(DISTINCT u.id) INTO v_users
    FROM reached r JOIN public.users u ON u.id = r.principal
   WHERE u.status <> 'DELETED';

  IF v_users IS NULL OR array_length(v_users, 1) IS NULL THEN
    RAISE EXCEPTION 'Notifications:NoRecipients — the given principals resolve to no active user';
  END IF;

  INSERT INTO public.notifications
    (heading, content, subject, body, links, source_rid, created_by_user_id)
  VALUES (p_heading, p_content,
          public.notification_render(p_subject, 250),
          public.notification_render(p_body, 1000),
          coalesce(p_links, '[]'::jsonb), p_source_rid, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.notification_deliveries (notification_id, user_id, channel, delivered_at)
  SELECT v_id, u, 'in_platform', clock_timestamp() FROM unnest(v_users) u;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN v_id;
END $fn$;

COMMENT ON FUNCTION public.send_notification(text, text, uuid[], text, text, jsonb, text) IS
  'Delivers one payload to the users a principal list resolves to. Groups expand recursively and expired memberships are skipped, per action-types/notifications, which resolves groups to individuals so permissions can be checked per person. NOT ENFORCED, and recorded rather than silent: that page also says users may only receive notifications containing data they are allowed to view. That rule exists because Foundry interpolates ontology data into content; nothing here interpolates, so it has nothing to bite on, and it becomes real the day templating does.';

-- ── reading your own ────────────────────────────────────────────────────────

CREATE FUNCTION public.my_notifications(p_limit integer DEFAULT 50)
RETURNS TABLE (delivery_id uuid, notification_id uuid, heading text, content text,
               links jsonb, source_rid text, created_at timestamptz, read_at timestamptz)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT d.id, n.id, n.heading, n.content, n.links, n.source_rid, n.created_at, d.read_at
    FROM public.notification_deliveries d
    JOIN public.notifications n ON n.id = d.notification_id
   WHERE d.user_id = auth.uid() AND d.channel = 'in_platform'
   ORDER BY n.created_at DESC
   LIMIT greatest(coalesce(p_limit, 50), 1)
$fn$;

COMMENT ON FUNCTION public.my_notifications(integer) IS
  'The in-platform notifications centre read path — object-monitors/overview names it as the in-platform pop-up in the Foundry notifications center. Invoker rights, and it filters on auth.uid() so a caller reads only their own.';

CREATE FUNCTION public.mark_notification_read(p_delivery uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  UPDATE public.notification_deliveries
     SET read_at = coalesce(read_at, clock_timestamp())
   WHERE id = p_delivery AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notifications:NotYours — % is not a notification delivered to you', p_delivery;
  END IF;
END $fn$;

-- ── who may see what ────────────────────────────────────────────────────────

ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries  ENABLE ROW LEVEL SECURITY;

-- A delivery belongs to one person and nobody else reads it. The policy does
-- not read notification_deliveries, so it cannot recurse.
CREATE POLICY "a delivery is yours alone" ON public.notification_deliveries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "you may mark your own read" ON public.notification_deliveries
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- A payload is visible exactly to the people it was delivered to.
CREATE POLICY "a payload follows its deliveries" ON public.notifications
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.notification_deliveries d
     WHERE d.notification_id = notifications.id AND d.user_id = (SELECT auth.uid())));

GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT, UPDATE ON public.notification_deliveries TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_channels() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_links_valid(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_render(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_notifications(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.send_notification(text, text, uuid[], text, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_notification(text, text, uuid[], text, text, jsonb, text) TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; usr uuid; other uuid; grp uuid; inner_grp uuid; nested uuid;
  nid uuid; n integer; msg text; realm_id uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m793 probe') RETURNING id INTO org;

  usr := gen_random_uuid(); other := gen_random_uuid(); nested := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (usr,    '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m793a-'||usr||'@beacon.test'),
    (other,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m793b-'||other||'@beacon.test'),
    (nested, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m793c-'||nested||'@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (usr,    'm793a-'||usr||'@beacon.test',    'admin',  org),
    (other,  'm793b-'||other||'@beacon.test',  'admin', org),
    (nested, 'm793c-'||nested||'@beacon.test', 'admin', org);

  -- 1. the channel set is the page's three, not the capture's two
  IF public.notification_channels() <> ARRAY['in_platform','email','sms'] THEN
    RAISE EXCEPTION 'the enumerated channel set is the overview''s three';
  END IF;

  -- 2. the three published link targets, and no fourth
  IF public.notification_links_valid('[]'::jsonb) IS NOT TRUE THEN
    RAISE EXCEPTION 'an empty link list is legal'; END IF;
  IF public.notification_links_valid('[{"label":"Docs","linkTarget":{"type":"url","url":"https://x"}}]') IS NOT TRUE THEN
    RAISE EXCEPTION 'a URL target is one of the three'; END IF;
  IF public.notification_links_valid('[{"label":"Port","linkTarget":{"type":"object","objectType":"Port","primaryKey":"ATH"}}]') IS NOT TRUE THEN
    RAISE EXCEPTION 'an object target is one of the three'; END IF;
  IF public.notification_links_valid('[{"label":"Set","linkTarget":{"type":"rid","rid":"ri.foundry.main.dataset.d1"}}]') IS NOT TRUE THEN
    RAISE EXCEPTION 'a resource rid target is one of the three'; END IF;
  IF public.notification_links_valid('[{"label":"X","linkTarget":{"type":"group","id":"g"}}]') IS NOT FALSE THEN
    RAISE EXCEPTION 'a fourth target shape must be refused'; END IF;
  IF public.notification_links_valid('[{"linkTarget":{"type":"url","url":"https://x"}}]') IS NOT FALSE THEN
    RAISE EXCEPTION 'a Link has a user-facing label'; END IF;
  IF public.notification_links_valid('[{"label":"X","linkTarget":{"type":"rid","rid":"not a rid"}}]') IS NOT FALSE THEN
    RAISE EXCEPTION 'a rid target holds a rid'; END IF;

  -- 3. truncation is at render and carries the ellipsis
  IF public.notification_render(repeat('x', 300), 250) <> left(repeat('x', 300), 247) || '...' THEN
    RAISE EXCEPTION 'an over-length subject is truncated with a trailing ellipsis';
  END IF;
  IF public.notification_render('short', 250) <> 'short' THEN
    RAISE EXCEPTION 'a short value is left alone'; END IF;

  -- 4. a send delivers to one person
  nid := public.send_notification('New issue', 'A new issue has been assigned to you.', ARRAY[other]);
  SELECT count(*) INTO n FROM public.notification_deliveries WHERE notification_id = nid;
  IF n <> 1 THEN RAISE EXCEPTION 'one principal, one delivery, got %', n; END IF;

  -- 5. a group expands, recursively, and an expired membership does not
  SELECT id INTO realm_id FROM public.authentication_providers ORDER BY created_at LIMIT 1;
  INSERT INTO public.groups (organization_id, name, realm) VALUES (org, 'm793 outer', realm_id) RETURNING id INTO grp;
  INSERT INTO public.groups (organization_id, name, realm) VALUES (org, 'm793 inner', realm_id) RETURNING id INTO inner_grp;
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (grp, other);
  INSERT INTO public.group_members (group_id, member_group_id) VALUES (grp, inner_grp);
  INSERT INTO public.group_members (group_id, member_user_id) VALUES (inner_grp, nested);
  INSERT INTO public.group_members (group_id, member_user_id, expires_at)
  VALUES (inner_grp, usr, now() - interval '1 day');

  nid := public.send_notification('Group note', 'To everyone in the group.', ARRAY[grp]);
  SELECT count(*) INTO n FROM public.notification_deliveries WHERE notification_id = nid;
  IF n <> 2 THEN
    RAISE EXCEPTION 'the group holds one user plus a nested group''s user, and one expired member who is not one; got %', n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.notification_deliveries
              WHERE notification_id = nid AND user_id = usr) THEN
    RAISE EXCEPTION 'an expired membership delivered a notification';
  END IF;

  -- 6. the email half is whole or absent, never half
  BEGIN
    INSERT INTO public.notifications (heading, content, subject) VALUES ('h','c','s only');
    RAISE EXCEPTION 'a subject without a body was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 7. an unknown channel is refused
  BEGIN
    INSERT INTO public.notification_deliveries (notification_id, user_id, channel)
    VALUES (nid, other, 'carrier pigeon');
    RAISE EXCEPTION 'an unenumerated channel was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 8. the subject really is truncated on the way in
  nid := public.send_notification('h', 'c', ARRAY[other], repeat('s', 400), repeat('b', 2000));
  SELECT length(subject) INTO n FROM public.notifications WHERE id = nid;
  IF n <> 250 THEN RAISE EXCEPTION 'the subject should be 250 characters, got %', n; END IF;
  SELECT length(body) INTO n FROM public.notifications WHERE id = nid;
  IF n <> 1000 THEN RAISE EXCEPTION 'the body should be 1000 characters, got %', n; END IF;

  -- 9. no recipients is a refusal, not a silent no-op
  BEGIN
    PERFORM public.send_notification('h', 'c', ARRAY[]::uuid[]);
    RAISE EXCEPTION 'an empty principal list was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Notifications:NoRecipients%' THEN RAISE; END IF;
  END;

  -- 10. the read path, as the recipient rather than the sender
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', other, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  SELECT count(*) INTO n FROM public.my_notifications(50);
  IF n < 3 THEN RAISE EXCEPTION 'the recipient should see their own three, got %', n; END IF;

  -- 11. and the sender, who was never a recipient, sees none
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  SELECT count(*) INTO n FROM public.my_notifications(50);
  IF n <> 0 THEN
    RAISE EXCEPTION 'sending is not receiving — the sender should see %, saw %', 0, n;
  END IF;

  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '793 proved: the published type, three link targets, recursive expansion, truncation, and one inbox per person';
END $do$;

COMMIT;
