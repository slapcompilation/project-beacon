// Recipients read off the objects that fired.
//
// `automate/effect-notification` restricts a recipient property to String or
// Array of String and requires a condition that exposes effect inputs; its own
// configuration form says a static list and object-property-backed recipients
// may BOTH be selected, so the two are a union rather than a choice.
//
// Reading: docs/foundry-reference/readings/notifications.md.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

describe.skipIf(noDb)('recipients read off the objects that fired', () => {
  let db: pg.Client
  let f: Fixture
  let ont: string
  let ot: string
  let oset: string
  let auto: string
  let owner: string
  let viewer: string
  let seq = 0

  const effect = async (over: Record<string, unknown> = {}): Promise<string> => {
    seq += 1
    const base: Record<string, unknown> = {
      automation_id: auto, position: seq, kind: 'notification',
      parameters: JSON.stringify({
        recipients: [viewer], heading: 'Contract changed', content: 'Owners, look.',
      }),
      ...over,
    }
    const cols = Object.keys(base)
    const { rows } = await db.query(
      `insert into public.automation_effects (${cols.join(', ')})
       values (${cols.map((_, i) => '$' + String(i + 1)).join(', ')}) returning id`,
      Object.values(base))
    return rows[0].id as string
  }

  const makeUser = async (): Promise<string> => {
    const { rows } = await db.query('select gen_random_uuid() as id')
    const id = rows[0].id as string
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [id, `dyn-${id}@beacon.test`])
    await db.query(
      `insert into public.users (id, email, role, organization_id) values ($1,$2,'admin',$3)`,
      [id, `dyn-${id}@beacon.test`, f.orgId])
    return id
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_dynrec')
    owner = await makeUser()
    viewer = await makeUser()
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: owner, app_metadata: { role: 'admin', org_id: f.orgId } })])
    const { rows: o } = await db.query(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'dynrecont','Dyn rec', false) returning id`, [f.spaceId])
    ont = o[0].id as string
    const { rows: t } = await db.query(
      `insert into public.object_types (ontology_id, project_id, api_name, label)
       values ($1,$2,'DynContract','Contract') returning id`, [ont, f.projectId])
    ot = t[0].id as string
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source,
          backing_column, is_primary_key, is_title_key, required)
       values ($1,'pk','Pk','pk','string','column','pk',true,true,true)`, [ot])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, array_element_type,
          source, backing_column, position)
       values ($1,'owners','Owners','owners','array','string','column','owners',1)`, [ot])
    await db.query(
      `insert into public.object_type_properties
         (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, position)
       values ($1,'seats','Seats','seats','integer','column','seats',2)`, [ot])
    const { rows: s } = await db.query(
      `insert into public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
       values ('Set','dynrec_set',$1,$2,$3,'[]'::jsonb) returning id`, [ot, f.projectId, ont])
    oset = s[0].id as string
    const { rows: a } = await db.query(
      `insert into public.automations (project_id, display_name, owner_id, condition)
       values ($1,'Watch',$2,$3::jsonb) returning id`,
      [f.projectId, owner, JSON.stringify({ type: 'objects_added', object_set_id: oset })])
    auto = a[0].id as string
    await db.query(
      `insert into public.project_role_grants (project_id, user_id, role, organization_id)
       values ($1,$2,'viewer',$3)`, [f.projectId, viewer, f.orgId])
  })
  afterAll(async () => { await rollback(db) })

  describe('the two bindings', () => {
    it('takes a user property and a group property separately', async () => {
      // The form has two pickers, which is image-only and corroborated on a
      // second page's capture of the same form.
      await expect(effect({ recipient_user_properties: ['owners'] })).resolves.toBeTruthy()
      await expect(effect({ recipient_group_properties: ['owners'] })).resolves.toBeTruthy()
      await expect(effect({
        recipient_user_properties: ['owners'], recipient_group_properties: ['pk'],
      })).resolves.toBeTruthy()
    })

    it('holds a String or an Array of String and nothing else', async () => {
      // "object property types must be either `String` or `Array of String`"
      await expect(effect({ recipient_user_properties: ['pk'] })).resolves.toBeTruthy()
      expect(await refused(db, () => effect({ recipient_user_properties: ['seats'] })))
        .toContain('Automate:RecipientPropertyType')
    })

    it('names a property the condition can actually see', async () => {
      expect(await refused(db, () => effect({ recipient_user_properties: ['nosuch'] })))
        .toContain('Automate:RecipientPropertyNotOnType')
    })

    it('belongs only to a notification effect', async () => {
      expect(await refused(db, () => effect({
        kind: 'action', parameters: '{}', recipient_user_properties: ['owners'],
      }))).toContain('Automate:DynamicRecipientsNeedANotification')
    })

    it('needs a condition that exposes an effect input', async () => {
      // "requires an object set condition that exposes effect inputs"
      const { rows } = await db.query(
        `insert into public.automations (project_id, display_name, owner_id, condition)
         values ($1,'Timed',$2,$3::jsonb) returning id`,
        [f.projectId, owner, JSON.stringify({ type: 'time', cron: '0 2 * * *' })])
      expect(await refused(db, () => effect({
        automation_id: rows[0].id, recipient_user_properties: ['owners'],
      }))).toContain('Automate:ConditionExposesNoInput')
    })
  })

  describe('reading them off what fired', () => {
    it('finds nobody when nothing is indexed, and does not treat that as an error', async () => {
      const e = await effect({ recipient_user_properties: ['owners'] })
      const { rows } = await db.query(
        `select public.dynamic_recipients($1,$2,array['C1']) as r`, [e, ot])
      expect(rows[0].r).toEqual([])
    })

    it('finds nobody when no property is bound', async () => {
      const e = await effect()
      const { rows } = await db.query(
        `select public.dynamic_recipients($1,$2,array['C1']) as r`, [e, ot])
      expect(rows[0].r).toEqual([])
    })
  })

  describe('the union', () => {
    it('still delivers to the static list when no property yields anyone', async () => {
      const e = await effect({ recipient_user_properties: ['owners'] })
      await db.query(`select public.send_automation_notification($1,$2,array['C1'])`, [auto, e])
      const { rows } = await db.query(
        `select count(*)::int as k from public.notification_deliveries d
           join public.notifications n on n.id = d.notification_id
          where n.heading = 'Contract changed' and d.user_id = $1`, [viewer])
      expect(rows[0].k).toBeGreaterThanOrEqual(1)
    })

    it('drops a recipient without Viewer on the automation', async () => {
      // "all recipients require at least Viewer permission on the automation or
      //  they will not receive the notification"
      const stranger = await makeUser()
      const e = await effect({
        parameters: JSON.stringify({
          recipients: [stranger], heading: 'Nobody', content: 'c',
        }),
      })
      expect(await refused(db, () => db.query(
        `select public.send_automation_notification($1,$2,array['C1'])`, [auto, e])))
        .toContain('Automate:NoEligibleRecipients')
    })
  })

  it('hands the fired keys to the dispatcher', async () => {
    const { rows } = await db.query(
      `select count(*)::int as k from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'run_automations'
          and p.prosrc like '%send_automation_notification(a.id, e.id, fired)%'`)
    expect(rows[0].k).toBe(1)
  })
})
