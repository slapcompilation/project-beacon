<!-- source: https://supabase.com/docs/guides/auth/social-login/auth-linkedin · mirrored 2026-08-13 from Supabase docs -->

# Login with LinkedIn

Add LinkedIn OAuth to your Supabase project

To enable LinkedIn Auth for your project, you need to set up a LinkedIn OAuth application and add the application credentials to your Supabase Dashboard.

## Overview

Setting up LinkedIn logins for your application consists of 3 parts:

- Create and configure a LinkedIn Project and App on the [LinkedIn Developer Dashboard](https://www.linkedin.com/developers/apps).
- Add your *LinkedIn (OIDC)* `client_id` and `client_secret` to your [Supabase Project](https://supabase.com/dashboard).
- Add the login code to your [Supabase JS Client App](https://github.com/supabase/supabase-js).

## Access your LinkedIn Developer account

- Go to [LinkedIn Developer Dashboard](https://www.linkedin.com/developers/apps).
- Log in (if necessary.)

![LinkedIn Developer Portal](/docs/img/guides/auth-linkedin/linkedin_developers_page.png)

## Find your callback URL

The next step requires a callback URL, which looks like this: `https://<project-ref>.supabase.co/auth/v1/callback`

- Go to your [Supabase Project Dashboard](https://supabase.com/dashboard)
- Click on the `Authentication` icon in the left sidebar
- Click on [`Sign In / Providers`](https://supabase.com/dashboard/project/_/auth/providers) under the Configuration section
- Click on **LinkedIn** from the accordion list to expand and you'll find your **Callback URL**, you can click `Copy` to copy it to the clipboard

### Local development

When testing OAuth locally with the Supabase CLI, ensure your OAuth provider
is configured with the local Supabase Auth callback URL:

[http://localhost:54321/auth/v1/callback](http://localhost:54321/auth/v1/callback)

If this callback URL is missing or misconfigured, OAuth sign-in may fail or not redirect correctly during local development.

See the [local development docs](https://supabase.com/docs/guides/local-development) for more details.

For testing OAuth locally with the Supabase CLI see the [local development docs](https://supabase.com/docs/guides/local-development).

## Create a LinkedIn OAuth app

- Go to [LinkedIn Developer Dashboard](https://www.linkedin.com/developers/apps).
- Click on `Create App` at the top right
- Enter your `LinkedIn Page` and `App Logo`
- Save your app
- Click `Products` from the top menu
- Look for `Sign In with LinkedIn using OpenID Connect` and click on Request Access
- Click `Auth` from the top menu
- Add your `Redirect URL` to the `Authorized Redirect URLs for your app` section
- Copy and save your newly-generated `Client ID`
- Copy and save your newly-generated `Client Secret`

Ensure that the appropriate scopes have been added under OAuth 2.0 Scopes at the bottom of the `Auth` screen.

![Required OAuth 2.0 Scopes](/docs/img/guides/auth-linkedin/oauth-scopes.png)

## Enter your LinkedIn (OIDC) credentials into your Supabase project

- Go to your [Supabase Project Dashboard](https://supabase.com/dashboard)
- In the left sidebar, click the `Authentication` icon (near the top)
- Click on [`Providers`](https://supabase.com/dashboard/project/_/auth/providers) under the Configuration section
- Click on **LinkedIn (OIDC)** from the accordion list to expand and turn **LinkedIn (OIDC) Enabled** to ON
- Enter your **LinkedIn (OIDC) Client ID** and **LinkedIn (OIDC) Client Secret** saved in the previous step
- Click `Save`

You can also configure the LinkedIn (OIDC) auth provider using the Management API:

```bash
# Get your access token from https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="your-access-token"
export PROJECT_REF="your-project-ref"

# Configure LinkedIn (OIDC) auth provider
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_linkedin_oidc_enabled": true,
    "external_linkedin_oidc_client_id": "your-linkedin-client-id",
    "external_linkedin_oidc_secret": "your-linkedin-client-secret"
  }'
```

## Add login code to your client app

**JavaScript**

Note: Make sure you're using the right `supabase` client in the following code.

If you're not using Server-Side Rendering or cookie-based Auth, you can directly use the `createClient` from `@supabase/supabase-js`. If you're using Server-Side Rendering, see the [Server-Side Auth guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client) for instructions on creating your Supabase client.

When your user signs in, call [`signInWithOAuth()`](https://supabase.com/docs/reference/javascript/auth-signinwithoauth) with `linkedin_oidc` as the `provider`:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
async function signInWithLinkedIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
  })
}
```

**Flutter**

When your user signs in, call [`signInWithOAuth()`](https://supabase.com/docs/reference/dart/auth-signinwithoauth) with `linkedin_oidc` as the `provider`:

```dart
Future<void> signInWithLinkedIn() async {
  await supabase.auth.signInWithOAuth(
    OAuthProvider.linkedinOidc,
    redirectTo: kIsWeb ? null : 'my.scheme://my-host', // Optionally set the redirect link to bring back the user via deeplink.
    authScreenLaunchMode:
        kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication, // Launch the auth screen in a new webview on mobile.
  );
}
```

**Kotlin**

When your user signs in, call [signInWith(Provider)](https://supabase.com/docs/reference/kotlin/auth-signinwithoauth) with `LinkedIn` as the `Provider`:

```kotlin
suspend fun signInWithKaLinkedIn() {
	supabase.auth.signInWith(LinkedIn)
}
```

**C#**

When your user signs in, call [`SignIn()`](https://supabase.com/docs/reference/csharp/sign-in-with-oauth) with `Provider.LinkedInOIDC` as the provider:

```c#
var state = await supabase.Auth.SignIn(Provider.LinkedInOIDC);
var signInUrl = state.Uri;
```

For a PKCE flow, for example in Server-Side Auth, you need an extra step to handle the code exchange. When calling `signInWithOAuth`, provide a `redirectTo` URL which points to a callback route. This redirect URL should be added to your [redirect allow list](https://supabase.com/docs/guides/auth/redirect-urls).

**Client**

In the browser, `signInWithOAuth` automatically redirects to the OAuth provider's authentication endpoint, which then redirects to your endpoint.

```js
import { createClient, type Provider } from '@supabase/supabase-js';
const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
const provider = 'provider' as Provider

// ---cut---
await supabase.auth.signInWithOAuth({
  provider,
  options: {
    redirectTo: `http://example.com/auth/callback`,
  },
})
```

**Server**

In the server, you need to handle the redirect to the OAuth provider's authentication endpoint. The `signInWithOAuth` method returns the endpoint URL, which you can redirect to.

```js
import { createClient, type Provider } from '@supabase/supabase-js'
const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
const provider = 'provider' as Provider
const redirect = (url: string) => {}

// ---cut---
const { data, error } = await supabase.auth.signInWithOAuth({
  provider,
  options: {
    redirectTo: 'http://example.com/auth/callback',
  },
})

if (data.url) {
  redirect(data.url) // use the redirect API for your server framework
}
```

At the callback endpoint, handle the code exchange to save the user session.

**Next.js**

Create a new file at `app/auth/callback/route.ts` and populate with the following:

```ts name=app/auth/callback/route.ts
import { NextResponse } from 'next/server'

// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/'
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/'
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

**SvelteKit**

Create a new file at `src/routes/auth/callback/+server.js` and populate with the following:

```js name=src/routes/auth/callback/+server.js
import { redirect } from '@sveltejs/kit';

export const GET = async (event) => {
	const {
		url,
		locals: { supabase }
	} = event;
	const code = url.searchParams.get('code') as string;
	const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      redirect(303, `/${next.slice(1)}`);
    }
  }

  // return the user to an error page with instructions
  redirect(303, '/auth/auth-code-error');
};
```

**Astro**

Create a new file at `src/pages/auth/callback.ts` and populate with the following:

```ts name=src/pages/auth/callback.ts
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { type APIRoute } from 'astro'

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = createServerClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return parseCookieHeader(Astro.request.headers.get('Cookie') ?? '')
          },
          setAll(cookiesToSet, _headers) {
            cookiesToSet.forEach(({ name, value, options }) =>
              Astro.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return redirect(next)
    }
  }

  // return the user to an error page with instructions
  return redirect('/auth/auth-code-error')
}
```

**Remix**

Create a new file at `app/routes/auth.callback.tsx` and populate with the following:

```ts name=app/routes/auth.callback.tsx
import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

export async function loader({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'
  const responseHeaders = new Headers()

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return redirect(next, { headers: responseHeaders })
    }
  }

  // return the user to an error page with instructions
  return redirect('/auth/auth-code-error', { headers: responseHeaders })
}
```

**Express**

Create a new route in your express app and populate with the following:

```js name=app.js
...
app.get("/auth/callback", async function (req, res) {
  const code = req.query.code
  const next = req.query.next ?? "/"

  if (code) {
    const supabase = createServerClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(req.headers.cookie ?? '')
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.appendHeader('Set-Cookie', serializeCookieHeader(name, value, options))
        )
        Object.entries(headers).forEach(([key, value]) =>
          res.setHeader(key, value)
        )
      },
    },
  })
    await supabase.auth.exchangeCodeForSession(code)
  }

  res.redirect(303, `/${next.slice(1)}`)
})
```

**JavaScript**

When your user signs out, call [signOut()](https://supabase.com/docs/reference/javascript/auth-signout) to remove them from the browser session and any objects from localStorage:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')

// ---cut---
async function signOut() {
  const { error } = await supabase.auth.signOut()
}
```

**Flutter**

When your user signs out, call [signOut()](https://supabase.com/docs/reference/dart/auth-signout) to remove them from the browser session and any objects from localStorage:

```dart
Future<void> signOut() async {
  await supabase.auth.signOut();
}
```

**Kotlin**

When your user signs out, call [signOut()](https://supabase.com/docs/reference/kotlin/auth-signout) to remove them from the browser session and any objects from localStorage:

```kotlin
suspend fun signOut() {
	supabase.auth.signOut()
}
```

**C#**

When your user signs out, call [SignOut()](https://supabase.com/docs/reference/csharp/sign-out) to remove them from the browser session and any objects from local storage:

```c#
await supabase.Auth.SignOut();
```

## LinkedIn Open ID Connect (OIDC)

We are replacing the *LinkedIn* provider with a new *LinkedIn (OIDC)* provider to support recent changes to the LinkedIn [OAuth APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow?context=linkedin%2Fcontext\&tabs=HTTPS1). The new provider uses the [Open ID Connect standard](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2#validating-id-tokens). In view of this change, we have disabled edits on the *LinkedIn* provider and will be removing it effective 4th January 2024. Developers with LinkedIn OAuth Applications created prior to 1st August 2023 should create a new OAuth application [via the steps outlined above](https://supabase.com/docs/guides/auth/social-login/auth-linkedin#create-a-linkedin-oauth-app) and migrate their credentials from the *LinkedIn* provider to the *LinkedIn (OIDC)* provider. Alternatively, you can also head to the `Products` section and add the newly release`Sign In with LinkedIn using OpenID Connect` to your existing OAuth application.

Developers using the Supabase CLI to test their LinkedIn OAuth application should also update their `config.toml` to make use of the new provider:

```
[auth.external.linkedin_oidc]
enabled = true
client_id = ...
secret = ...
```

Do reach out to support if you have any concerns around this change.

## Resources

- [Supabase - Get started for free](https://supabase.com)
- [Supabase JS Client](https://github.com/supabase/supabase-js)
- [LinkedIn Developer Dashboard](https://www.linkedin.com/developers/apps)
