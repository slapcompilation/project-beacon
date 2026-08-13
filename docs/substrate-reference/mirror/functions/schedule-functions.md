<!-- source: https://supabase.com/docs/guides/functions/schedule-functions · mirrored 2026-08-13 from Supabase docs -->

# Scheduling Edge Functions

Schedule Edge Functions with pg_cron.



The hosted Supabase Platform supports the [`pg_cron` extension](https://supabase.com/docs/guides/database/extensions/pg_cron), a recurring job scheduler in Postgres.

In combination with the [`pg_net` extension](https://supabase.com/docs/guides/database/extensions/pg_net), this allows us to invoke Edge Functions periodically on a set schedule.

Caution: To access the auth token securely for your Edge Function call, we recommend storing them in [Supabase Vault](https://supabase.com/docs/guides/database/vault).

## Examples

### Invoke an Edge Function every minute

Store `project_url` and `publishable_key` in Supabase Vault:

```sql
select vault.create_secret('https://project-ref.supabase.co', 'project_url');
select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_KEY', 'publishable_key');
```

Make a POST request to a Supabase Edge Function every minute:

```sql
select
  cron.schedule(
    'invoke-function-every-minute',
    '* * * * *', -- every minute
    $$
    select
      net.http_post(
          url:= (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/function-name',
          headers:=jsonb_build_object(
            'Content-type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
          ),
          body:=concat('{"time": "', now(), '"}')::jsonb
      ) as request_id;
    $$
  );
```

## Resources

- [`pg_net` extension](https://supabase.com/docs/guides/database/extensions/pg_net)
- [`pg_cron` extension](https://supabase.com/docs/guides/database/extensions/pg_cron)
