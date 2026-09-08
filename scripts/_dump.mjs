import pg from 'pg'
import { connectionString, SSL } from './db-url.mjs'

const c = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await c.connect()

const names = process.argv.slice(2)
if (names.length) {
  const { rows } = await c.query(
    `select p.oid::regprocedure::text as sig, p.prosecdef, pg_get_functiondef(p.oid) as def
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname = any($1) order by p.proname`, [names])
  for (const r of rows) { console.log(`\n===== ${r.sig}  SECDEF=${r.prosecdef} =====`); console.log(r.def) }
} else {
  // callers of restricted_view_predicate across all function bodies
  const { rows } = await c.query(
    `select n.nspname||'.'||p.oid::regprocedure::text as sig, p.prosecdef,
            (select count(*) from regexp_matches(p.prosrc,'restricted_view_predicate','g')) as hits
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.prosrc like '%restricted_view_predicate%' order by 1`)
  console.table(rows)
}
await c.end()
