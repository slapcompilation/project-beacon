<!-- source: https://supabase.com/docs/guides/database/postgres/which-version-of-postgres · mirrored 2026-08-13 from Supabase docs -->

# Print Postgres version

Useful snippet for finding out which version of postgres you are running

It's important to know which version of Postgres you are running as each major version has different features and may cause breaking changes. You may also need to update your schema when [upgrading](https://www.postgresql.org/docs/current/pgupgrade.html) or downgrading to a major Postgres version.

Run the following query using the [SQL Editor](https://supabase.com/dashboard/project/_/sql) in the Supabase Dashboard:

```sql
select
  version();
```

Which should return something like:

```sql
PostgreSQL 15.1 on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 10.3.0-1ubuntu1~20.04) 10.3.0, 64-bit
```

This query can also be executed via `psql` or any other query editor if you prefer to [connect directly to the database](https://supabase.com/docs/guides/database/connecting-to-postgres#direct-connections).
