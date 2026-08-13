<!-- source: https://supabase.com/docs/guides/functions/connect-to-postgres · mirrored 2026-08-13 from Supabase docs -->

# Integrating with Supabase Database (Postgres)

Connect to your Postgres database from Edge Functions.

Connecting to Postgres from Edge Functions.

Connect to your Postgres database from an Edge Function by using the `supabase-js` client.
You can also use other Postgres clients like [Deno Postgres](https://deno.land/x/postgres)

***

## Using supabase-js

The [`withSupabase`](https://supabase.com/docs/guides/functions/auth) wrapper from `@supabase/server` hands you a `supabase-js` client (`ctx.supabase`) already scoped to the caller's Row Level Security policies, so you don't manage keys or authorization headers yourself. It also provides `ctx.supabaseAdmin` for privileged operations that bypass Row Level Security. Responses are automatically formatted as JSON. This is the recommended approach for most applications:

```ts index.ts
import { withSupabase } from 'npm:@supabase/server@^1'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      // ctx.supabase respects the caller's RLS policies.
      // ctx.supabaseAdmin bypasses RLS for privileged operations.
      const { data, error } = await ctx.supabase.from('countries').select('*')

      if (error) {
        throw error
      }

      return Response.json({ data })
    } catch (err) {
      return Response.json({ error: String(err?.message ?? err) }, { status: 500 })
    }
  }),
}
```

This enables:

- Automatic Row Level Security enforcement
- Built-in JSON serialization
- Consistent error handling
- TypeScript support for database schema

***

## Using a Postgres client

Because Edge Functions are a server-side technology, it's safe to connect directly to your database using any popular Postgres client. This means you can run raw SQL from your Edge Functions.

Here is how you can connect to the database using Deno Postgres driver and run raw SQL. Check out the [full example](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/postgres-on-the-edge).



***

## Using Drizzle

You can use Drizzle together with [Postgres.js](https://github.com/porsager/postgres). Both can be loaded directly from npm.

Declare the dependencies in a `deno.json` file inside the function directory (see [Managing functions dependencies](https://supabase.com/docs/guides/functions/dependencies) for more details):



Then define your schema and query the database:





You can find the full example on [GitHub](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/drizzle).

***

## SSL connections

### Production

Deployed edge functions are pre-configured to use SSL for connections to the Supabase database. You don't need to add any extra configurations.

### Local development

If you want to use SSL connections during local development, follow these steps:

1. Download the SSL certificate from [Database Settings](https://supabase.com/dashboard/project/_/database/settings)
2. Add to your [local .env file](https://supabase.com/docs/guides/functions/secrets), add these two variables:

```bash
SSL_CERT_FILE=/path/to/cert.crt # set the path to the downloaded cert
DENO_TLS_CA_STORE=mozilla,system
```

Then, restart your local development server:

```bash
supabase functions serve your-function
```
