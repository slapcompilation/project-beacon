// A constraint kind belongs to a base type, and Foundry never lets you say
// otherwise.
//
// `value-type-constraints` publishes the pairing twice — explicit "Valid base
// types" lists for Enum and Range, then a second group written from the type
// ("the following property types have additional type-specific constraints
// available"). `value-type-create-constraint.png` shows the enforcement: for a
// String, the Constraint type picker offers exactly RID, UUID, Length, Regex and
// Enum, and the Array/Struct kinds are not rendered at all. There is no error
// message for a mismatch anywhere in the section because there is no way to
// author one.
//
// Ours has no picker in the trust path — `mint_value_type_version()` takes
// caller JSON — so 575 puts the same guarantee on the table.
//
// This lives here rather than only in 575 because applied migrations run once:
// the migration proves the trigger landed, this proves it still holds.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, refused, fixture, type Fixture } from './harness'

// The eight `value_type_constraints.kind` tokens (452).
const KINDS = ['enum', 'range', 'regex', 'rid', 'uuid', 'uniqueness', 'nested', 'element'] as const

describe.skipIf(noDb)('a constraint belongs to its base type', () => {
  let db: pg.Client
  let f: Fixture
  const vt: Record<string, string> = {}

  const one = async (sql: string, p: unknown[] = []) =>
    (await db.query(sql, p)).rows[0] as Record<string, string>

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'vtc575')
    for (const base of ['string', 'integer', 'array', 'struct', 'boolean', 'timestamp', 'long', 'byte']) {
      vt[base] = (await one(
        `insert into public.value_types (space_id, api_name, display_name, base_type)
         values ($1,$2,$2,$3) returning id`, [f.spaceId, `vtc575_${base}`, base])).id
    }
  })
  afterAll(async () => { await rollback(db) })

  const add = (base: string, kind: string) => db.query(
    `insert into public.value_type_constraints
       (value_type_id, version, kind, referenced_value_type_id, struct_field)
     values ($1, 1, $2, $3, $4)`,
    [vt[base], kind,
     kind === 'nested' || kind === 'element' ? vt.string : null,
     kind === 'element' ? 'a_field' : null])

  it('publishes a base-type list for every kind the CHECK accepts', async () => {
    // If a ninth kind is ever added to the vocabulary without a pairing, the
    // function returns NULL and the trigger refuses every constraint of that
    // kind — a silent outage. This is the test that makes that loud.
    for (const kind of KINDS) {
      const row = await one(
        `select public.value_type_constraint_base_types($1) as t`, [kind])
      expect(row.t, `${kind} has a published base-type list`).not.toBeNull()
      expect(Array.isArray(row.t) ? row.t.length : 0).toBeGreaterThan(0)
    }
    const unknown = await one(
      `select public.value_type_constraint_base_types('not_a_kind') as t`)
    expect(unknown.t).toBeNull()
  })

  it('accepts every pairing the page publishes', async () => {
    // Driven off the function so the assertions cannot drift from the rule:
    // whatever it permits must actually insert.
    for (const kind of KINDS) {
      const { rows } = await db.query(
        `select unnest(public.value_type_constraint_base_types($1)) as b`, [kind])
      for (const { b } of rows as { b: string }[]) {
        if (!(b in vt)) continue
        await db.query('savepoint p')
        await add(b, kind)
        await db.query('rollback to savepoint p')
      }
    }
  })

  it('refuses the case the gap run found: a regex on an integer', async () => {
    const err = await refused(db, () => add('integer', 'regex'))
    expect(err).toContain('Ontology:ConstraintNotValidForBaseType')
    expect(err, 'the hint names where regex does apply').toContain('regex')
  })

  it('keeps each type-specific kind to its own type', async () => {
    expect(await refused(db, () => add('string', 'uniqueness'))).toContain('ConstraintNotValidForBaseType')
    expect(await refused(db, () => add('string', 'nested'))).toContain('ConstraintNotValidForBaseType')
    expect(await refused(db, () => add('array', 'element'))).toContain('ConstraintNotValidForBaseType')
    expect(await refused(db, () => add('struct', 'regex'))).toContain('ConstraintNotValidForBaseType')
  })

  it('follows the page over the intuition for long and byte', async () => {
    // Both look numeric. The page lists neither under Enum or Range, and adding
    // them because they seem to belong would be inventing a pairing.
    for (const base of ['long', 'byte']) {
      for (const kind of ['range', 'enum']) {
        expect(await refused(db, () => add(base, kind)),
          `${kind} on ${base}`).toContain('ConstraintNotValidForBaseType')
      }
    }
    // A boolean takes an enum and not a range, for the same reason.
    await db.query('savepoint b')
    await add('boolean', 'enum')
    await db.query('rollback to savepoint b')
    expect(await refused(db, () => add('boolean', 'range'))).toContain('ConstraintNotValidForBaseType')
  })

  it('is sufficient only because the base type cannot move under it', async () => {
    // A guard on the child is worthless if the parent can change. 452 refuses
    // that already — "The base type metadata and the constraints that define
    // the validation rules for the type are immutable" — and this asserts it
    // rather than assuming it, because it is the whole argument for a trigger
    // on the child being enough.
    await db.query('savepoint m')
    await add('string', 'regex')
    const err = await refused(db, () => db.query(
      `update public.value_types set base_type = 'integer' where id = $1`, [vt.string]))
    await db.query('rollback to savepoint m')
    expect(err).toContain('Ontology:ValueTypeBaseIsFixed')
  })

  it('holds against the writer that had no check at all', async () => {
    // `mint_value_type_version()` writes caller JSON straight through, which is
    // how the gap arrived. The trigger sits under it.
    const err = await refused(db, () => db.query(
      `select public.mint_value_type_version($1, $2::jsonb)`,
      [vt.integer, JSON.stringify([{ kind: 'regex', params: { pattern: '^x$' } }])]))
    expect(err).toContain('Ontology:ConstraintNotValidForBaseType')
  })

  // 723, the creation review's F6.3: the binding rides the FRONT door — the
  // dropdown's payload travels through save_object_type and lands. The
  // engine (452's value_conforms at index time) had been unreachable because
  // apply_object_type's upsert never carried the column.
  it('a value-type binding staged by the save lands on the property', async () => {
    const usr = (await one('select gen_random_uuid() as id')).id
    const email = `vtc723-${Date.now()}@beacon.test`
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2)`,
      [usr, email])
    await db.query(`insert into public.users (id, email, role, organization_id)
                    values ($1,$2,'admin',$3)`, [usr, email, f.orgId])
    await db.query(`select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: usr, app_metadata: { role: 'admin', org_id: f.orgId } })])
    const ont = (await one(
      `insert into public.ontologies (space_id, api_name, label, require_resources_in_project)
       values ($1,'vtc723','Vtc 723',false) returning id`, [f.spaceId])).id

    const t = (await one(`select public.save_object_type($1::jsonb, $2::jsonb) as id`, [
      JSON.stringify({ api_name: 'BoundThing', label: 'Bound thing', ontology_id: ont,
        project_id: f.projectId,
        datasources: [{ dataset_id: f.datasetId, branch_id: f.branchId }] }),
      JSON.stringify([{ property_id: 'pk', display_name: 'Id', api_name: 'id',
        base_type: 'string', source: 'column', backing_column: 'pk',
        is_primary_key: true, is_title_key: true, required: true,
        value_type_id: vt.string }]),
    ])).id
    await db.query('select public.save_working_state()')

    expect((await one(
      `select value_type_id from public.object_type_properties
        where object_type_id=$1 and property_id='pk'`, [t])).value_type_id).toBe(vt.string)
  })
})
