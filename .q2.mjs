import fs from 'node:fs'
import pg from 'pg'
import { connectionString, SSL } from './scripts/db-url.mjs'
const c = new pg.Client({ connectionString: connectionString(), ssl: SSL })
await c.connect()
const r = await c.query(fs.readFileSync(process.argv[2], 'utf8'))
for (const row of r.rows) console.log(Object.values(row).join('\n'))
await c.end()
