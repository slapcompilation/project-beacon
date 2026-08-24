// Catalog hygiene, re-asked on every CI run.
//
// Migration 487 asserted both floors once, at landing — applied migrations
// run once, so a floor asserted there cannot catch what accrues after it.
// These are the standing versions: the 2026-08-13 gap run found thirteen
// uncommented tables and twelve unindexed foreign keys that had accrued
// since 464 retired the original list.

import pg from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { noDb, connect, rollback } from './harness'

describe.skipIf(noDb)('catalog hygiene', () => {
  let db: pg.Client

  beforeAll(async () => { db = await connect() })
  afterAll(async () => { await rollback(db) })

  it('every public table says what it holds', async () => {
    const { rows } = await db.query(`
      select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and obj_description(c.oid, 'pg_class') is null
       order by c.relname`)
    expect(rows.map((r) => (r as { relname: string }).relname)).toEqual([])
  })

  // 487 proved every table HAS a comment. Nothing can prove a comment is
  // TRUE — but the teardown deleted a specific vocabulary, and its
  // reappearance is checkable. Five comments still described the old product
  // (hotels, @beacon/reality-graph, "Studio P") until the 2026-08-13 gap run.
  // Widened by 658's sweep: the census read TABLE comments alone, and three
  // pre-teardown comments survived on a column and two functions — including
  // auth_org_id(), the helper every policy calls. Every catalog that can hold
  // a comment is now in the haystack.
  it('no comment still describes the pre-teardown product', async () => {
    const { rows } = await db.query(`
      select what from (
        select 'table ' || c.relname as what, obj_description(c.oid, 'pg_class') as d
          from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        union all
        select 'column ' || c.relname || '.' || a.attname, col_description(c.oid, a.attnum)
          from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
         where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        union all
        select 'function ' || p.proname, obj_description(p.oid, 'pg_proc')
          from pg_proc p where p.pronamespace = 'public'::regnamespace
        union all
        select 'constraint ' || t.conname, obj_description(t.oid, 'pg_constraint')
          from pg_constraint t where t.connamespace = 'public'::regnamespace
      ) x where d ~* '(hotel|reality-graph|Studio P)'
      order by what`)
    expect(rows.map((r) => (r as { what: string }).what)).toEqual([])
  })

  it('every foreign key has an index on its leading column', async () => {
    const { rows } = await db.query(`
      select c.conrelid::regclass::text || '.' || a.attname as fk
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
         and not exists (
           select 1 from pg_index i
            where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
       order by 1`)
    expect(rows.map((r) => (r as { fk: string }).fk)).toEqual([])
  })
})
