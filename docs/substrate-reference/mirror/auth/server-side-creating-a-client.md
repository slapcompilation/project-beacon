<!-- source: https://supabase.com/docs/guides/auth/server-side/creating-a-client · mirrored 2026-08-13 from Supabase docs -->

# Creating a Supabase client for SSR

Configure your Supabase client to use cookies

To use Server-Side Rendering (SSR) with Supabase, you need to configure your Supabase client to use cookies. The `@supabase/ssr` package helps you do this for JavaScript/TypeScript applications.

## Install

Install the `@supabase/supabase-js` and `@supabase/ssr` helper packages:

**npm**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**yarn**

```bash
yarn add @supabase/supabase-js @supabase/ssr
```

**pnpm**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

## Set environment variables

Create a `.env.local` file in the project root directory. In the file, set the project's Supabase URL and Key:

### Get API details

To interact with data in database tables, you use the client libraries that wrap [the auto-generated Data API endpoints](https://supabase.com/docs/guides/api), authenticating using the Project URL and key from [the project **Connect** dialog](https://supabase.com/dashboard/project/_?showConnect=true\&connectTab=frameworks\&framework=nextjs).





Note: [Read the API keys docs](https://supabase.com/docs/guides/getting-started/api-keys) for a full explanation of all key types, their uses, and where to find them.

**Next.js**

```bash .env.local
NEXT_PUBLIC_SUPABASE_URL=supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

**SvelteKit**

```bash .env.local
PUBLIC_SUPABASE_URL=supabase_project_url
PUBLIC_SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

**Astro**

```bash .env
PUBLIC_SUPABASE_URL=supabase_project_url
PUBLIC_SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

**Remix**

```bash .env
SUPABASE_URL=supabase_project_url
SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

**Nuxt**

```bash .env
NUXT_PUBLIC_SUPABASE_URL=supabase_project_url
NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

In `nuxt.config.ts`, map these public env vars into runtime config keys used by the examples below:

```ts nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      // These defaults will be overridden by NUXT_PUBLIC_SUPABASE_URL and
      // NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables at runtime.
      supabaseUrl: '',
      supabasePublishableKey: '',
    },
  },
})
```

**React Router**

```bash .env
SUPABASE_URL=supabase_project_url
SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

**Express**

```bash .env
SUPABASE_URL=supabase_project_url
SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

Install [dotenv](https://www.npmjs.com/package/dotenv):

```bash
npm i dotenv
```

And initialize it:

**npm**

```bash
npm install dotenv
```

**yarn**

```bash
yarn add dotenv
```

**pnpm**

```bash
pnpm add dotenv
```

**Hono**

```bash .env
SUPABASE_URL=supabase_project_url
SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

**TanStack Start**

```bash .env.local
VITE_SUPABASE_URL=supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=supabase_publishable_key
```

## Create a client

You need setup code to configure a Supabase client to use cookies. Once you have the utility code, you can use the `createClient` utility functions to get a properly configured Supabase client.

Use the browser client in code that runs on the browser, and the server client in code that runs on the server.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods

- Use [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
- [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
- [`getSession`](https://supabase.com/docs/reference/javascript/auth-getsession) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.

**In summary**: use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

**Next.js**

### Write utility functions to create Supabase clients

To access Supabase from a Next.js app, you need 2 types of Supabase clients:

1. **Client Component client** - To access Supabase from Client Components, which run in the browser.
2. **Server Component client** - To access Supabase from Server Components, Server Actions, and Route Handlers, which run only on the server.

Since Next.js Server Components can't write cookies, you need a [Proxy](https://nextjs.org/docs/app/getting-started/proxy) to refresh expired Auth tokens and store them.

The Proxy is responsible for:

1. Refreshing the Auth token by calling `supabase.auth.getClaims()`.
2. Passing the refreshed Auth token to Server Components, so they don't attempt to refresh the same token themselves. This is accomplished with `request.cookies.set`.
3. Passing the refreshed Auth token to the browser, so it replaces the old token. This is accomplished with `response.cookies.set`.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods

- Use [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
- [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
- [`getSession`](https://supabase.com/docs/reference/javascript/auth-getsession) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.

**In summary**: use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

**What does the `cookies` object do?**

The cookies object lets the Supabase client know how to access the cookies, so it can read and write the user session data. To make `@supabase/ssr` framework-agnostic, the cookies methods aren't hard-coded. These utility functions adapt `@supabase/ssr`'s cookie handling for Next.js.

`setAll` is called whenever the library needs to write cookies, for example after a token refresh. It receives two arguments: the array of cookies to set, and a `headers` object containing cache headers (`Cache-Control`, `Expires`, `Pragma`) that must be applied to the HTTP response to prevent CDNs from caching the response and leaking the session to other users. In the Proxy, apply these headers to the response. In Server Components, the headers cannot be set, which is why the `setAll` call is wrapped in a try/catch and the error is ignored. The Proxy handles writing cookies and headers on every request.

The cookie is named `sb-<project_ref>-auth-token` by default.

**Do I need to create a new client for every route?**

Yes! Creating a Supabase client is lightweight.

- On the server, it basically configures a `fetch` call. You need to reconfigure the fetch call anew for every request to your server, because you need the cookies from the request.
- On the client, `createBrowserClient` already uses a singleton pattern, so you only ever create one instance, no matter how many times you call your `createClient` function.

Create a `lib/supabase` folder at the root of your project, or inside the `./src` folder if you are using one, with a file for each type of client. Then copy the lib utility functions for each client type.



### Hook up proxy

The code adds a [matcher](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher) so the Proxy doesn't run on routes that don't access Supabase.

Danger: Be careful when protecting pages. The server gets the user session from the cookies, which can be spoofed by anyone.

Always use `supabase.auth.getClaims()` to protect pages and user data.

*Never* trust `supabase.auth.getSession()` inside server code such as Proxy. It isn't guaranteed to revalidate the Auth token.

It's safe to trust `getClaims()` because it validates the JWT signature against the project's published public keys every time.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods

- Use [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
- [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
- [`getSession`](https://supabase.com/docs/reference/javascript/auth-getsession) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.

**In summary**: use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.



## Congratulations

You're done! To recap, you've successfully:

- Called Supabase from a Server Action.
- Called Supabase from a Server Component.
- Set up a Supabase client utility to call Supabase from a Client Component. You can use this if you need to call Supabase from a Client Component, for example to set up a realtime subscription.
- Set up Proxy to automatically refresh the Supabase Auth session.

You can now use any Supabase features from your client or server code!

**SvelteKit**

### Set up server-side hooks

Set up server-side hooks in `src/hooks.server.ts`. The hooks:

- Create a request-specific Supabase client, using the user credentials from the request cookie. This client is used for server-only code.
- Check user authentication.
- Guard protected pages.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods

- Use [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
- [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
- [`getSession`](https://supabase.com/docs/reference/javascript/auth-getsession) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.

**In summary**: use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.



To prevent TypeScript errors, add type definitions for the new event.locals properties.



### Create a Supabase client in your root layout

Create a Supabase client in your root `+layout.ts`. This client can be used to access Supabase from the client or the server. In order to get access to the Auth token on the server, use a `+layout.server.ts` file to pass in the session from event.locals.

Page components can access the Supabase client from the `data` object using the `load` function.



## Congratulations

You're done! To recap, you've successfully:

- Set up server-side hooks to create a request-specific Supabase client and guard protected pages.
- Created a Supabase client in your root layout to use on both the client and server.

You can now use any Supabase features from your client or server code!

**Astro**

By default, Astro apps are static. This means the requests for data happen at build time, rather than when the user requests a page. At build time, there is no user, session or cookies. Therefore, we need to configure Astro for Server-side Rendering (SSR) if you want data to be fetched dynamically per request.

```js astro.config.mjs
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'server',
})
```

**Server**

```ts index.astro
---
import { createServerClient, parseCookieHeader } from "@supabase/ssr";

const supabase = createServerClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll() {
        return parseCookieHeader(Astro.request.headers.get('Cookie') ?? '')
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          Astro.cookies.set(name, value))
        Object.entries(headers).forEach(([key, value]) =>
          Astro.response.headers.set(key, value)
        )
      },
    },
  }
);
---
```

**Browser**

```html index.astro
<script>
  import { createBrowserClient } from "@supabase/ssr";

  const supabase = createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
</script>
```

**Server Endpoint**

```ts route.ts
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(context.request.headers.get('Cookie') ?? '')
        },
        setAll(cookiesToSet, _headers) {
          cookiesToSet.forEach(({ name, value }) =>
            context.cookies.set(name, value))
        },
      },
    }
  );

  return ...
}
```

**Middleware**

```ts middleware.ts
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(context.request.headers.get('Cookie') ?? '')
        },
        setAll(cookiesToSet, _headers) {
          cookiesToSet.forEach(({ name, value }) => context.cookies.set(name, value))
        },
      },
    }
  )

  return next()
})
```

## Congratulations

You can now use any Supabase features from your client or server code!

**Remix**

With Remix, in a route module such as `_index.tsx`, you can export a `loader`, an `action`, and a default component.

Configure Supabase clients as follows:

1. **Create a server client in the `loader`.** Use it to load data and manage the user session on the server. Return your Supabase URL and publishable key so the browser can create a client.
2. **Create a server client in the `action`.** Use it to handle form submissions and other mutations on the server.
3. **Create a browser client in the default component.** Call `useLoaderData` to read the URL and key, then call `createBrowserClient`.

The following example shows all three exports in one route module:

```ts _index.tsx
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import {
  createBrowserClient,
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr'

// Server: load data and manage the user's session.
export async function loader({ request }: LoaderFunctionArgs) {
  const responseHeaders = new Headers()

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '')
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value, options }) =>
            responseHeaders.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
          Object.entries(cacheHeaders).forEach(([key, value]) => responseHeaders.set(key, value))
        },
      },
    }
  )

  // Use `supabase` here for server-side work, e.g. await supabase.auth.getClaims()

  // Return the environment variables so the browser can create its own client.
  return json(
    {
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL!,
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY!,
      },
    },
    { headers: responseHeaders }
  )
}

// Server: handle form submissions and mutations.
export async function action({ request }: ActionFunctionArgs) {
  const responseHeaders = new Headers()

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '')
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value, options }) =>
            responseHeaders.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
          Object.entries(cacheHeaders).forEach(([key, value]) => responseHeaders.set(key, value))
        },
      },
    }
  )

  return json(null, { headers: responseHeaders })
}

// Browser: create a client using the env vars returned by the loader.
export default function Index() {
  const { env } = useLoaderData<typeof loader>()

  const supabase = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY)

  return <div>...</div>
}
```

## Congratulations

You can now use any Supabase features from your client or server code!

**Nuxt**

**Server route**

```ts server/api/hello.ts
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { appendHeader, defineEventHandler, getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const supabase = createServerClient(
    config.public.supabaseUrl,
    config.public.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(getHeader(event, 'Cookie') ?? '')
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            appendHeader(event, 'Set-Cookie', serializeCookieHeader(name, value, options))
          })
        },
      },
    }
  )

  await supabase.auth.getClaims()

  return { ok: true }
})
```

**Browser plugin**

```ts plugins/supabase.client.ts
import { createBrowserClient } from '@supabase/ssr'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const supabase = createBrowserClient(
    config.public.supabaseUrl,
    config.public.supabasePublishableKey
  )

  return {
    provide: {
      supabase,
    },
  }
})
```

## Congratulations

You can now use any Supabase features from your client or server code!

**React Router**

In React Router, a route module (`_index.tsx`) can export a `loader`, an `action`, and a default component. Create a server client inside the `loader` and `action`, and a browser client inside the component, passing the env vars through the `loader`.

```ts _index.tsx
import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { useLoaderData } from 'react-router'
import {
  createBrowserClient,
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr'

// Server: load data and manage the user's session.
export async function loader({ request }: LoaderFunctionArgs) {
  const responseHeaders = new Headers()

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '')
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value, options }) =>
            responseHeaders.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
          Object.entries(cacheHeaders).forEach(([key, value]) => responseHeaders.set(key, value))
        },
      },
    }
  )

  // Use `supabase` here for server-side work, e.g. await supabase.auth.getClaims()

  // Return the env vars so the browser can create its own client.
  return data(
    {
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL!,
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY!,
      },
    },
    { headers: responseHeaders }
  )
}

// Server: handle form submissions and mutations.
export async function action({ request }: ActionFunctionArgs) {
  const responseHeaders = new Headers()

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '')
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value, options }) =>
            responseHeaders.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
          Object.entries(cacheHeaders).forEach(([key, value]) => responseHeaders.set(key, value))
        },
      },
    }
  )

  return data(null, { headers: responseHeaders })
}

// Browser: create a client using the env vars returned by the loader.
export default function Index() {
  const { env } = useLoaderData<typeof loader>()

  const supabase = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY)

  return <div>...</div>
}
```

## Congratulations

You can now use any Supabase features from your client or server code!

**Express**

**Server Client**

```ts lib/supabase.js
const { createServerClient, parseCookieHeader, serializeCookieHeader } = require('@supabase/ssr')

exports.createClient = (context) => {
  return createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.req.headers.cookie ?? '')
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          context.res.appendHeader('Set-Cookie', serializeCookieHeader(name, value))
        )
        Object.entries(headers).forEach(([key, value]) => context.res.setHeader(key, value))
      },
    },
  })
}
```

**Route**

```ts app.js
const express = require("express")
const dotenv = require("dotenv")

const { createClient } = require("./lib/supabase")

const app = express()

app.post("/hello-world", async function (req, res, next) {
  const { email, emailConfirm } = req.body
  ...

  const supabase = createClient({ req, res })
})
```

## Congratulations

You can now use any Supabase features from your client or server code!

**Hono**

**Server Client**

Create a Hono middleware that creates a Supabase client.

**Route**

You can now use this middleware in your Hono application to create a server Supabase client that can be used to make authenticated requests.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods

- Use [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
- [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
- [`getSession`](https://supabase.com/docs/reference/javascript/auth-getsession) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.

**In summary**: use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

**TanStack Start**

### Write utility functions to create Supabase clients

TanStack Start renders matched routes on the server by default, so `beforeLoad` and `loader` run server-side on the initial request. Unlike Next.js, this means you don't need a proxy or middleware layer to keep sessions fresh — the server client reads and writes the session cookie directly on each request.

Create a `lib/supabase` folder at the root of your project, or inside the `./src` folder if you are using one, then add a file for each type of client:

1. **Create a browser client in `lib/supabase/client.ts`.** Use it to access Supabase from components that run in the browser.
2. **Create a server client in `lib/supabase/server.ts`.** Use it to access Supabase from loaders, server functions, and other code that runs only on the server.

The Supabase Auth SDK contains three different functions for authenticating user access to applications:

### Summary of the methods

- Use [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims) to protect pages and user data. It reads the access token from storage and verifies it. Locally via the [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) and a cached JWKS endpoint when the project uses asymmetric signing keys (the default for new projects), or by calling `getUser` solely to validate when symmetric keys are in use. The returned claims always come from decoding the JWT, not from a user lookup.
- [`getUser`](https://supabase.com/docs/reference/javascript/auth-getuser) makes a network call to the project's Auth instance to get the user record, which includes the most up-to-date information about the user at the cost of a network call.
- [`getSession`](https://supabase.com/docs/reference/javascript/auth-getsession) when you need the raw session (the access token, refresh token, and expiry). For example to forward the access token to another service. The session is loaded directly from local storage and isn't re-validated against the Auth server, so the embedded user object shouldn't be trusted on its own when storage is shared with the client (cookies, request headers). To verify identity, validate the access token with `getClaims`, or call `getUser` for a fresh, server-confirmed user record.

**In summary**: use `getClaims` to verify identity (typically for protecting pages and data), `getUser` when you need an up-to-date user record from the Auth server, and `getSession` when you need the access or refresh token directly, but don't rely on the user object it returns for authorization decisions.

Copy the lib utility functions below into each file:



### Protecting routes

TanStack Start has no global middleware layer, so protect each route explicitly.

To protect your routes:

1. Write a server function, `fetchClaims`, that calls `supabase.auth.getClaims()` and returns the claims, or `null` if the session isn't valid.
2. Call `fetchClaims` from a layout route's `beforeLoad` hook — for example, `_protected.tsx` — before any nested route renders, and redirect to `/login` when it returns `null`.

Danger: Skipping the check inside the server function exposes private data to unauthenticated users. `beforeLoad` runs on the server for the initial request and on the client for later navigation, but either way it only gates the route's render — it doesn't stop the server function from being called directly. Because there's no proxy re-checking every request, the server function is the only checkpoint that always runs, so it must call `supabase.auth.getClaims()` to authorize the request itself.

`getClaims()` validates the JWT signature on every call, the same check the Next.js Proxy relies on. Calling it inside the server function gives TanStack Start's per-route check that same guarantee, because the function runs on every request to a protected route.



Any other server function that returns or mutates private data needs this same check. Don't rely on a route being nested under `_protected` alone.

## Congratulations

You're done! To recap, you've successfully:

- Set up a Supabase client utility to call Supabase from a browser component. You can use this if you need to call Supabase from the browser, for example to set up a realtime subscription.
- Set up a server client utility to call Supabase from loaders and server functions.
- Protected a route with `beforeLoad`, backed by a server function that authorizes the request itself.

You can now use any Supabase features from your client or server code!

## Caching considerations

If your app uses ISR (Incremental Static Regeneration) or is deployed behind a CDN, caching of HTTP responses can cause users to receive another user's session. When a session is refreshed, the new token is written to the response via `Set-Cookie`. If that response is cached and served to a different user, that user will be signed in as the wrong person.

See the [advanced Auth server-side rendering guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide#can-i-use-server-side-rendering-with-a-cdn-or-cache) for details and framework-specific examples.

## Next steps

- Implement [Authentication using Email and Password](https://supabase.com/docs/guides/auth/passwords)
- Implement [Authentication using OAuth](https://supabase.com/docs/guides/auth/social-login)
- [Learn more about SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
