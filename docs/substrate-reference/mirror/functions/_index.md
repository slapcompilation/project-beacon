<!-- source: https://supabase.com/docs/guides/functions · mirrored 2026-08-13 from Supabase docs -->

# Edge Functions

Run TypeScript functions globally at the edge.

Edge Functions are server-side TypeScript functions, distributed globally at the edge—close to your users. They can be used for listening to webhooks or integrating your Supabase project with third-parties [like Stripe](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/stripe-webhooks). Edge Functions are developed using [Deno](https://deno.com), which offers a few benefits to you as a developer:

- It is open source.
- It is portable. Supabase Edge Functions run locally, and on any other Deno-compatible platform (including self-hosted infrastructure).
- It is TypeScript first and supports WASM.
- Edge Functions are globally distributed for low-latency.

## How it works

- **Request enters an edge gateway (relay)** — the gateway routes traffic, handles auth headers/JWT validation, and applies routing/traffic rules.
- **Auth & policies are applied** — the gateway (or your function) can validate Supabase JWTs, apply rate-limits, and centralize security checks before executing code.
- **[Edge runtime](https://github.com/supabase/edge-runtime) executes your function** — the function runs on a regionally-distributed Edge Runtime node closest to the user for minimal latency.
- **Integrations & data access** — functions commonly call Supabase APIs (Auth, Postgres, Storage) or third-party APIs. For Postgres, prefer connection strategies suited for edge/serverless environments (see the `connect-to-postgres` guide).
- **Observability and logs** — invocations emit logs and metrics you can explore in the dashboard or downstream monitoring (Sentry, etc.).
- **Response returns via the gateway** — the gateway forwards the response back to the client and records request metadata.

## Quick technical notes

- **Runtime:** Supabase Edge Runtime (Deno compatible runtime with TypeScript first). Functions are `.ts` files that export a handler.
- **Local dev parity:** Use Supabase CLI for a local runtime similar to production for faster iteration (`supabase functions serve` command).
- **Global deployment:** Deploy your Edge Functions via Supabase Dashboard, CLI or MCP.
- **Cold starts & concurrency:** cold starts are possible — design for short-lived, idempotent operations. Heavy long-running jobs should be moved to [background workers](https://supabase.com/docs/guides/functions/background-tasks).
- **Database connections:** treat Postgres like a remote, pooled service — use connection pools or serverless-friendly drivers.
- **Secrets:** store credentials in Supabase [project secrets](https://supabase.com/docs/reference/cli/supabase-secrets) and access them via environment variables.

## When to use Edge Functions

- Authenticated or public HTTP endpoints that need low latency.
- Webhook receivers (Stripe, GitHub, etc.).
- On-demand image or Open Graph generation.
- Small AI inference tasks or orchestrating calls to external LLM APIs (like OpenAI)
- Sending transactional emails.
- Building messaging bots for Slack, Discord, etc.

## Get started

- **[Edge Functions quickstart](https://supabase.com/docs/guides/functions/quickstart):** Create, test, and deploy your first Edge Function with the Supabase CLI.

## Examples

Check out [Supabase Edge Function Examples](https://github.com/supabase/supabase/tree/master/examples/edge-functions) in GitHub or try these examples:

### Supabase integration

- **[With supabase-js](https://supabase.com/docs/guides/functions/auth):** Use the Supabase client inside your Edge Function.
- **[Connect to Postgres](https://supabase.com/docs/guides/functions/connect-to-postgres):** Connect to Postgres from Edge Functions.
- **[Type-Safe SQL with Kysely](https://supabase.com/docs/guides/functions/kysely-postgres):** Combine Kysely with Deno Postgres for a convenient developer experience when interacting directly with your Postgres database.
- **[With CORS headers](https://supabase.com/docs/guides/functions/cors):** Send CORS headers for invoking from the browser.
- **[Building a RESTful Service API](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/restful-tasks/index.ts):** Learn how to use HTTP methods and paths to build a RESTful service for managing tasks.
- **[Oak Server Middleware](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/oak-server):** Route requests with Oak server middleware.
- **[Web Stream](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/streams):** Stream Server-Sent Events from Edge Functions.
- **[Get User Location](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/location):** Get user location data from user's IP address.
- **[Working with Supabase Storage](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/read-storage/index.ts):** Read a file from Supabase Storage.
- **[Upload File](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/file-upload-storage):** Process multipart/form-data.

### Webhooks & payments

- **[Stripe Webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks):** Handle signed Stripe webhooks with Edge Functions.
- **[React Native with Stripe](https://github.com/supabase-community/expo-stripe-payments-with-supabase-functions):** Use Supabase and Stripe in a React Native app with Expo.
- **[Flutter with Stripe](https://github.com/supabase-community/flutter-stripe-payments-with-supabase-functions):** Use Supabase and Stripe in a Flutter app.

### AI & media

- **[Hugging Face](https://supabase.com/docs/guides/ai/examples/huggingface-image-captioning):** Access 100,000+ Machine Learning models.
- **[OpenAI](https://supabase.com/docs/guides/ai/examples/openai):** Use OpenAI in Edge Functions.
- **[Amazon Bedrock](https://supabase.com/docs/guides/functions/examples/amazon-bedrock-image-generator):** Generate images with Amazon Bedrock in Edge Functions.
- **[Open Graph Image Generation](https://supabase.com/docs/guides/functions/examples/og-image):** Generate Open Graph images with Deno and Supabase Edge Functions.
- **[OG Image Generation & Storage CDN Caching](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/og-image-with-storage-cdn):** Cache generated images with Supabase Storage CDN.
- **[Puppeteer](https://supabase.com/docs/guides/functions/examples/screenshots):** Generate screenshots with Puppeteer.

### Bots & email

- **[Send emails](https://supabase.com/docs/guides/functions/examples/send-emails):** Send emails in Edge Functions with Resend.
- **[Discord Bot](https://supabase.com/docs/guides/functions/examples/discord-bot):** Build a slash command Discord bot with Edge Functions.
- **[Telegram Bot](https://supabase.com/docs/guides/functions/examples/telegram-bot):** Build a Telegram bot with Edge Functions.
- **[Slack Bot Mention Edge Function](https://supabase.com/docs/guides/functions/examples/slack-bot-mention):** Handle Slack mentions in a Slack bot Edge Function.

### Operations & security

- **[Monitoring with Sentry](https://supabase.com/docs/guides/functions/examples/sentry-monitoring):** Monitor Edge Functions with the Sentry Deno SDK.
- **[GitHub Actions](https://supabase.com/docs/guides/functions/examples/github-actions):** Deploy Edge Functions with GitHub Actions.
- **[Upstash Redis](https://supabase.com/docs/guides/functions/examples/upstash-redis):** Build an Edge Functions Counter with Upstash Redis.
- **[Rate Limiting](https://supabase.com/docs/guides/functions/examples/rate-limiting):** Rate-limit Edge Functions with Upstash Redis.
- **[Cloudflare Turnstile](https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile):** Protect forms with Cloudflare Turnstile.
