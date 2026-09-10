// Getting data in, checked against what the pages state.
//
// `dataset-preview/csv-parsing` prints an options table with defaults and three
// enumerated value sets; `dataset-preview/overview` states the rule that picks
// a transaction type; `api/datasets-resources-files-upload-file` publishes the
// path and branch-name refusals. Each of those is a printed answer, so the test
// is to run the engine and compare rather than to restate what it does.
//
// Reading: docs/foundry-reference/readings/ingestion.md.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback, fixture, refused, type Fixture } from './harness'

const NL = '\n'

describe.skipIf(noDb)('getting data in', () => {
  let db: pg.Client
  let f: Fixture
  let n = 0

  // Each upload scenario gets its own dataset: a schema belongs to a dataset,
  // so sharing one would make an earlier test decide a later test's answer.
  const freshDataset = async (): Promise<{ ds: string; br: string; table: string }> => {
    n += 1
    const slug = `ingest_${n}`
    const { rows: d } = await db.query(
      `insert into public.datasets (organization_id, project_id, api_name, name)
       values ($1,$2,$3,$3) returning id`, [f.orgId, f.projectId, slug])
    const { rows: b } = await db.query(
      `insert into public.dataset_branches (dataset_id, name) values ($1,'master') returning id`,
      [d[0].id])
    return { ds: d[0].id, br: b[0].id, table: slug }
  }

  const upload = async (
    ds: string, path: string, content: string,
    params: string | null = null, type: string | null = null,
  ): Promise<string> => {
    const { rows } = await db.query(
      `select public.upload_file_to_dataset($1::uuid,$2::text,$3::text,'master',$4::jsonb,$5::text) as t`,
      [ds, path, content, params, type])
    return rows[0].t as string
  }

  const txnType = async (t: string): Promise<string> => {
    const { rows } = await db.query(
      `select txn_type from public.dataset_transactions where id = $1`, [t])
    return rows[0].txn_type as string
  }

  const viewPaths = async (br: string): Promise<string[]> => {
    const { rows } = await db.query(
      `select logical_path from public.dataset_view($1) order by 1`, [br])
    return rows.map((r) => r.logical_path as string)
  }

  beforeAll(async () => {
    db = await connect()
    f = await fixture(db, 'platform_ingest')
  })
  afterAll(async () => { await rollback(db) })

  describe('the parse parameters the page stores in the schema', () => {
    it('defaults to what the options table prints', async () => {
      const { rows } = await db.query(`select public.csv_parser_defaults() as d`)
      // Both behaviour options default to throwing: the page's answer to a
      // malformed row is to fail loudly, not to null-fill.
      expect(rows[0].d).toEqual({
        parser: 'CSV_PARSER',
        nullValues: [],
        fieldDelimiter: ',',
        recordDelimiter: NL,
        quoteCharacter: '"',
        dateFormat: {},
        skipLines: 0,
        jaggedRowBehavior: 'THROW_EXCEPTION',
        parseErrorBehavior: 'THROW_EXCEPTION',
        addFilePath: false,
        addImportedAt: false,
        initialReadTimeout: '1 hour',
      })
    })

    const valid = async (j: string): Promise<boolean> => {
      const { rows } = await db.query(
        `select public.csv_parser_params_valid($1::jsonb) as v`, [j])
      return rows[0].v as boolean
    }

    it('requires the two options the table marks required', async () => {
      expect(await valid('{"nullValues":[]}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER"}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[]}')).toBe(true)
    })

    it('holds the three enumerated sets', async () => {
      for (const p of ['CSV_PARSER', 'MULTILINE_CSV_PARSER', 'SIMPLE_PARSER', 'SINGLE_COLUMN_PARSER']) {
        expect(await valid(`{"parser":"${p}","nullValues":[]}`)).toBe(true)
      }
      expect(await valid('{"parser":"SPARK","nullValues":[]}')).toBe(false)
      for (const j of ['THROW_EXCEPTION', 'DROP_ROW']) {
        expect(await valid(`{"parser":"CSV_PARSER","nullValues":[],"jaggedRowBehavior":"${j}"}`)).toBe(true)
      }
      for (const e of ['THROW_EXCEPTION', 'REPLACE_WITH_NULL']) {
        expect(await valid(`{"parser":"CSV_PARSER","nullValues":[],"parseErrorBehavior":"${e}"}`)).toBe(true)
      }
      // The two sets are not interchangeable, which a shared spelling invites.
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"parseErrorBehavior":"DROP_ROW"}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"jaggedRowBehavior":"REPLACE_WITH_NULL"}')).toBe(false)
    })

    it('refuses the two keys that are in the example JSON and not the table', async () => {
      // The same page carries both. The table enumerates the options, so it
      // decides the set; the JSON is one realistic instance.
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"charsetName":"UTF-8"}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"addFilePathInsteadOfUri":false}')).toBe(false)
    })

    it('holds the accepted-values shapes', async () => {
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"fieldDelimiter":"||"}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"quoteCharacter":"ab"}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"recordDelimiter":"X"}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[],"skipLines":-1}')).toBe(false)
      expect(await valid('{"parser":"CSV_PARSER","nullValues":[1]}')).toBe(false)
    })
  })

  describe('the tokeniser', () => {
    const rows = async (content: string, params?: string): Promise<string[][]> => {
      const { rows: r } = await db.query(
        `select x from public.csv_rows($1::text, coalesce($2::jsonb, public.csv_parser_defaults())) x`,
        [content, params ?? null])
      return r.map((row) => row.x as string[])
    }

    it('reads a quoted field holding the delimiter and a doubled quote', async () => {
      expect(await rows(`a,b${NL}1,"he said ""hi"", loudly"${NL}`))
        .toEqual([['a', 'b'], ['1', 'he said "hi", loudly']])
    })

    it('skips the number of lines it is told to', async () => {
      expect(await rows(`junk${NL}a,b${NL}1,2${NL}`,
        '{"parser":"CSV_PARSER","nullValues":[],"fieldDelimiter":",","quoteCharacter":"\\"","recordDelimiter":"\\n","skipLines":1}'))
        .toEqual([['a', 'b'], ['1', '2']])
    })

    it('keeps the last record when the file does not end in a newline', async () => {
      expect(await rows(`a,b${NL}1,2`)).toEqual([['a', 'b'], ['1', '2']])
    })

    it('treats a carriage return as part of the line ending, not the field', async () => {
      expect(await rows(`a,b\r${NL}1,2\r${NL}`)).toEqual([['a', 'b'], ['1', '2']])
    })

    it('keeps a jagged record jagged rather than squaring it off', async () => {
      // The record has to survive intact for jaggedRowBehavior to judge it.
      expect(await rows(`a,b${NL}1${NL}`)).toEqual([['a', 'b'], ['1']])
    })
  })

  describe('the transaction type an upload picks', () => {
    it('appends a filename it has not seen', async () => {
      const { ds } = await freshDataset()
      expect(await txnType(await upload(ds, 'crew.csv', `name,seats${NL}Ada,2${NL}`))).toBe('APPEND')
    })

    it('updates a filename it has seen with the same schema', async () => {
      const { ds } = await freshDataset()
      await upload(ds, 'crew.csv', `name,seats${NL}Ada,2${NL}`)
      expect(await txnType(await upload(ds, 'crew.csv', `name,seats${NL}Ada,2${NL}Kay,4${NL}`))).toBe('UPDATE')
    })

    it('refuses a filename it has seen with a different schema', async () => {
      // No page states this case. Guessing UPDATE would leave the table's
      // columns disagreeing with the file it now holds.
      const { ds } = await freshDataset()
      await upload(ds, 'crew.csv', `name,seats${NL}Ada,2${NL}`)
      const why = await refused(db, () => upload(ds, 'crew.csv', `name,seats,rank${NL}Ada,2,1${NL}`))
      expect(why).toContain('Datasets:UploadSchemaDiffers')
    })

    it('commits the transaction it opened', async () => {
      const { ds } = await freshDataset()
      const t = await upload(ds, 'crew.csv', `name,seats${NL}Ada,2${NL}`)
      const { rows } = await db.query(
        `select status from public.dataset_transactions where id = $1`, [t])
      expect(rows[0].status).toBe('COMMITTED')
    })
  })

  describe('what lands', () => {
    it('infers the narrowest type each column satisfies', async () => {
      const { ds } = await freshDataset()
      const t = await upload(ds, 'mix.csv',
        `s,n,d,b,dt${NL}x,1,1.5,true,2020-01-01${NL}y,2,2.5,false,2021-06-30${NL}`)
      const { rows } = await db.query(
        `select fields from public.dataset_schemas where transaction_id = $1`, [t])
      expect(rows[0].fields).toEqual([
        { name: 's', type: 'STRING' },
        { name: 'n', type: 'LONG' },
        { name: 'd', type: 'DOUBLE' },
        { name: 'b', type: 'BOOLEAN' },
        { name: 'dt', type: 'DATE' },
      ])
    })

    it('stores the parse parameters on the schema', async () => {
      // "These parameters are stored in the schema of a dataset."
      const { ds } = await freshDataset()
      const t = await upload(ds, 'crew.csv', `name,seats${NL}Ada,2${NL}`)
      const { rows } = await db.query(
        `select parser_params from public.dataset_schemas where transaction_id = $1`, [t])
      expect(rows[0].parser_params).not.toBeNull()
      expect(rows[0].parser_params.parser).toBe('CSV_PARSER')
    })

    it('writes the rows into the dataset own table', async () => {
      const { ds, table } = await freshDataset()
      await upload(ds, 'crew.csv', `name,seats${NL}Ada,2${NL}Kay,4${NL}`)
      const { rows } = await db.query(`select count(*)::int as c from datasets.${table}`)
      expect(rows[0].c).toBe(2)
    })

    it('turns a named null token into a real null', async () => {
      const { ds, table } = await freshDataset()
      await upload(ds, 'crew.csv', `name,seats${NL}Ada,NA${NL}`,
        '{"parser":"CSV_PARSER","nullValues":["NA"],"fieldDelimiter":",","quoteCharacter":"\\"","recordDelimiter":"\\n"}')
      const { rows } = await db.query(
        `select count(*)::int as c from datasets.${table} where seats is null`)
      expect(rows[0].c).toBe(1)
    })
  })

  describe('a jagged row', () => {
    it('throws, because that is the documented default', async () => {
      const { ds } = await freshDataset()
      const why = await refused(db, () => upload(ds, 'jag.csv', `name,seats${NL}Ada${NL}`))
      expect(why).toContain('Datasets:JaggedRow')
    })

    it('is dropped when the parameters say DROP_ROW', async () => {
      const { ds } = await freshDataset()
      const t = await upload(ds, 'jag.csv', `name,seats${NL}Ada${NL}Kay,4${NL}`,
        '{"parser":"CSV_PARSER","nullValues":[],"fieldDelimiter":",","quoteCharacter":"\\"","recordDelimiter":"\\n","jaggedRowBehavior":"DROP_ROW"}')
      const { rows } = await db.query(
        `select row_count from public.dataset_files where transaction_id = $1`, [t])
      expect(rows[0].row_count).toBe(1)
    })
  })

  describe('the refusals the api publishes', () => {
    it('refuses a path with a leading slash', async () => {
      const { ds } = await freshDataset()
      expect(await refused(db, () => upload(ds, '/abs.csv', `a${NL}1${NL}`)))
        .toContain('Datasets:InvalidFilePath')
    })

    it('refuses a branch named like a rid or a uuid', async () => {
      const { ds } = await freshDataset()
      for (const bad of ['ri.foundry.main.dataset.abc', '47516b65-f965-47b5-bab1-0a31901b641c']) {
        const why = await refused(db, () => db.query(
          `insert into public.dataset_branches (dataset_id, name) values ($1,$2)`, [ds, bad]))
        expect(why).toContain('dataset_branches_name_is_not_a_rid_or_uuid')
      }
    })

    it('holds one index for the one-open-transaction rule, not two', async () => {
      const { rows } = await db.query(
        `select indexname from pg_indexes
          where schemaname='public' and tablename='dataset_transactions'
            and indexdef like '%WHERE (status = ''OPEN''%'`)
      expect(rows.map((r) => r.indexname)).toEqual(['dataset_transactions_one_open_per_branch'])
    })

    it('refuses a file type no page describes', async () => {
      const { ds } = await freshDataset()
      expect(await refused(db, () => upload(ds, 'book.xlsx', `a${NL}1${NL}`)))
        .toContain('Datasets:UploadTypeNotBuilt')
    })
  })

  describe('the view an upload leaves behind', () => {
    it('adds to the view on an APPEND rather than replacing it', async () => {
      // The regression 791 fixed: every writer before the upload emitted
      // SNAPSHOT, which resets the view, so a transaction that never linked to
      // the branch head looked correct. An APPEND is the first write that can
      // tell the difference.
      const { ds, br } = await freshDataset()
      await upload(ds, 'a.csv', `name${NL}Ada${NL}`)
      await upload(ds, 'b.csv', `name${NL}Kay${NL}`)
      expect(await viewPaths(br)).toEqual(['a.csv', 'b.csv'])
    })

    it('links each transaction to the one it follows', async () => {
      const { ds } = await freshDataset()
      const t1 = await upload(ds, 'a.csv', `name${NL}Ada${NL}`)
      const t2 = await upload(ds, 'b.csv', `name${NL}Kay${NL}`)
      const { rows } = await db.query(
        `select parent_transaction_id from public.dataset_transactions where id = $1`, [t2])
      expect(rows[0].parent_transaction_id).toBe(t1)
    })

    it('links a transaction written by a direct insert too', async () => {
      // The five writers that predate this all insert the row themselves.
      const { ds, br } = await freshDataset()
      const t1 = await upload(ds, 'a.csv', `name${NL}Ada${NL}`)
      const { rows } = await db.query(
        `insert into public.dataset_transactions (dataset_id, branch_id, txn_type, status)
         values ($1,$2,'APPEND','OPEN') returning parent_transaction_id`, [ds, br])
      expect(rows[0].parent_transaction_id).toBe(t1)
      await db.query(`delete from public.dataset_transactions where branch_id=$1 and status='OPEN'`, [br])
    })

    it('keeps only the most recent version of a path', async () => {
      // "If the file already exists only the most recent version will be
      //  visible in the updated view."
      const { ds, br } = await freshDataset()
      await upload(ds, 'crew.csv', `name${NL}Ada${NL}`)
      await upload(ds, 'crew.csv', `name${NL}Ada${NL}Kay${NL}`)
      expect(await viewPaths(br)).toEqual(['crew.csv'])
      const { rows } = await db.query(
        `select sum(row_count)::int as c from public.dataset_view($1)`, [br])
      expect(rows[0].c).toBe(2)
    })

    it('replaces the view on a SNAPSHOT, which is why the gap stayed hidden', async () => {
      const { ds, br } = await freshDataset()
      await upload(ds, 'a.csv', `name${NL}Ada${NL}`)
      await upload(ds, 'b.csv', `name${NL}Kay${NL}`, null, 'SNAPSHOT')
      expect(await viewPaths(br)).toEqual(['b.csv'])
    })
  })
})
