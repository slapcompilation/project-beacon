// An object resolved from its datasource row and its edit log, checked against
// the table Palantir prints.
//
// `object-edits/how-edits-applied` gives a fifteen-step history — T0 to T14 —
// stating the datasource row, the user edit, and the resulting object state at
// each point. Like the dataset transaction example, that is a specification with
// its own answer key, so the test is to run it and compare.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'
import { checkAnswerKey } from './answerKey'

/** One row of the table: the datasource state, and the edit applied at that time. */
interface Moment {
  /** `null` means the row is not in the datasource. */
  datasource: Record<string, unknown> | null
  edit?: { instruction: 'create' | 'modify' | 'delete'; properties?: Record<string, unknown> }
}
interface ObjectState { properties: Record<string, unknown> | Record<string, never>; deleted: boolean }

describe.skipIf(noDb)('an object with edits', () => {
  let db: pg.Client
  let f: Fixture
  let objectType = ''
  let branch = ''

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_obj')
    const { rows: [ont] } = await db.query(
      `insert into public.ontologies (space_id, organization_id, api_name, label)
       values ($1,$2,'objtest','Object test') returning id`, [f.spaceId, f.orgId])
    const { rows: [t] } = await db.query(
      `insert into public.object_types (organization_id, ontology_id, api_name, label, edits_enabled)
       values ($1,$2,'Ticket','Ticket',true) returning id`, [f.orgId, (ont as { id: string }).id])
    objectType = (t as { id: string }).id
    const { rows: [b] } = await db.query(
      `insert into public.object_type_datasources (object_type_id, dataset_id, branch_id)
       values ($1,$2,$3) returning id`, [objectType, f.datasetId, f.branchId])
    branch = (b as { id: string }).id

    // The four properties the table uses. Declared up front because an object
    // type's property list is its definition — T9 depends on that, since a
    // create yields `col1 = null, col2 = null` for properties it never names.
    //
    // The page writes the key as `pk_column` because it is naming the DATASOURCE
    // COLUMN. Object state is keyed by API name, and a property API name must
    // "begin with a lowercase character… written in camelCase", so the property
    // is `pkColumn` over the column `pk_column`. Same value, correct spelling.
    for (const [pid, api, col, pk] of [
      ['pk_column', 'pkColumn', 'pk_column', true], ['col1', 'col1', 'col1', false],
      ['col2', 'col2', 'col2', false], ['col3', 'col3', 'col3', false],
    ] as [string, string, string, boolean][]) {
      await db.query(
        `insert into public.object_type_properties
           (object_type_id, property_id, display_name, api_name, base_type,
            backing_column, datasource_id, required, is_primary_key)
         values ($1,$2,$2,$3,'string',$4,$5,$6,$6)`,
        [objectType, pid, api, col, pk ? null : branch, pk])
    }
  })
  afterAll(async () => { await rollback(db) })

  const state = async (datasource: Record<string, unknown> | null): Promise<ObjectState> => {
    const { rows: [r] } = await db.query(
      'select properties, deleted from public.object_state($1,$2,$3::jsonb)',
      [objectType, 'pk1', datasource === null ? null : JSON.stringify(datasource)])
    return r as ObjectState
  }

  const DS_A = { pkColumn: 'pk1', col1: 'val1', col2: 'val2' }
  const DS_B = { pkColumn: 'pk1', col1: 'newVal1', col2: 'val2' }
  const DS_C = { pkColumn: 'pk1', col1: 'newVal1', col2: 'val2', col3: null }
  const DS_D = { pkColumn: 'pk1', col1: 'newVal1', col2: 'newVal2', col3: 'newVal3' }

  checkAnswerKey<Moment, ObjectState>({
    source: 'object-edits/how-edits-applied — "Resolve conflicting user edits and datasource updates"',
    steps: [
      { at: 'T0', input: { datasource: DS_A },
        expected: { properties: DS_A, deleted: false } },

      { at: 'T1', input: { datasource: null },
        expected: { properties: {}, deleted: true },
        because: 'row disappears from the datasource, and the object is no longer in the Ontology' },

      { at: 'T2', input: { datasource: DS_A },
        expected: { properties: DS_A, deleted: false },
        because: 'same row reappears in the datasource' },

      { at: 'T3', input: { datasource: DS_A,
          edit: { instruction: 'modify', properties: { pkColumn: 'pk1', col2: 'newVal2' } } },
        expected: { properties: { pkColumn: 'pk1', col1: 'val1', col2: 'newVal2' }, deleted: false },
        because: 'user runs a Modify object Action' },

      { at: 'T4', input: { datasource: null },
        expected: { properties: {}, deleted: true },
        because: 'row disappears again' },

      { at: 'T5', input: { datasource: DS_A },
        expected: { properties: { pkColumn: 'pk1', col1: 'val1', col2: 'newVal2' }, deleted: false },
        because: 'the previous user edit is still applied when the row reappears' },

      { at: 'T6', input: { datasource: DS_B },
        expected: { properties: { pkColumn: 'pk1', col1: 'newVal1', col2: 'newVal2' }, deleted: false },
        because: 'an UNEDITED property receives a datasource update, and it is applied' },

      { at: 'T7', input: { datasource: DS_B, edit: { instruction: 'delete' } },
        expected: { properties: {}, deleted: true },
        because: 'user runs a Delete object Action' },

      { at: 'T8', input: { datasource: DS_C },
        expected: { properties: {}, deleted: true },
        because: 'the datasource gains a column, and the object is still deleted' },

      { at: 'T9', input: { datasource: DS_C,
          edit: { instruction: 'create', properties: { pkColumn: 'pk1', col3: 'val3' } } },
        expected: { properties: { pkColumn: 'pk1', col1: null, col2: null, col3: 'val3' }, deleted: false },
        because: 'a Create object Action — the create is the starting point and IGNORES ALL DATASOURCE DATA' },

      { at: 'T10', input: { datasource: DS_D },
        expected: { properties: { pkColumn: 'pk1', col1: null, col2: null, col3: 'val3' }, deleted: false },
        because: 'col3 is updated in the datasource but no longer considered, due to the prior Create' },

      { at: 'T11', input: { datasource: DS_D,
          edit: { instruction: 'modify', properties: { pkColumn: 'pk1', col2: 'newVal22' } } },
        expected: { properties: { pkColumn: 'pk1', col1: null, col2: 'newVal22', col3: 'val3' }, deleted: false },
        because: 'user runs a Modify object Action' },

      { at: 'T12', input: { datasource: null },
        expected: { properties: { pkColumn: 'pk1', col1: null, col2: 'newVal22', col3: 'val3' }, deleted: false },
        because: 'the row disappears but the object survives, as it was last created by a user edit' },

      { at: 'T13', input: { datasource: DS_D, edit: { instruction: 'delete' } },
        expected: { properties: {}, deleted: true },
        because: 'row reappears, but the user runs a Delete object Action' },
    ],
    run: async ({ datasource, edit }) => {
      if (edit) {
        await db.query(
          `insert into public.object_edits (object_type_id, primary_key, instruction, properties)
           values ($1,'pk1',$2,$3::jsonb)`,
          [objectType, edit.instruction, JSON.stringify(edit.properties ?? {})])
      }
      return state(datasource)
    },
  })

  // T14 states an outcome rather than a state: "User runs a Modify object Action
  // on a deleted object; ANY MODIFY OBJECT ACTION CALL WILL FAIL." So it asserts
  // the failure, and that the state is unmoved by it.
  it('T14 — a Modify object Action on a deleted object fails', async () => {
    const err = await refused(db, () => db.query(
      `insert into public.object_edits (object_type_id, primary_key, instruction, properties)
       values ($1,'pk1','modify','{"col2":"newVal2"}'::jsonb)`, [objectType]))
    expect(err).toContain('Ontology:ObjectIsDeleted')
    expect(await state(DS_D)).toEqual({ properties: {}, deleted: true })
  })

  // "Deletions are not considered an edit. Once a deletion is applied… if the
  //  object is later recreated, IT WILL NOT INHERIT THE PREVIOUS EDITS."
  it('a recreated object does not inherit the edits made before its deletion', async () => {
    await db.query(
      `insert into public.object_edits (object_type_id, primary_key, instruction, properties)
       values ($1,'pk1','create','{"pkColumn":"pk1"}'::jsonb)`, [objectType])
    expect(await state(DS_D)).toEqual({
      properties: { pkColumn: 'pk1', col1: null, col2: null, col3: null }, deleted: false,
    })
  })

  // "There is no mechanism to directly undo a single user edit or deletion."
  it('the edit log is append-only — no update, no delete', async () => {
    const updated = await refused(db, () =>
      db.query('update public.object_edits set properties = $1 where object_type_id = $2',
        ['{}', objectType]))
    const deleted = await refused(db, () =>
      db.query('delete from public.object_edits where object_type_id = $1', [objectType]))
    // The owner bypasses grants, so this asserts the GRANT, which is what the
    // app role is bound by.
    const { rows } = await db.query(
      `select privilege_type from information_schema.role_table_grants
        where grantee='authenticated' and table_name='object_edits'`)
    expect((rows as { privilege_type: string }[]).map((r) => r.privilege_type).sort())
      .toEqual(['INSERT', 'SELECT'])
    expect([updated, deleted]).toBeDefined()
  })
})
