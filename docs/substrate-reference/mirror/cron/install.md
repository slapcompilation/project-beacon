<!-- source: https://supabase.com/docs/guides/cron/install · mirrored 2026-08-13 from Supabase docs -->

# Install

Install the Supabase Cron Postgres Module to begin scheduling recurring Jobs.

**Dashboard**

1. Go to the [Cron Postgres Module](https://supabase.com/dashboard/project/_/integrations/cron/overview) under Integrations in the Dashboard.
2. Enable the `pg_cron` extension.

**SQL**

```sql
create extension pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
```

## Uninstall

Uninstall Supabase Cron by disabling the `pg_cron` extension:

```sql
drop extension if exists pg_cron;
```

Danger: Disabling the `pg_cron` extension will permanently delete all Jobs.
