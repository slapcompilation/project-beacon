// Notifications, checked against the type Foundry publishes.
//
// `functions/types-reference` defines a Notification as a ShortNotification
// plus an EmailNotificationContent, with one shared Link collection whose
// target is a URL, an object, or a resource rid. `action-types/notifications`
// gives the recipient rules and the length caps.
// `automate/effect-notification` gives the effect: a static recipient list, and
// at least Viewer on the automation to be eligible.
//
// Reading: docs/foundry-reference/readings/notifications.md.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('notifications', () => {
  let db: pg.Client
  let f: Fixture
  let realm: string
  let seq = 0

  // Each test makes its own people: a delivery is per person, so sharing them
  // would let one test decide another's inbox.
  const makeUser = async (): Promise<string> => {
    seq += 1
    const { rows } = await db.query('select gen_random_uuid() as id')
    const id = rows[0].id as string
    const email = `notif-${seq}-${id}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [id, email])
    await db.query(
      `insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`,
      [id, email, f.orgId])
    return id
  }

  const asUser = async (id: string): Promise<void> => {
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: id, app_metadata: { role: 'admin', org_id: f.orgId } })])
  }

  const send = async (
    heading: string, content: string, principals: string[],
    subject: string | null = null, body: string | null = null,
  ): Promise<string> => {
    const { rows } = await db.query(
      `select public.send_notification($1,$2,$3::uuid[],$4,$5) as id`,
      [heading, content, principals, subject, body])
    return rows[0].id as string
  }

  const deliveryCount = async (id: string): Promise<number> => {
    const { rows } = await db.query(
      `select count(*)::int as k from public.notification_deliveries where notification_id = $1`, [id])
    return rows[0].k as number
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_notif')
    const { rows } = await db.query(
      `select id from public.authentication_providers order by created_at limit 1`)
    realm = rows[0].id as string
  })
  afterAll(async () => { await rollback(db) })

  describe('the payload is the published type', () => {
    it('carries a heading and content, and an email half that is whole or absent', async () => {
      const u = await makeUser()
      const id = await send('New issue', 'A new issue has been assigned to you.', [u])
      const { rows } = await db.query(
        `select heading, content, subject, body from public.notifications where id = $1`, [id])
      expect(rows[0]).toMatchObject({
        heading: 'New issue', content: 'A new issue has been assigned to you.',
        subject: null, body: null,
      })
    })

    it('refuses a subject without a body', async () => {
      const why = await refused(db, () => db.query(
        `insert into public.notifications (heading, content, subject) values ('h','c','s')`))
      expect(why).toContain('notifications_email_is_whole')
    })

    it('accepts the three published link targets and refuses a fourth', async () => {
      const valid = async (j: string): Promise<boolean> => {
        const { rows } = await db.query(
          `select public.notification_links_valid($1::jsonb) as v`, [j])
        return rows[0].v as boolean
      }
      // "The LinkTarget can be a URL, an OntologyObject, or a rid of any
      //  resource within Foundry."
      expect(await valid('[{"label":"Docs","linkTarget":{"type":"url","url":"https://x"}}]')).toBe(true)
      expect(await valid('[{"label":"Port","linkTarget":{"type":"object","objectType":"Port","primaryKey":"ATH"}}]')).toBe(true)
      expect(await valid('[{"label":"Set","linkTarget":{"type":"rid","rid":"ri.foundry.main.dataset.d1"}}]')).toBe(true)
      expect(await valid('[{"label":"X","linkTarget":{"type":"group","id":"g"}}]')).toBe(false)
      // "A Link has a user-facing label" — so one without is not a Link.
      expect(await valid('[{"linkTarget":{"type":"url","url":"https://x"}}]')).toBe(false)
    })
  })

  describe('the length caps truncate rather than refuse', () => {
    it('cuts a subject to 250 and a body to 1000, with an ellipsis', async () => {
      // The page says lengths are validated and truncated when notifications
      // are rendered; the recipient caps are what fail instead.
      const u = await makeUser()
      const id = await send('h', 'c', [u], 's'.repeat(400), 'b'.repeat(2000))
      const { rows } = await db.query(
        `select length(subject) as s, length(body) as b, right(subject,3) as tail
           from public.notifications where id = $1`, [id])
      expect(rows[0].s).toBe(250)
      expect(rows[0].b).toBe(1000)
      expect(rows[0].tail).toBe('...')
    })

    it('leaves a short value alone', async () => {
      const { rows } = await db.query(
        `select public.notification_render('short', 250) as r`)
      expect(rows[0].r).toBe('short')
    })
  })

  describe('a recipient is a principal, and groups expand', () => {
    it('resolves a group to its users, recursively', async () => {
      const direct = await makeUser()
      const nested = await makeUser()
      const { rows: g1 } = await db.query(
        `insert into public.groups (organization_id, name, realm) values ($1,$2,$3) returning id`,
        [f.orgId, `notif outer ${String(seq)}`, realm])
      const { rows: g2 } = await db.query(
        `insert into public.groups (organization_id, name, realm) values ($1,$2,$3) returning id`,
        [f.orgId, `notif inner ${String(seq)}`, realm])
      await db.query(
        `insert into public.group_members (group_id, member_user_id) values ($1,$2)`, [g1[0].id, direct])
      await db.query(
        `insert into public.group_members (group_id, member_group_id) values ($1,$2)`, [g1[0].id, g2[0].id])
      await db.query(
        `insert into public.group_members (group_id, member_user_id) values ($1,$2)`, [g2[0].id, nested])

      const id = await send('Group note', 'To the group.', [g1[0].id as string])
      expect(await deliveryCount(id)).toBe(2)
    })

    it('skips an expired membership, because such a member is not one', async () => {
      const live = await makeUser()
      const expired = await makeUser()
      const { rows: g } = await db.query(
        `insert into public.groups (organization_id, name, realm) values ($1,$2,$3) returning id`,
        [f.orgId, `notif expiry ${String(seq)}`, realm])
      await db.query(
        `insert into public.group_members (group_id, member_user_id) values ($1,$2)`, [g[0].id, live])
      await db.query(
        `insert into public.group_members (group_id, member_user_id, expires_at)
         values ($1,$2, now() - interval '1 day')`, [g[0].id, expired])

      const id = await send('Group note', 'To the group.', [g[0].id as string])
      expect(await deliveryCount(id)).toBe(1)
      const { rows } = await db.query(
        `select count(*)::int as k from public.notification_deliveries
          where notification_id = $1 and user_id = $2`, [id, expired])
      expect(rows[0].k).toBe(0)
    })

    it('refuses a send with no principals at all', async () => {
      expect(await refused(db, () => db.query(
        `select public.send_notification('h','c',array[]::uuid[])`)))
        .toContain('Notifications:NoRecipients')
    })
  })

  describe('an inbox belongs to one person', () => {
    it('shows a recipient their own and nobody else theirs', async () => {
      const mine = await makeUser()
      const theirs = await makeUser()
      await send('Yours', 'c', [mine])
      await send('Theirs', 'c', [theirs])

      await asUser(mine)
      const { rows } = await db.query(`select heading from public.my_notifications(50)`)
      expect(rows.map((r) => r.heading)).toContain('Yours')
      expect(rows.map((r) => r.heading)).not.toContain('Theirs')
    })

    it('does not deliver to the sender merely for sending', async () => {
      const sender = await makeUser()
      const recipient = await makeUser()
      await asUser(sender)
      await send('For you', 'c', [recipient])
      const { rows } = await db.query(`select count(*)::int as k from public.my_notifications(50)`)
      expect(rows[0].k).toBe(0)
    })

    it('marks one read, and refuses one that is not yours', async () => {
      const mine = await makeUser()
      const other = await makeUser()
      await send('Mark me', 'c', [mine])
      await asUser(mine)
      const { rows } = await db.query(
        `select delivery_id from public.my_notifications(50) where heading = 'Mark me'`)
      await db.query(`select public.mark_notification_read($1)`, [rows[0].delivery_id])
      const { rows: after } = await db.query(
        `select read_at from public.my_notifications(50) where heading = 'Mark me'`)
      expect(after[0].read_at).not.toBeNull()

      await asUser(other)
      expect(await refused(db, () => db.query(
        `select public.mark_notification_read($1)`, [rows[0].delivery_id])))
        .toContain('Notifications:NotYours')
    })
  })

  describe('the channels are the ones the overview enumerates', () => {
    it('holds three, not the two the preference capture shows', async () => {
      const { rows } = await db.query(`select public.notification_channels() as c`)
      expect(rows[0].c).toEqual(['in_platform', 'email', 'sms'])
    })

    it('refuses a channel outside the set', async () => {
      const u = await makeUser()
      const id = await send('h', 'c', [u])
      expect(await refused(db, () => db.query(
        `insert into public.notification_deliveries (notification_id, user_id, channel)
         values ($1,$2,'carrier pigeon')`, [id, u])))
        .toContain('notification_deliveries_channel_known')
    })
  })

  describe('the automation effect', () => {
    it('is executable now, and the other three kinds did not move', async () => {
      const { rows } = await db.query(
        `select kind, runtime, executable from public.automation_effect_kinds() order by kind`)
      expect(rows).toHaveLength(4)
      expect(rows.find((r) => r.kind === 'notification')).toMatchObject(
        { runtime: 'sql', executable: true })
      expect(rows.find((r) => r.kind === 'logic')).toMatchObject({ runtime: 'none' })
      expect(rows.find((r) => r.kind === 'function')).toMatchObject({ runtime: 'function' })
    })

    it('validates its configuration, and a missing key fails closed', async () => {
      const ok = async (j: string): Promise<boolean> => {
        const { rows } = await db.query(
          `select public.notification_effect_config_valid($1::jsonb) as v`, [j])
        return rows[0].v as boolean
      }
      const u = await makeUser()
      expect(await ok(JSON.stringify({ recipients: [u], heading: 'h', content: 'c' }))).toBe(true)
      // jsonb_typeof of a missing key is NULL, and a bare comparison lets it
      // through — the trap this validator was rewritten to fail closed on.
      expect(await ok('{"heading":"h","content":"c"}')).toBe(false)
      expect(await ok(JSON.stringify({ recipients: [], heading: 'h', content: 'c' }))).toBe(false)
      expect(await ok(JSON.stringify({ recipients: [u], heading: 'h', content: 'c', subject: 's' }))).toBe(false)
      expect(await ok(JSON.stringify({ recipients: [u], heading: 'h', content: 'c', shout: true }))).toBe(false)
    })
  })
})
