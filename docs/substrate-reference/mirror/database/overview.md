<!-- source: https://supabase.com/docs/guides/database/overview · mirrored 2026-08-13 from Supabase docs -->

# Database

Use Supabase to connect, manage, and secure your Postgres database.

Every Supabase project gets a full [Postgres](https://www.postgresql.org/) database, not a Postgres abstraction. This database is the foundation that Auth, Storage, Realtime, and Edge Functions are built on, and Supabase manages daily database backups and offers point-in-time recovery on paid plans.

Work with your project's database in the following ways:

- Visually using the [**Table Editor**](https://supabase.com/dashboard/project/_/editor) section of the Dashboard.
- With query syntax using the [**SQL Editor**](https://supabase.com/dashboard/project/_/sql) section of the Dashboard.
- Programmatically using a variety of different methods.

## Get started

If you're new to the database section, these are the pages to read first:

- **[Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres):** Connection strings, the Supavisor connection pooler, and when to use direct, transaction, or session mode.
- **[Tables and data](https://supabase.com/docs/guides/database/tables):** Create tables and relationships, and edit rows from the Dashboard.
- **[Import data](https://supabase.com/docs/guides/database/import-data):** Load existing data from CSV files, `pg_dump`, or another Postgres database.
- **[Secure your data](https://supabase.com/docs/guides/database/secure-data):** Row Level Security (RLS) is how Supabase makes the database safe to query directly from the client. Read this before exposing any table to your app.
- **[Extensions](https://supabase.com/docs/guides/database/extensions):** Add Postgres extensions from the Dashboard, including `pgvector` for embeddings, `PostGIS` for geospatial data, and `pg_cron` for scheduled jobs.
- **[Run SQL commands](https://supabase.com/dashboard/project/_/sql):** Use the Dashboard's SQL Editor for ad-hoc queries and saved snippets.

## Next steps

Once you've covered the basics, these guides help with other use cases and features:

- **[Database functions](https://supabase.com/docs/guides/database/functions):** Run logic inside the database in response to inserts, updates, or deletes.
- **[Triggers](https://supabase.com/docs/guides/database/postgres/triggers):** Run logic inside the database in response to inserts, updates, or deletes.
- **[Database webhooks](https://supabase.com/docs/guides/database/webhooks):** Send row changes to an external HTTP endpoint.
- **[Replication and read replicas](https://supabase.com/docs/guides/database/replication):** Stream changes to other systems or read from a geographically closer replica.
- **[Backups](https://supabase.com/docs/guides/platform/backups):** Daily backups on every project, with point-in-time recovery on paid plans. Backups cover the database itself; objects stored through the Storage API are not included.
- **[Query performance and optimization](https://supabase.com/docs/guides/database/query-optimization):** Indexes, the query planner, and tools for finding slow queries.
- **[Roles and permissions](https://supabase.com/docs/guides/database/postgres/roles):** The Postgres roles Supabase ships with and how to add your own.
- **[Deployment & Branching](https://supabase.com/docs/guides/deployment):** Preview environments, branching, migrations, and production readiness for your database changes.
