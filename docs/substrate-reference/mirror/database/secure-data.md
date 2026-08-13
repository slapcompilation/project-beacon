<!-- source: https://supabase.com/docs/guides/database/secure-data · mirrored 2026-08-13 from Supabase docs -->

# Securing your data

Supabase helps you control access to your data. With access policies, you can protect sensitive data and make sure users only access what they're allowed to see.

## Connecting your app securely

Supabase gives you several ways to access your data. Each option has a different security model:

### Data API

Use Supabase client libraries, REST, or GraphQL with a publishable key. Protect exposed tables with [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) (RLS) and grant only the privileges each role needs.

### Edge Functions

Put custom server-side logic between your client and database with [Edge Functions](https://supabase.com/docs/guides/functions). You can use secrets, API keys, or database connection strings inside the function, and you can [disable the Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api) if your app only accesses data this way.

### Direct database connections

Connect to Postgres with a connection string from trusted servers, workers, or tools. Keep database credentials secret and use the right [connection method](https://supabase.com/docs/guides/database/connecting-to-postgres) for your environment. You can [disable the Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api) if your app only uses direct connections.

## Frontend access

For frontend apps, the Data API is the usual choice. You can keep your data secure while accessing it from the frontend, so long as you:

- Turn on [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) (RLS) for your tables and properly configure your access policies to grant the least privileges necessary for your app to function
- Use your Supabase **publishable key** when you create a Supabase client

Your publishable key is safe to expose with RLS enabled, because row access permission is checked against your access policies and the user's [JSON Web Token (JWT)](https://supabase.com/docs/learn/auth-deep-dive/auth-deep-dive-jwts). The JWT is automatically sent by the Supabase client libraries if the user is logged in using Supabase Auth.

Older projects may also show an `anon` key. Treat it like a publishable key: it can identify your project, but it is not a secret and must be paired with RLS and least-privilege grants.

Danger: Unlike your publishable key, your secret and service role keys are **never** safe to expose because they bypass RLS. Only use your secret and service role keys on the backend. Treat them as secrets (for example, import them as sensitive environment variables instead of hardcoding them).

## More information

Supabase and Postgres provide you with multiple ways to manage security, including but not limited to Row Level Security. See the Access and Security pages for more information:

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Managing Postgres roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Managing secrets with Vault](https://supabase.com/docs/guides/database/vault)
