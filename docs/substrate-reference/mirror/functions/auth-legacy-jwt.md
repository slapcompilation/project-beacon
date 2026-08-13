<!-- source: https://supabase.com/docs/guides/functions/auth-legacy-jwt · mirrored 2026-08-13 from Supabase docs -->

# Integrating With Supabase Auth

Integrate Supabase Auth with Edge Functions

Supabase Edge Functions and Auth.

Edge Functions work with [Supabase Auth](https://supabase.com/docs/guides/auth).

This allows you to:

- Automatically identify users through Legacy JWT tokens
- Enforce Row Level Security policies
- Integrate with your existing auth flow

## Setting up auth context

When a user makes a request to an Edge Function, you can use the `Authorization` header to set the Auth context in the Supabase client and enforce Row Level Security policies.

```js
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    // Create client with Auth context of the user that called the function.
    // This way your row-level-security (RLS) policies are applied.
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );

  //...
})
```

Note: This context setting happens in the `Deno.serve()` callback argument, so that the `Authorization` header is set for each individual request scope.

***

## Fetching the user

By getting the JWT from the `Authorization` header, you can provide the token to `getUser()` to fetch the user object to obtain metadata for the logged in user.

```js
Deno.serve(async (req: Request) => {
  // ...
  const authHeader = req.headers.get('Authorization')!
  const token = authHeader.replace('Bearer ', '')
  const { data } = await supabaseClient.auth.getUser(token)
  // ...
})
```

***

## Row Level Security

After initializing a Supabase client with the Auth context, all queries will be executed with the context of the user. For database queries, this means [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) will be enforced.

```js
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // ...
  // This query respects RLS - users only see rows they have access to
  const { data, error } = await supabaseClient.from('profiles').select('*');

  if (error) {
    return new Response('Database error', { status: 500 })
  }

  // ...
})
```

***

## Example

See the full [example on GitHub](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/select-from-table-with-auth-rls/index.ts).

