<!-- source: https://supabase.com/docs/guides/functions/error-codes · mirrored 2026-08-13 from Supabase docs -->

# Error codes

Understand the error codes returned by Edge Functions to properly debug issues and handle responses.

Edge Functions can return the following error codes.

When an Edge Function request fails, the response includes a `sb-error-code` header that identifies the specific error.
You can inspect this header in your HTTP client or application code to detect and handle errors programmatically.

```js
const response = await fetch('<your-function-url>')

if (!response.ok) {
  const errorCode = response.headers.get('sb-error-code')
  console.error('Edge Function error:', errorCode)
}
```

## Bad Implementation Errors

These errors are caused by issues in your function's code or logic which requires updating its implementation.

### EDGE\_FUNCTION\_ERROR

**Cause:** Your Edge Function is throwing an unhandled error or resulting a 5XX code.

```ts
// ...

function process() {
  throw new Error('Some unhandled error')
}

export default {
  fetch: withSupabase({ auth: 'none' }, async () => {
    process()

    return new Response()
  }),
}
```

**Solution:**

- Ensure you are catching errors in your code logic with try-catch blocks.

```ts
function process() {
  throw new Error('Some unhandled error')
}

// ...

try {
  process()
  return new Response()
} catch (e) {
  console.error('Process fail:', e)
  return new Response(null, { status: 500 })
}
```

### IDLE\_TIMEOUT

**Cause:** Your Edge Function did not respond within the [request timeout limit](https://supabase.com/docs/guides/functions/limits).

**Common causes:**

- Long-running database queries
- Slow external API calls
- Infinite loops or blocking operations

**Solution:**

- Optimize slow operations
- Add timeout handling to external requests
- Consider breaking large operations into smaller chunks

### WORKER\_RESOURCE\_LIMIT, WORKER\_LIMIT

**Cause:** Your Edge Function execution was stopped due to exceeding resource limits. Edge Function logs should indicate which [resource limit](https://supabase.com/docs/guides/functions/limits) was exceeded.

**Common causes:**

- Memory usage exceeded available limits
- CPU time exceeded execution quotas
- Too many concurrent operations

**Solution:** Check your Edge Function logs to see which resource limit was exceeded, then optimize your function accordingly.

### WORKER\_ERROR

**Cause:** Your Edge Function threw an uncaught exception.

```ts
// ...

function initSomething() {
  throw new Error('Some unhandled error')
}

initSomething() // Error threw outside request handler

export default {
  fetch: withSupabase({ auth: 'none' }, async () => {
    return new Response()
  }),
}
```

**Common causes:**

- Unhandled JavaScript errors in your function code, outside request handler
- Missing error handling for async operations
- Invalid JSON parsing

**Solution:** Check your Edge Function logs to identify the specific error and add proper error handling to your code.

### INVALID\_RESPONSE\_STATUS\_CODE

**Cause:** Your Edge Function is returning an invalid HTTP status code — not equal to `101` and outside the range `[200, 599]`

**Common causes:**

- Proxying an external service that returns an invalid HTTP status code

```ts
// ...

export default {
  fetch: withSupabase({ auth: 'none' }, async (req) => {
    // Fails in case this proxied server return a status >599
    return fetch('https://some-server-to-proxy', {
      method: req.method,
      headers: req.headers,
      body: req.body,
    })
  }),
}
```

**Solution:**

- Ensure you are returning a valid HTTP status code
- For proxy endpoints, do not return the `fetch()` result directly; instead return a new `Response` wrapped in a try-catch block

```ts
// ...

export default {
  fetch: withSupabase({ auth: 'none' }, async (req) => {
    try {
      const res = await fetch('https://some-server-to-proxy', {
        method: req.method,
        headers: req.headers,
        body: req.body,
      })

      // Creating a 'new Response()' ensures contructor checks
      return new Response(await res.body, {
        headers: res.headers,
        status: res.status,
        statusText: res.statusText,
      })
    } catch (e) {
      console.error('Proxy Error', e)
      return new Response(null, { status: 502 })
    }
  }),
}
```

## Authentication Errors

These errors occur when the request contains a missing, malformed, or unsupported JWT token. Fixing them requires ensuring your requests include a valid authorization header, or disabling JWT verification for public endpoints.
For further information, see [Authorization headers](https://supabase.com/docs/guides/functions/auth-headers) and [Securing Edge Functions](https://supabase.com/guides/functions/auth).

### UNAUTHORIZED\_NO\_AUTH\_HEADER

**Cause:** The Edge Function has JWT verification enabled, but the request is missing the `Authorization` or `apikey` header.

**Solution:**

- Ensure you are passing a valid JWT token in the `Authorization` header
- Check that you are sending an API key in the `apikey` header
- For webhooks or public endpoints, consider disabling JWT verification

### UNAUTHORIZED\_ASYMMETRIC\_JWT

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header contains an invalid asymmetric `ES256 | RS256` token.

**Solution:**

- Ensure you are passing a valid user JWT token in the `Authorization` header
- Check that your token has not expired

### UNAUTHORIZED\_LEGACY\_JWT

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header contains an invalid legacy `HS256` token.

**Solution:**

- Ensure you are passing a valid legacy JWT token in the `Authorization` header
- Check that your token has not expired
- Verify that the legacy JWT secret has not been revoked or disabled

### UNAUTHORIZED\_UNSUPPORTED\_TOKEN\_ALGORITHM

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header does not contain an `ES256 | RS256 | HS256` token.

**Solution:**

- Ensure you are passing a valid Supabase-issued JWT token in the `Authorization` header

### UNAUTHORIZED\_INVALID\_JWT\_FORMAT

**Cause:** The Edge Function has JWT verification enabled, but the `Authorization` header does not follow the `Bearer <JWT Token>` format.

**Solution:**

- Check that you are passing `Bearer <JWT Token>` in the `Authorization` header
- Ensure you are sending an API key in the `apikey` header instead of `Authorization`
- For webhooks or public endpoints, consider disabling JWT verification

## Request Errors

These errors indicate issues with the request itself, which typically require changing how the function is called.

### RATE\_LIMIT\_EXCEEDED

**Cause:** The platform detected [recursive or nested function call](https://supabase.com/docs/guides/functions/recursive-functions) behavior.

**Common causes:**

- Multiple function-to-function calls
- Recursive or circular calls

**Solution:**

- Use the suggested retry window in seconds from the error message before calling your function again
- Ensure you are not performing unnecessary individual calls; use batch operations where possible
- Delegate large workloads to queues instead of recursively calling other Edge Functions

### INVALID\_URL

**Cause:** The platform rejected a malformed URL.

**Solution:**

- Ensure you are calling with a valid [formatted URL](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL)

***

## Server Errors

These errors indicate issues with function loading, execution, or the underlying platform.

### NOT\_FOUND

**Cause:** The Edge Function metadata or files were not found or are missing in the specific region.

**Solution:** Try redeploying your function and wait a few minutes to make sure all regions have been updated.

### NOT\_FOUND\_FUNCTION\_BLOB

**Cause:** Your Edge Function metadata resolved, but its deployment bundle was missing from storage and could not be loaded (the metadata points at a different version than the stored bundle). This returns the same `Requested function was not found` message as `NOT_FOUND`, so the `sb-error-code` header is what distinguishes them — see [Edge Function 404 error response](https://supabase.com/docs/guides/troubleshooting/edge-function-404-error-response).

**Common causes:**

- Two deploys of the same function running concurrently, double-incrementing the metadata version
- A batch deploy using `/deploy?bundleOnly=true` where the bulk metadata update failed

**Solution:**

- Redeploy your function with the latest version of the Supabase CLI
- Avoid running concurrent deploys of the same function, such as overlapping GitHub Actions runs
- If the problem persists, contact support so your function metadata can be re-synced

### BOOT\_ERROR

**Cause:** Your Edge Function failed to start.

**Common causes:**

- Syntax errors preventing the function from loading
- Import errors or missing dependencies
- Invalid function configuration

**Solution:** Check your Edge Function logs and also verify that your function code can be executed locally with `supabase functions serve`.

### LOAD\_FUNCTION\_ERROR

**Cause:** The platform was unable to load your function metadata or files.

**Solution:**

- Try calling your function again after a short delay
- If the problem persists, contact support

### LOAD\_FUNCTION\_METADATA\_ERROR

**Cause:** The platform could not fetch your function metadata, possibly due to external cache issues.

**Solution:**

- Wait a few minutes before calling your function again
- If the problem persists, contact support

### LOAD\_FUNCTION\_INVALID\_ENTRYPOINT\_PATH\_ERROR

**Cause:** Your Edge Function metadata is broken or contains an invalid entrypoint.

**Solution:**

- Try redeploying your function
- If the problem persists, contact support

### LOAD\_FUNCTION\_UNBUNDLING\_ERROR

**Cause:** Your Edge Function deployment bundle was fetched, but could not be unbundled because decompressing or parsing it failed. This usually means the bundle is corrupt or was only partially written.

**Solution:**

- Try redeploying your function
- If the problem persists, contact support
