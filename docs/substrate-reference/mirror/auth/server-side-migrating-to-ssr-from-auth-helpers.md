<!-- source: https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers · mirrored 2026-08-13 from Supabase docs -->

# Migrating to the SSR package from Auth Helpers

Step-by-step guide to migrating your app to the new SSR package

The new `ssr` package takes the core concepts of the Auth Helpers and makes them available to any server language or framework. This page will guide you through migrating from the Auth Helpers package to `ssr`.

## Replacing Supabase packages

**Next.js**

```bash
npm uninstall @supabase/auth-helpers-nextjs
```

**SvelteKit**

```bash
npm uninstall @supabase/auth-helpers-sveltekit
```

**Remix**

```bash
npm uninstall @supabase/auth-helpers-remix
```

```bash
npm install @supabase/ssr
```

## Creating a client

The new `ssr` package exports two functions for creating a Supabase client. The `createBrowserClient` function is used in the client, and the `createServerClient` function is used in the server.

Read the [Creating a client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) page for examples of creating a client in your framework [and our migration guide](https://supabase.com/docs/guides/troubleshooting/how-to-migrate-from-supabase-auth-helpers-to-ssr-package-5NRunM).

## Next steps

- Implement [Authentication using Email and Password](https://supabase.com/docs/guides/auth/passwords)
- Implement [Authentication using OAuth](https://supabase.com/docs/guides/auth/social-login)
- [Learn more about SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
