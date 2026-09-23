// The dataset engine, checked against the answers Palantir prints.
//
// `data-integration/datasets#example-of-transaction-types` gives a four-step
// history and states the resulting view, then adds a fifth step and states it
// again. That is a specification with its own answer key, so the test is to run
// it and compare — not to assert what our implementation happens to do.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, view, commit, refused, type Fixture } from './harness'
import { checkAnswerKey } from './answerKey'

describe.skipIf(noDb)('the dataset engine', () => {
  let db: pg.Client
  let f: Fixture
  // The five transactions of the published example, kept for the tests that
  // travel back to one of them.
  const txn: Record<string, string> = {}

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_ds')
  })
  afterAll(async () => { await rollback(db) })

  // The table, transcribed. Each row is one of the page's numbered steps and the
  // view it states afterwards; the runner turns each into its own `it`.
  describe('the published example', () => {
    checkAnswerKey<{ type: string; files: string[]; key: string }, string[]>({
      source: 'data-integration/datasets#example-of-transaction-types',
      steps: [
        { at: '1', input: { type: 'SNAPSHOT', files: ['A', 'B'], key: 't1' },
          expected: ['A', 'B'], because: 'SNAPSHOT contains files A and B' },
        { at: '2', input: { type: 'APPEND', files: ['C'], key: 't2' },
          expected: ['A', 'B', 'C'], because: 'APPEND adds file C' },
        { at: '3', input: { type: 'UPDATE', files: ['A'], key: 't3' },
          expected: ['A', 'B', 'C'], because: "UPDATE modifies file A to have different contents, A'" },
        { at: '4', input: { type: 'DELETE', files: ['B'], key: 't4' },
          expected: ['A', 'C'], because: 'DELETE removes file B — "the current dataset view would contain A\' and C"' },
        { at: '5', input: { type: 'SNAPSHOT', files: ['D'], key: 't5' },
          expected: ['D'], because: '"a fifth SNAPSHOT transaction containing file D… would then only contain D"' },
      ],
      run: async ({ type, files, key }) => {
        // Each step commits on top of the last, which is what a history is.
        txn[key] = await commit(db, f.datasetId, f.branchId, type, files, txn.previous)
        txn.previous = txn[key]
        return view(db, f.branchId)
      },
    })

    it('has as many views as SNAPSHOT transactions', async () => {
      // "the number of views in a dataset's history is equal to the number of
      //  SNAPSHOT transactions it contains."
      const { rows } = await db.query(
        `select count(*) filter (where txn_type='SNAPSHOT')::int as snapshots,
                (select count(*) from public.dataset_history($1) where txn_type='SNAPSHOT')::int as views
           from public.dataset_history($1)`, [f.branchId])
      const r = rows[0] as { views: number; snapshots: number }
      expect(r.views).toBe(r.snapshots)
    })
  })

  describe('time travel', () => {
    // A view is "the effective file contents of a dataset for a branch at a
    // point in time", so asking as of t4 must still give the four-step answer.
    it('a view anchored to a transaction gives that transaction\'s answer', async () => {
      const { rows } = await db.query(
        'select logical_path from public.dataset_view_from($1) order by logical_path', [txn.t4])
      expect((rows as { logical_path: string }[]).map((r) => r.logical_path)).toEqual(['A', 'C'])
    })

    it('the same holds by clock time, read as text', async () => {
      const { rows: [t] } = await db.query(
        'select committed_at::text as at from public.dataset_transactions where id=$1', [txn.t4])
      const { rows } = await db.query(
        'select logical_path from public.dataset_view($1,$2::timestamptz) order by logical_path',
        [f.branchId, (t as { at: string }).at])
      expect((rows as { logical_path: string }[]).map((r) => r.logical_path)).toEqual(['A', 'C'])
    })

    it('but a JS Date truncates and loses its own anchor — which is why _from exists', async () => {
      // committed_at is microseconds and a JS Date is milliseconds, so a
      // round-tripped commit time lands *before* the transaction it came from.
      // Kept as a PASSING test so nobody "fixes" it back.
      const { rows: [t] } = await db.query(
        'select committed_at::text as at from public.dataset_transactions where id=$1', [txn.t4])
      const { rows } = await db.query(
        'select logical_path from public.dataset_view($1,$2) order by logical_path',
        [f.branchId, new Date((t as { at: string }).at)])
      expect((rows as { logical_path: string }[]).map((r) => r.logical_path)).toEqual(['A', 'B', 'C'])
    })
  })

  describe('branching', () => {
    let feature: string

    it('a branch forked at a transaction sees that transaction\'s view', async () => {
      // "A child branch can be created from another branch, or from any
      //  transaction. The new branch points to the same transaction as the
      //  parent branch." Forked at t4, so not master's {D}.
      const { rows: [b] } = await db.query(
        `insert into public.dataset_branches
           (dataset_id, name, parent_branch_id, parent_dataset_id, head_transaction_id)
         values ($1,'feature',$2,$1,$3) returning id`, [f.datasetId, f.branchId, txn.t4])
      feature = (b as { id: string }).id
      expect(await view(db, feature)).toEqual(['A', 'C'])
    })

    it('commits on a branch leave every other branch unaltered', async () => {
      await commit(db, f.datasetId, feature, 'APPEND', ['E'], txn.t4)
      expect(await view(db, feature)).toEqual(['A', 'C', 'E'])
      // "When a dataset is changed on a branch by committing a transaction, the
      //  transactions and views of all other branches are unaltered."
      expect(await view(db, f.branchId)).toEqual(['D'])
    })
  })

  describe('the commit rules', () => {
    it('refuses an APPEND that overwrites an existing file', async () => {
      // "If an APPEND transaction is opened and existing files are overwritten,
      //  then attempting to commit the transaction will fail."
      const err = await refused(db, () =>
        commit(db, f.datasetId, f.branchId, 'APPEND', ['D'], txn.t5))
      expect(err).toContain('Datasets:AppendOverwritesExistingFiles')
    })

    it('allows the same paths through an UPDATE', async () => {
      // That difference is the whole reason the two types are distinct.
      const err = await refused(db, () =>
        commit(db, f.datasetId, f.branchId, 'UPDATE', ['D'], txn.t5))
      expect(err).toBeNull()
    })
  })

  describe('the physical table', () => {
    beforeAll(async () => {
      await db.query(
        `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
        [f.datasetId, txn.t1, JSON.stringify([
          { name: 'iata', type: 'STRING' },
          { name: 'fare', type: 'DECIMAL', precision: 38, scale: 18 },
          { name: 'tags', type: 'ARRAY', arraySubType: { type: 'STRING' } },
          { name: 'seen', type: 'TIMESTAMP' },
        ])])
      await db.query('select public.dataset_materialize($1,$2)', [f.datasetId, txn.t1])
    })

    it('generates a column per field, in order, behind two of its own', async () => {
      const { rows } = await db.query(
        `select column_name, data_type from information_schema.columns
          where table_schema='datasets' and table_name=$1 order by ordinal_position`,
        [`${'platform_ds'}_ds`])
      const cols = rows as { column_name: string; data_type: string }[]
      expect(cols.map((c) => c.column_name)).toEqual(['_row', '_file', 'iata', 'fare', 'tags', 'seen'])
      expect(cols.find((c) => c.column_name === 'fare')?.data_type).toBe('numeric')
      expect(cols.find((c) => c.column_name === 'tags')?.data_type).toBe('ARRAY')
    })

    it('turns RLS on for what it generates', async () => {
      const { rows: [t] } = await db.query(
        `select c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='datasets' and c.relname=$1`, [`${'platform_ds'}_ds`])
      expect((t as { rls: boolean }).rls).toBe(true)
    })

    it('refuses a caller with no role', async () => {
      // The whole point of a SECURITY DEFINER function is that its own check is
      // the gate — RLS does not run inside one.
      const err = await refused(db, async () => {
        await db.query(`select set_config('request.jwt.claims', '{}', true)`)
        await db.query('select public.dataset_materialize($1,$2)', [f.datasetId, txn.t1])
      })
      expect(err).toContain('Datasets:NotAuthorized')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [f.claims])
    })
  })

  // 638. The api's three entry points, and the head retarget that had to land
  // with them: advance_branch_head fired on INSERT, masked only because the
  // engine inserts and commits inside one statement window.
  describe('the transaction lifecycle', () => {
    it('creates parented on the head without moving it, and commit is what moves it', async () => {
      const { rows: [{ head }] } = await db.query(
        `select head_transaction_id as head from public.dataset_branches where id = $1`,
        [f.branchId]) as unknown as { rows: { head: string }[] }
      const { rows: [{ id }] } = await db.query(
        `select public.create_transaction($1, 'APPEND') as id`, [f.datasetId]) as
        unknown as { rows: { id: string }[] }

      const headNow = async () => (await db.query(
        `select head_transaction_id as h from public.dataset_branches where id = $1`,
        [f.branchId])).rows[0] as { h: string }

      expect((await db.query(
        `select parent_transaction_id as p, status from public.dataset_transactions where id = $1`,
        [id])).rows[0]).toEqual({ p: head, status: 'OPEN' })
      expect((await headNow()).h).toBe(head)          // creating moved nothing

      // "A branch of a dataset can only have one open transaction at a time."
      expect(await refused(db, () => db.query(
        `select public.create_transaction($1, 'APPEND')`, [f.datasetId])))
        .toContain('Datasets:OpenTransactionAlreadyExists')

      await db.query(`select public.commit_transaction($1)`, [id])
      expect((await headNow()).h).toBe(id)            // committing moved it
      expect(await refused(db, () => db.query(
        `select public.commit_transaction($1)`, [id])))
        .toContain('Datasets:TransactionNotOpen')
    })

    // "File modifications made on this Transaction are not preserved and the
    // Branch is not updated" — both halves, at the view level, which is where
    // preservation is real.
    it('an aborted transaction leaves no trace in the view', async () => {
      const before = await view(db, f.branchId)
      const { rows: [{ id }] } = await db.query(
        `select public.create_transaction($1, 'APPEND') as id`, [f.datasetId]) as
        unknown as { rows: { id: string }[] }
      await db.query(
        `insert into public.dataset_files (dataset_id, transaction_id, logical_path, removes, row_count)
         values ($1,$2,'aborted-file',false,1)`, [f.datasetId, id])

      // open is not preserved either: only a commit puts files in the view
      expect(await view(db, f.branchId)).toEqual(before)

      await db.query(`select public.abort_transaction($1)`, [id])
      expect(await view(db, f.branchId)).toEqual(before)
      const { rows: [t] } = await db.query(
        `select status, aborted_at, committed_at from public.dataset_transactions where id = $1`,
        [id]) as unknown as { rows: { status: string; aborted_at: string; committed_at: null }[] }
      expect(t.status).toBe('ABORTED')
      expect(t.aborted_at).not.toBeNull()
      expect(t.committed_at).toBeNull()
    })
  })

  // 844. The schema was built in 392 from the prose page rather than from the
  // api page that publishes the wire encoding, and the two disagree.
  describe('a dataset schema is the published one', () => {
    const fieldOf = async (txn: string) =>
      ((await db.query('select fields -> 0 f from public.dataset_schemas where transaction_id=$1', [txn]))
        .rows[0] as { f: Record<string, unknown> }).f

    // One OPEN transaction per branch is a real constraint
    // (dataset_transactions_one_open_per_branch), so each of these commits
    // immediately rather than leaving one open for the next test to collide
    // with. A schema attaches to the transaction, not to its status.
    const openAndCommit = async (): Promise<string> => {
      const { rows } = await db.query(
        `insert into public.dataset_transactions (dataset_id, branch_id, txn_type)
         values ($1,$2,'SNAPSHOT') returning id`, [f.datasetId, f.branchId])
      const id = (rows[0] as { id: string }).id
      await db.query(
        `update public.dataset_transactions set status='COMMITTED', committed_at=clock_timestamp()
          where id=$1`, [id])
      return id
    }

    it('stamps the required nullable, and never overwrites an explicit one', async () => {
      const txn = { id: await openAndCommit() }
      await db.query(
        `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
        [f.datasetId, txn.id, JSON.stringify([
          { name: 'a', type: 'STRING' }, { name: 'b', type: 'LONG', nullable: false }])])
      const { rows } = await db.query(
        'select f from public.dataset_schemas s, jsonb_array_elements(s.fields) f where s.transaction_id=$1',
        [txn.id])
      const fields = (rows as { f: Record<string, unknown> }[]).map((r) => r.f)
      expect(fields[0].nullable).toBe(true)
      expect(fields[1].nullable).toBe(false)
    })

    // The api writes `arraySubtype` in eight pages; data-integration/datasets.md
    // writes `arraySubType`, and 392 took the prose. api/ publishes the wire
    // encoding, so it wins on a key name.
    it('canonicalises the array key to the api spelling, and resolves the sql type', async () => {
      const txn = { id: await openAndCommit() }
      await db.query(
        `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
        [f.datasetId, txn.id, JSON.stringify([
          { name: 'tags', type: 'ARRAY', arraySubType: { type: 'STRING' } }])])
      const field = await fieldOf(txn.id)
      expect(field).not.toHaveProperty('arraySubType')
      expect(field).toHaveProperty('arraySubtype')
      const t = (await db.query('select public.dataset_field_sql_type($1::jsonb) t', [JSON.stringify(field)]))
        .rows[0] as { t: string }
      expect(t.t).toBe('text[]')
    })

    // "versionId · string · required" — and one schema row per transaction made
    // a second version unstorable, so this was not an additive gap.
    it('carries more than one schema version on one transaction', async () => {
      const txn = { id: await openAndCommit() }
      for (const fields of [[{ name: 'a', type: 'STRING' }], [{ name: 'a', type: 'STRING' }, { name: 'b', type: 'LONG' }]]) {
        await db.query(
          `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,$3::jsonb)`,
          [f.datasetId, txn.id, JSON.stringify(fields)])
      }
      const { rows } = await db.query(
        'select count(*) n, count(distinct version_id) v from public.dataset_schemas where transaction_id=$1',
        [txn.id])
      expect(Number((rows[0] as { n: string }).n)).toBe(2)
      expect(Number((rows[0] as { v: string }).v)).toBe(2)
    })

    // Four published members, where "is parser_params NULL" collapsed three of
    // them into the same answer.
    it('admits exactly the four published dataframe readers', async () => {
      const txn = { id: await openAndCommit() }
      await db.query(
        `insert into public.dataset_schemas (dataset_id, transaction_id, fields) values ($1,$2,'[]'::jsonb)`,
        [f.datasetId, txn.id])
      const { rows } = await db.query(
        'select dataframe_reader r from public.dataset_schemas where transaction_id=$1', [txn.id])
      expect((rows[0] as { r: string }).r).toBe('PARQUET')
      for (const r of ['AVRO', 'CSV', 'DATASOURCE']) {
        await db.query('update public.dataset_schemas set dataframe_reader=$2 where transaction_id=$1', [txn.id, r])
      }
      expect(await refused(db, () => db.query(
        'update public.dataset_schemas set dataframe_reader=$2 where transaction_id=$1', [txn.id, 'ORC'])))
        .toContain('dataframe_reader')
    })
  })

  // 844. Nothing in the database set dataset_files.removes — all six writers
  // inserted (dataset_id, transaction_id, logical_path, row_count) only — so a
  // committed DELETE transaction removed nothing from the view. The harness
  // computed the flag itself, which is why this suite matched the printed
  // answer while the engine did not; it no longer does.
  describe('a committed DELETE removes', () => {
    it('stamps removes from the transaction type, not from the caller', async () => {
      const txn = await commit(db, f.datasetId, f.branchId, 'SNAPSHOT', ['gone.parquet'])
      expect(await view(db, f.branchId)).toContain('gone.parquet')

      const del = await commit(db, f.datasetId, f.branchId, 'DELETE', ['gone.parquet'], txn)
      const { rows } = await db.query(
        'select removes, row_count from public.dataset_files where transaction_id=$1', [del])
      expect((rows[0] as { removes: boolean }).removes, 'stamped by the engine').toBe(true)
      // The existing CHECK says a removing file carries no rows, so the count
      // follows the flag rather than being asserted by the caller.
      expect((rows[0] as { row_count: number }).row_count).toBe(0)
      expect(await view(db, f.branchId)).not.toContain('gone.parquet')
    })
  })
})
