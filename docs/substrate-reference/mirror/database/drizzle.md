<!-- source: https://supabase.com/docs/guides/database/drizzle · mirrored 2026-08-13 from Supabase docs -->

# Drizzle

Drizzle Quickstart

## Connecting with Drizzle

[Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) is a TypeScript ORM for SQL databases designed with maximum type safety in mind. You can use their ORM to connect to your database.

Note: If you plan on solely using Drizzle instead of the Supabase Data API (PostgREST), you can turn off the latter in the [API Settings](https://supabase.com/dashboard/project/_/settings/api).

1. **Install**

Install Drizzle and related dependencies.

```shell
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

2. **Create your models**

Create a `schema.ts` file and define your models.

```ts schema.ts
import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name'),
  phone: varchar('phone', { length: 256 }),
});
```

3. **Connect**

Connect to your database using the Connection Pooler.

From the project  [**Connect** panel](https://supabase.com/dashboard/project/_?showConnect=true), copy the URI from the "Shared Pooler" option and save it as the `DATABASE_URL` environment variable. Remember to replace the password placeholder with your actual database password.

In local SUPABASE\_DB\_URL require to be adapted to work with Docker resolver

```ts db.ts
import 'dotenv/config'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

let connectionString = databaseUrl
if (connectionString.includes('postgres:postgres@supabase_db_')) {
  const url = new URL(connectionString)
  url.hostname = url.hostname.split('_')[1]
  connectionString = url.href
}

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client)
```
